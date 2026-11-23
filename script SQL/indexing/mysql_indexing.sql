-- Tạo cơ sở dữ liệu riêng cho thực nghiệm
DROP DATABASE IF EXISTS indexing_lab;
CREATE DATABASE indexing_lab;
USE indexing_lab;
SET time_zone = '+00:00';

CREATE TABLE benchmark_showtimes (
    showtime_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id     INT NOT NULL,
    movie_id    INT NOT NULL,
    start_time  DATETIME NOT NULL,
    end_time    DATETIME NOT NULL,
    status      ENUM('SCHEDULED', 'CANCELLED') NOT NULL
) ENGINE = InnoDB;

SET SESSION cte_max_recursion_depth = 50000;

INSERT INTO benchmark_showtimes
    (showtime_id, room_id, movie_id, start_time, end_time, status)
WITH RECURSIVE seq (i) AS (
    SELECT 0
    UNION ALL
    SELECT i + 1 FROM seq WHERE i < 49999
)
SELECT
    i + 1,
    i % 10 + 1,
    i % 20 + 1,
    TIMESTAMP('2026-01-01 08:00:00') + INTERVAL (i DIV 10) * 3 HOUR,
    TIMESTAMP('2026-01-01 08:00:00') + INTERVAL (i DIV 10) * 3 HOUR + INTERVAL 150 MINUTE,
    IF(i % 12 = 0, 'CANCELLED', 'SCHEDULED')
FROM seq;

ANALYZE TABLE benchmark_showtimes;

-- Kiểm tra dữ liệu đã nạp
SELECT COUNT(*)                AS tong_so_dong,
       COUNT(DISTINCT room_id) AS so_phong,
       MIN(start_time)         AS bat_dau_som_nhat,
       MAX(start_time)         AS bat_dau_muon_nhat
FROM benchmark_showtimes;

-- Mốc thời gian dùng làm score bên Redis
SELECT UNIX_TIMESTAMP('2026-03-01 00:00:00') AS tu_epoch,
       UNIX_TIMESTAMP('2026-03-08 00:00:00') AS den_epoch;

CREATE TABLE ket_qua_do (
    cau_hinh     VARCHAR(40) NOT NULL,
    lan          INT NOT NULL,
    thoi_gian_us INT NOT NULL,
    PRIMARY KEY (cau_hinh, lan)
) ENGINE = InnoDB;

DROP PROCEDURE IF EXISTS do_thoi_gian;
DELIMITER //
CREATE PROCEDURE do_thoi_gian(IN p_cau_hinh VARCHAR(40), IN p_so_lan INT)
BEGIN
    DECLARE k INT DEFAULT 1;
    DECLARE xong INT DEFAULT 0;
    DECLARE t0 DATETIME(6);
    DECLARE v_id, v_room, v_movie INT;
    DECLARE v_start, v_end DATETIME;
    DECLARE c CURSOR FOR
        SELECT showtime_id, room_id, movie_id, start_time, end_time
        FROM benchmark_showtimes
        WHERE room_id = 1
          AND start_time >= '2026-03-01 00:00:00'
          AND start_time <  '2026-03-08 00:00:00'
        ORDER BY start_time;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET xong = 1;

    DELETE FROM ket_qua_do WHERE cau_hinh = p_cau_hinh;
    WHILE k <= p_so_lan + 5 DO
        SET xong = 0;
        SET t0 = SYSDATE(6);
        OPEN c;
        doc_het: LOOP
            FETCH c INTO v_id, v_room, v_movie, v_start, v_end;
            IF xong = 1 THEN LEAVE doc_het; END IF;
        END LOOP;
        CLOSE c;
        IF k > 5 THEN
            INSERT INTO ket_qua_do VALUES
                (p_cau_hinh, k - 5, TIMESTAMPDIFF(MICROSECOND, t0, SYSDATE(6)));
        END IF;
        SET k = k + 1;
    END WHILE;
END //
DELIMITER ;


