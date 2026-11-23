CREATE DATABASE IF NOT EXISTS movie_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE movie_db;
SET time_zone = '+00:00';

DROP TABLE IF EXISTS dm_benchmark_movies;

-- TẠO BẢNG BENCHMARK
CREATE TABLE dm_benchmark_movies (
    movie_id     INT           NOT NULL,
    title        VARCHAR(120)  NOT NULL,
    genre        VARCHAR(30)   NOT NULL,
    release_year SMALLINT      NOT NULL,
    rating       DECIMAL(3,1)  NOT NULL,
    movie_status VARCHAR(20)   NOT NULL,
    description  VARCHAR(180)  NOT NULL,
    PRIMARY KEY (movie_id),
    INDEX idx_dm_title (title),
    INDEX idx_dm_genre (genre),
    INDEX idx_dm_status_year (movie_status, release_year)
) ENGINE=InnoDB
  ROW_FORMAT=DYNAMIC
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- NẠP DỮ LIỆU & ĐO THỜI GIAN GHI
SET SESSION cte_max_recursion_depth = 6000;

SET @mysql_load_start = NOW(6);

INSERT INTO dm_benchmark_movies
    (movie_id, title, genre, release_year, rating, movie_status, description)
WITH RECURSIVE seq AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM seq WHERE n < 5000
)
SELECT
    n,
    CONCAT('Movie ', LPAD(n, 5, '0')),
    ELT(MOD(n - 1, 8) + 1,
        'Action', 'Comedy', 'Drama', 'Sci-Fi',
        'Animation', 'Horror', 'Adventure', 'Documentary'),
    2000 + MOD(n, 27),
    CAST(5 + MOD(n * 7, 51) / 10 AS DECIMAL(3,1)),
    ELT(MOD(n - 1, 3) + 1, 'NOW_SHOWING', 'COMING_SOON', 'END_OF_SHOW'),
    CONCAT('Benchmark movie description number ', n,
           ' for comparing MySQL and Redis storage and read performance.')
FROM seq;

SET @mysql_load_end = NOW(6);

-- Thời gian nạp dữ liệu
SELECT
    'MySQL InnoDB' AS engine,
    TIMESTAMPDIFF(MICROSECOND, @mysql_load_start, @mysql_load_end) AS load_time_us,
    ROUND(TIMESTAMPDIFF(MICROSECOND, @mysql_load_start, @mysql_load_end) / 1000, 3) AS load_time_ms;

-- DUNG LƯỢNG LƯU TRỮ 
ANALYZE TABLE dm_benchmark_movies;
-- Dung lượng bảng
SELECT
    TABLE_NAME,
    TABLE_ROWS                                           AS estimated_rows,
    ROUND(DATA_LENGTH / 1024, 2)                         AS data_kb,
    ROUND(INDEX_LENGTH / 1024, 2)                        AS secondary_index_kb,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 2)        AS total_kb,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / TABLE_ROWS, 2)  AS bytes_per_record
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'dm_benchmark_movies';

-- Dung lượng từng index
SELECT
    INDEX_NAME,
    ROUND(SUM(STAT_VALUE) * @@innodb_page_size / 1024, 2) AS estimated_index_kb
FROM mysql.innodb_index_stats
WHERE DATABASE_NAME = DATABASE()
  AND TABLE_NAME    = 'dm_benchmark_movies'
  AND STAT_NAME     = 'size'
GROUP BY INDEX_NAME
ORDER BY INDEX_NAME;

-- Tìm theo khóa chính
SELECT * FROM dm_benchmark_movies WHERE movie_id = 2500;

-- Tìm theo secondary index
SELECT * FROM dm_benchmark_movies WHERE title = 'Movie 02500';

-- Đọc 100 phim đầu tiên
SELECT movie_id, title, genre, rating
FROM dm_benchmark_movies
WHERE movie_id BETWEEN 1 AND 100
ORDER BY movie_id;

EXPLAIN SELECT * FROM dm_benchmark_movies WHERE movie_id = 2500;
EXPLAIN SELECT * FROM dm_benchmark_movies WHERE title = 'Movie 02500';

EXPLAIN SELECT movie_id, title, genre, rating
FROM dm_benchmark_movies
WHERE movie_id BETWEEN 1 AND 100
ORDER BY movie_id;

-- DUNG LƯỢNG CÁC BẢNG TRONG DB THỰC THI APP
USE movie_ticket_db;
ANALYZE TABLE movies, bookings, booking_details,
              showtimes, showtime_seats, users;

SELECT
    TABLE_NAME,
    TABLE_ROWS                                           AS estimated_rows,
    ROUND(DATA_LENGTH / 1024, 2)                         AS data_kb,
    ROUND(INDEX_LENGTH / 1024, 2)                        AS index_kb,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 2)        AS total_kb,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / NULLIF(TABLE_ROWS, 0), 2) AS bytes_per_record
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'movie_ticket_db'
  AND TABLE_NAME IN ('movies', 'bookings', 'booking_details',
                     'showtimes', 'showtime_seats', 'users')
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- Tổng dung lượng toàn bộ database.
SELECT
    TABLE_SCHEMA                                              AS db_name,
    COUNT(*)                                                  AS total_tables,
    SUM(TABLE_ROWS)                                           AS total_rows,
    ROUND(SUM(DATA_LENGTH) / 1024, 2)                         AS total_data_kb,
    ROUND(SUM(INDEX_LENGTH) / 1024, 2)                        AS total_index_kb,
    ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024, 2)          AS total_storage_kb
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'movie_ticket_db'
GROUP BY TABLE_SCHEMA;


