USE movie_ticket_db;

SET profiling = 1;

-- ------------------------------------------------------------------------------
-- POINT LOOKUP: Khách hàng tra cứu nhanh chi tiết đơn đặt vé theo booking_code 
-- ------------------------------------------------------------------------------
SET @real_code = (SELECT booking_code FROM bookings WHERE booking_status = 'CONFIRMED' ORDER BY booking_id ASC LIMIT 1);
SELECT @real_code AS 'Ma_ve_duoc_chon_tu_dong_trong_DB';

-- Câu truy vấn thực thi:
SELECT 
    b.booking_id, 
    b.booking_code, 
    b.user_id, 
    b.showtime_id,
    b.total_amount, 
    b.booking_status,
    b.created_at
FROM bookings b 
WHERE b.booking_code = @real_code;

-- EXPLAIN PLAN:
SET @sql_p1_exp = CONCAT("EXPLAIN SELECT b.booking_id, b.booking_code, b.user_id, b.total_amount, b.booking_status FROM bookings b WHERE b.booking_code = '", @real_code, "'");
PREPARE stmt_p1_exp FROM @sql_p1_exp;
EXECUTE stmt_p1_exp;
DEALLOCATE PREPARE stmt_p1_exp;

-- EXPLAIN ANALYZE:
SET @sql_p1_ana = CONCAT("EXPLAIN ANALYZE SELECT b.booking_id, b.booking_code, b.user_id, b.total_amount, b.booking_status FROM bookings b WHERE b.booking_code = '", @real_code, "'");
PREPARE stmt_p1_ana FROM @sql_p1_ana;
EXECUTE stmt_p1_ana;
DEALLOCATE PREPARE stmt_p1_ana;


-- ------------------------------------------------------------------------------
-- RANGE QUERY: Lọc danh sách suất chiếu của một phòng chiếu theo khoảng thời gian
-- ------------------------------------------------------------------------------

SET @target_room = (SELECT room_id FROM showtimes GROUP BY room_id ORDER BY COUNT(*) DESC LIMIT 1);
SET @start_range = (SELECT MIN(start_time) FROM showtimes WHERE room_id = @target_room);
SET @end_range   = (SELECT DATE_ADD(@start_range, INTERVAL 14 DAY));

SELECT @target_room AS 'Phong_chieu', @start_range AS 'Tu_ngay', @end_range AS 'Den_ngay';

-- Câu truy vấn thực thi:
SELECT 
    s.showtime_id, 
    s.room_id, 
    s.movie_id, 
    s.start_time, 
    s.end_time,
    s.status
FROM showtimes s
WHERE s.room_id = @target_room 
  AND s.start_time >= @start_range 
  AND s.start_time <= @end_range
ORDER BY s.start_time ASC;

-- EXPLAIN PLAN:
SET @sql_p2_exp = CONCAT(
    "EXPLAIN SELECT s.showtime_id, s.room_id, s.movie_id, s.start_time, s.end_time ",
    "FROM showtimes s WHERE s.room_id = ", @target_room, 
    " AND s.start_time BETWEEN '", @start_range, "' AND '", @end_range, "' ORDER BY s.start_time ASC"
);
PREPARE stmt_p2_exp FROM @sql_p2_exp;
EXECUTE stmt_p2_exp;
DEALLOCATE PREPARE stmt_p2_exp;

-- EXPLAIN ANALYZE:
SET @sql_p2_ana = CONCAT(
    "EXPLAIN ANALYZE SELECT s.showtime_id, s.room_id, s.movie_id, s.start_time, s.end_time ",
    "FROM showtimes s WHERE s.room_id = ", @target_room, 
    " AND s.start_time BETWEEN '", @start_range, "' AND '", @end_range, "' ORDER BY s.start_time ASC"
);
PREPARE stmt_p2_ana FROM @sql_p2_ana;
EXECUTE stmt_p2_ana;
DEALLOCATE PREPARE stmt_p2_ana;