-- CẤU HÌNH A: KHÔNG CÓ INDEX
-- Bảng chỉ có khoá chính
SHOW INDEX FROM benchmark_showtimes;
EXPLAIN
SELECT showtime_id, room_id, movie_id, start_time, end_time
FROM benchmark_showtimes
WHERE room_id = 1
  AND start_time >= '2026-03-01 00:00:00'
  AND start_time <  '2026-03-08 00:00:00'
ORDER BY start_time;

EXPLAIN ANALYZE
SELECT showtime_id, room_id, movie_id, start_time, end_time
FROM benchmark_showtimes
WHERE room_id = 1
  AND start_time >= '2026-03-01 00:00:00'
  AND start_time <  '2026-03-08 00:00:00'
ORDER BY start_time;

-- Số lần đọc dòng ở tầng lưu trữ
FLUSH STATUS;
SELECT showtime_id, room_id, movie_id, start_time, end_time
FROM benchmark_showtimes
WHERE room_id = 1
  AND start_time >= '2026-03-01 00:00:00'
  AND start_time <  '2026-03-08 00:00:00'
ORDER BY start_time;
SHOW SESSION STATUS LIKE 'Handler_read%';

CALL do_thoi_gian('A. Khong index', 500);

-- CẤU HÌNH B: INDEX GHÉP (room_id, start_time)
CREATE INDEX idx_room_start ON benchmark_showtimes (room_id, start_time);
ANALYZE TABLE benchmark_showtimes;

SHOW INDEX FROM benchmark_showtimes;

-- Kế hoạch thực thi
EXPLAIN
SELECT showtime_id, room_id, movie_id, start_time, end_time
FROM benchmark_showtimes
WHERE room_id = 1
  AND start_time >= '2026-03-01 00:00:00'
  AND start_time <  '2026-03-08 00:00:00'
ORDER BY start_time;

EXPLAIN ANALYZE
SELECT showtime_id, room_id, movie_id, start_time, end_time
FROM benchmark_showtimes
WHERE room_id = 1
  AND start_time >= '2026-03-01 00:00:00'
  AND start_time <  '2026-03-08 00:00:00'
ORDER BY start_time;

FLUSH STATUS;
SELECT showtime_id, room_id, movie_id, start_time, end_time
FROM benchmark_showtimes
WHERE room_id = 1
  AND start_time >= '2026-03-01 00:00:00'
  AND start_time <  '2026-03-08 00:00:00'
ORDER BY start_time;
SHOW SESSION STATUS LIKE 'Handler_read%';

CALL do_thoi_gian('B. Index (room_id, start_time)', 500);

-- Tổng hợp kết quả
SELECT cau_hinh,
       COUNT(*)                                AS so_lan,
       ROUND(AVG(thoi_gian_us) / 1000, 3)      AS avg_ms,
       ROUND(MAX(CASE WHEN thu_tu = CEIL(0.50 * tong)
                      THEN thoi_gian_us END) / 1000, 3) AS p50_ms,
       ROUND(MAX(CASE WHEN thu_tu = CEIL(0.95 * tong)
                      THEN thoi_gian_us END) / 1000, 3) AS p95_ms,
       ROUND(MIN(thoi_gian_us) / 1000, 3)      AS min_ms,
       ROUND(MAX(thoi_gian_us) / 1000, 3)      AS max_ms
FROM (
    SELECT cau_hinh, thoi_gian_us,
           ROW_NUMBER() OVER (PARTITION BY cau_hinh ORDER BY thoi_gian_us) AS thu_tu,
           COUNT(*)     OVER (PARTITION BY cau_hinh)                        AS tong
    FROM ket_qua_do
) AS t
GROUP BY cau_hinh
ORDER BY cau_hinh;

-- CHI PHÍ LƯU TRỮ CỦA INDEX
SELECT index_name,
       ROUND(stat_value * @@innodb_page_size / 1024) AS dung_luong_kb
FROM mysql.innodb_index_stats
WHERE database_name = 'indexing_lab'
  AND table_name    = 'benchmark_showtimes'
  AND stat_name     = 'size';

