DROP DATABASE IF EXISTS btl_transaction_demo;
CREATE DATABASE btl_transaction_demo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE btl_transaction_demo;

-- Bảng ghế demo
CREATE TABLE demo_seats (
    seat_id    INT          NOT NULL PRIMARY KEY,
    seat_label VARCHAR(10)  NOT NULL,
    status     ENUM('AVAILABLE','BOOKED') NOT NULL DEFAULT 'AVAILABLE'
) ENGINE=InnoDB;

-- Bảng booking demo
CREATE TABLE demo_bookings (
    booking_id INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    seat_id    INT          NOT NULL,
    customer   VARCHAR(50)  NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_demo_booking_seat
        FOREIGN KEY (seat_id) REFERENCES demo_seats(seat_id)
) ENGINE=InnoDB;

-- Dữ liệu ban đầu: 2 ghế
INSERT INTO demo_seats (seat_id, seat_label, status) VALUES
  (1, 'A1', 'AVAILABLE'),
  (2, 'A2', 'AVAILABLE');

-- Đưa dữ liệu về trạng thái ban đầu (2 ghế AVAILABLE, 0 booking)
DELIMITER $$
DROP PROCEDURE IF EXISTS demo_reset$$
CREATE PROCEDURE demo_reset()
BEGIN
    DELETE FROM demo_bookings;
    UPDATE demo_seats SET status = 'AVAILABLE';
    ALTER TABLE demo_bookings AUTO_INCREMENT = 1;
END$$
DELIMITER ;


SELECT '═══ T1: COMMIT — Đặt ghế thành công ═══' AS scenario;

CALL demo_reset();

START TRANSACTION;
UPDATE demo_seats SET status = 'BOOKED' WHERE seat_id = 1;
INSERT INTO demo_bookings (seat_id, customer) VALUES (1, 'Nguyen Van A');
COMMIT;

-- Kiểm chứng T1
SELECT
    s.seat_label,
    s.status        AS seat_status,
    b.customer,
    CASE
        WHEN s.seat_label = 'A1' AND s.status = 'BOOKED'    THEN 'PASS'
        WHEN s.seat_label = 'A2' AND s.status = 'AVAILABLE' THEN 'PASS'
        ELSE 'FAIL'
    END AS verification
FROM demo_seats s
LEFT JOIN demo_bookings b ON s.seat_id = b.seat_id
ORDER BY s.seat_id;

SELECT
    CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS booking_count_check
FROM demo_bookings;


SELECT '═══ T2: ROLLBACK — Hủy toàn bộ transaction ═══' AS scenario;

CALL demo_reset();

START TRANSACTION;

UPDATE demo_seats SET status = 'BOOKED' WHERE seat_id = 1;
INSERT INTO demo_bookings (seat_id, customer) VALUES (1, 'Tran Van B');

SELECT '--- T2: Trước ROLLBACK (trong transaction) ---' AS step;
SELECT seat_label, status FROM demo_seats ORDER BY seat_id;
SELECT COUNT(*) AS booking_count FROM demo_bookings;

-- Hủy toàn bộ 
ROLLBACK;

-- Kiểm chứng T2: dữ liệu phải trở về ban đầu
SELECT '--- T2: Sau ROLLBACK ---' AS step;
SELECT
    s.seat_label,
    s.status,
    CASE
        WHEN s.status = 'AVAILABLE' THEN 'PASS'
        ELSE 'FAIL'
    END AS verification
FROM demo_seats s
ORDER BY s.seat_id;

SELECT
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS booking_count_check
FROM demo_bookings;


SELECT '═══ T3: LỖI VÀ ROLLBACK — Xử lý lỗi khóa ngoại ═══' AS scenario;

CALL demo_reset();

DELIMITER $$
DROP PROCEDURE IF EXISTS demo_t3_error$$
CREATE PROCEDURE demo_t3_error()
BEGIN
    DECLARE v_error_occurred INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR 1452
    BEGIN
        SET v_error_occurred = 1;
        SELECT 'LỖI 1452: Khóa ngoại thất bại — seat_id 999 không tồn tại' AS error_msg;
    END;

    START TRANSACTION;

    UPDATE demo_seats SET status = 'BOOKED' WHERE seat_id = 1;
    INSERT INTO demo_bookings (seat_id, customer) VALUES (999, 'Le Van C');
    IF v_error_occurred = 1 THEN
        SELECT 'Handler đã bắt lỗi → chủ động ROLLBACK' AS action;
        ROLLBACK;
    ELSE
        COMMIT;
    END IF;
END$$
DELIMITER ;

CALL demo_t3_error();

-- Kiểm chứng T3
SELECT
    s.seat_label,
    s.status,
    CASE
        WHEN s.status = 'AVAILABLE' THEN 'PASS'
        ELSE 'FAIL'
    END AS verification
FROM demo_seats s
ORDER BY s.seat_id;

SELECT
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS booking_count_check
FROM demo_bookings;

-- Dữ liệu cuối cùng
SELECT '--- Dữ liệu cuối cùng ---' AS '';
SELECT * FROM demo_seats;
SELECT * FROM demo_bookings;