-- ------------------------------------------------------------------------------
-- TOP-K RANKING & AGGREGATION: Báo cáo Top 10 phim ăn khách nhất toàn hệ thống
-- Câu truy vấn thực thi:
SELECT 
    m.movie_id AS movieId,
    m.title AS title, 
    COUNT(bd.booking_detail_id) AS totalTickets, 
    COALESCE(SUM(bd.ticket_price), 0) AS totalRevenue
FROM movies m
JOIN showtimes s ON s.movie_id = m.movie_id
JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
JOIN booking_details bd ON bd.booking_id = b.booking_id AND bd.ticket_status IN ('VALID', 'USED', 'CONFIRMED')
GROUP BY m.movie_id, m.title
HAVING totalTickets > 0
ORDER BY totalRevenue DESC
LIMIT 10;

-- EXPLAIN PLAN
EXPLAIN
SELECT 
    m.movie_id, m.title, 
    COUNT(bd.booking_detail_id) AS totalTickets, 
    COALESCE(SUM(bd.ticket_price), 0) AS totalRevenue
FROM movies m
JOIN showtimes s ON s.movie_id = m.movie_id
JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
JOIN booking_details bd ON bd.booking_id = b.booking_id
GROUP BY m.movie_id, m.title
ORDER BY totalRevenue DESC
LIMIT 10;

-- EXPLAIN ANALYZE:
EXPLAIN ANALYZE
SELECT 
    m.movie_id, m.title, 
    COUNT(bd.booking_detail_id) AS totalTickets, 
    COALESCE(SUM(bd.ticket_price), 0) AS totalRevenue
FROM movies m
JOIN showtimes s ON s.movie_id = m.movie_id
JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
JOIN booking_details bd ON bd.booking_id = b.booking_id
GROUP BY m.movie_id, m.title
ORDER BY totalRevenue DESC
LIMIT 10;


-- ------------------------------------------------------------------------------
-- COMPLEX MULTI-TABLE ANALYTICS Báo cáo tỷ lệ lấp đầy ghế theo suất chiếu 
-- ------------------------------------------------------------------------------

-- Câu truy vấn thực thi:
SELECT 
    s.showtime_id AS showtimeId,
    m.title AS movieTitle,
    r.room_name AS roomName,
    r.total_seats AS totalRoomSeats,
    COUNT(bd.booking_detail_id) AS bookedSeats,
    ROUND((COUNT(bd.booking_detail_id) / NULLIF(r.total_seats, 0)) * 100, 2) AS occupancyRate
FROM showtimes s
JOIN movies m ON s.movie_id = m.movie_id
JOIN rooms r ON s.room_id = r.room_id
LEFT JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
LEFT JOIN booking_details bd ON bd.booking_id = b.booking_id AND bd.ticket_status IN ('VALID', 'USED', 'CONFIRMED')
GROUP BY s.showtime_id, m.title, r.room_name, r.total_seats
ORDER BY occupancyRate DESC
LIMIT 10;

-- EXPLAIN PLAN
EXPLAIN
SELECT 
    s.showtime_id, m.title, r.room_name, r.total_seats,
    COUNT(bd.booking_detail_id) AS bookedSeats,
    ROUND((COUNT(bd.booking_detail_id) / NULLIF(r.total_seats, 0)) * 100, 2) AS occupancyRate
FROM showtimes s
JOIN movies m ON s.movie_id = m.movie_id
JOIN rooms r ON s.room_id = r.room_id
LEFT JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
LEFT JOIN booking_details bd ON bd.booking_id = b.booking_id
GROUP BY s.showtime_id, m.title, r.room_name, r.total_seats
ORDER BY occupancyRate DESC
LIMIT 10;

-- EXPLAIN ANALYZE
EXPLAIN FORMAT=JSON
SELECT 
    s.showtime_id, m.title, r.room_name, r.total_seats,
    COUNT(bd.booking_detail_id) AS bookedSeats
FROM showtimes s
JOIN movies m ON s.movie_id = m.movie_id
JOIN rooms r ON s.room_id = r.room_id
LEFT JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
LEFT JOIN booking_details bd ON bd.booking_id = b.booking_id
GROUP BY s.showtime_id, m.title, r.room_name, r.total_seats;

SHOW PROFILES;
