-- THỰC NGHIỆM 1 - BENCHMARK HIỆU NĂNG GIỮ GHẾ TRÊN MYSQL
USE movie_ticket_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_benchmark_mysql_real_seats$$

CREATE PROCEDURE sp_benchmark_mysql_real_seats(
    IN p_rounds INT,      
    IN p_seat_count INT    
)
BEGIN
    DECLARE v_round INT DEFAULT 1;
    DECLARE v_seat INT DEFAULT 1;
    DECLARE v_start_time DATETIME(6);
    DECLARE v_end_time DATETIME(6);
    DECLARE v_elapsed_ms DECIMAL(10,3);
    DECLARE v_current_status VARCHAR(20);
    DECLARE v_locked INT DEFAULT 0;
    DECLARE v_showtime_id INT DEFAULT 1;

    SELECT showtime_id INTO v_showtime_id FROM showtime_seats LIMIT 1;
    IF v_showtime_id IS NULL THEN SET v_showtime_id = 1; END IF;

    CREATE TEMPORARY TABLE IF NOT EXISTS temp_real_benchmark_results (
        round_no       INT,
        seats_locked   VARCHAR(20),
        total_time_ms  DECIMAL(10,3),
        avg_latency_ms DECIMAL(10,4),
        requests_per_sec DECIMAL(10,2)
    );
    TRUNCATE TABLE temp_real_benchmark_results;

    WHILE v_round <= p_rounds DO
        UPDATE showtime_seats
        SET seat_status = 'AVAILABLE', booking_id = NULL
        WHERE showtime_id = v_showtime_id AND seat_id <= p_seat_count;

        SET v_seat = 1;
        SET v_locked = 0;
        SET v_start_time = NOW(6);


        WHILE v_seat <= p_seat_count DO
            START TRANSACTION;

            SELECT seat_status INTO v_current_status
            FROM showtime_seats
            WHERE showtime_id = v_showtime_id AND seat_id = v_seat
            FOR UPDATE;

            IF v_current_status = 'AVAILABLE' THEN
                COMMIT;
                SET v_locked = v_locked + 1;
            ELSE
                ROLLBACK;
            END IF;

            SET v_seat = v_seat + 1;
        END WHILE;

        SET v_end_time = NOW(6);
        SET v_elapsed_ms = TIMESTAMPDIFF(MICROSECOND, v_start_time, v_end_time) / 1000.0;

        INSERT INTO temp_real_benchmark_results VALUES (
            v_round,
            CONCAT(v_locked, '/', p_seat_count),
            v_elapsed_ms,
            v_elapsed_ms / v_locked,
            (v_locked * 1000.0) / v_elapsed_ms
        );

        SET v_round = v_round + 1;
    END WHILE;

    SELECT
        round_no             AS 'Lượt',
        seats_locked         AS 'Số ghế đã khóa',
        total_time_ms        AS 'Tổng thời gian (ms)',
        avg_latency_ms       AS 'Độ trễ TB/ghế (ms)',
        requests_per_sec     AS 'Throughput (req/s)'
    FROM temp_real_benchmark_results;

    SELECT
        'MySQL (InnoDB – SELECT FOR UPDATE + COMMIT)' AS 'Đối tượng đo',
        COUNT(*)                              AS 'Số lượt đo',
        ROUND(AVG(total_time_ms),  3)         AS 'Thời gian TB/lượt (ms)',
        ROUND(MIN(total_time_ms),  3)         AS 'Thời gian Min (ms)',
        ROUND(MAX(total_time_ms),  3)         AS 'Thời gian Max (ms)',
        ROUND(AVG(avg_latency_ms), 4)         AS 'Độ trễ TB/ghế (ms)',
        ROUND(AVG(requests_per_sec), 2)       AS 'Throughput TB (req/s)'
    FROM temp_real_benchmark_results;

    DROP TEMPORARY TABLE IF EXISTS temp_real_benchmark_results;
END$$

DELIMITER ;
CALL sp_benchmark_mysql_real_seats(5, 15);

-- THỰC NGHIỆM 2 - KIỂM SOÁT TRANH CHẤP TRÊN MYSQL
-- KỊCH BẢN 1: CÙNG TRANH CHẤP 1 GHẾ 
-- TAB 1:
USE movie_ticket_db;
UPDATE showtime_seats 
SET seat_status = 'AVAILABLE', booking_id = NULL 
WHERE showtime_id = 10100 AND seat_id = 5;

SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;

SELECT showtime_id, seat_id, seat_status 
FROM showtime_seats 
WHERE showtime_id = 10100 AND seat_id = 5 
FOR UPDATE;

SELECT SLEEP(5);
COMMIT;

-- TAB 2:
USE movie_ticket_db;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;

SET @t_start = SYSDATE(6);
SELECT showtime_id, seat_id, seat_status 
FROM showtime_seats 
WHERE showtime_id = 10100 AND seat_id = 5 
FOR UPDATE;

SET @t_end = SYSDATE(6);
SELECT 
    TIMESTAMPDIFF(MICROSECOND, @t_start, @t_end) / 1000.0 AS 'Do tre cho khoa (ms)';
ROLLBACK;

-- KỊCH BẢN 2: KHÁC SUẤT CHIẾU
-- TAB 1:
START TRANSACTION;
SELECT * FROM showtimes WHERE showtime_id = 10100 FOR UPDATE;

-- TAB 2:
START TRANSACTION;
SELECT * FROM showtimes WHERE showtime_id = 10101 FOR UPDATE;
