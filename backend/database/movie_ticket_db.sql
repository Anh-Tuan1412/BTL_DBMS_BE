-- Fresh installations only. Existing databases require a reviewed data migration.
-- Requires MySQL 8.0.16+; all application DATETIME values are UTC.
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS movie_ticket_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE movie_ticket_db;
SET time_zone = '+00:00';


-- =========================================================
-- 1. USERS - Tài khoản người dùng
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    role ENUM('CUSTOMER', 'ADMIN', 'STAFF')
        NOT NULL DEFAULT 'CUSTOMER',

    status ENUM('ACTIVE', 'INACTIVE', 'BANNED')
        NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- =========================================================
-- 2. CINEMAS - Rạp chiếu phim
-- =========================================================

CREATE TABLE IF NOT EXISTS cinemas (
    cinema_id INT AUTO_INCREMENT PRIMARY KEY,

    cinema_name VARCHAR(150) NOT NULL,
    INDEX idx_cinemas_name (cinema_name),
    INDEX idx_cinemas_city (city),
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT '',
    phone VARCHAR(15),

    status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- =========================================================
-- 3. ROOMS - Phòng chiếu
-- =========================================================

CREATE TABLE IF NOT EXISTS rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,

    cinema_id INT NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    total_seats INT NOT NULL DEFAULT 0,

    status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_rooms_cinema
        FOREIGN KEY (cinema_id)
        REFERENCES cinemas(cinema_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_room_name
        UNIQUE (cinema_id, room_name),

    CONSTRAINT chk_room_total_seats
        CHECK (total_seats >= 0)
) ENGINE=InnoDB;


-- =========================================================
-- 4. SEAT TYPES - Loại ghế
-- =========================================================

CREATE TABLE IF NOT EXISTS seat_types (
    seat_type_id INT AUTO_INCREMENT PRIMARY KEY,

    type_name VARCHAR(50) NOT NULL UNIQUE,

    price_coefficient DECIMAL(5,2)
        NOT NULL DEFAULT 1.00,

    status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT chk_price_coefficient
        CHECK (price_coefficient > 0)
) ENGINE=InnoDB;


-- =========================================================
-- 5. SEATS - Ghế trong phòng
-- =========================================================

CREATE TABLE IF NOT EXISTS seats (
    seat_id INT AUTO_INCREMENT PRIMARY KEY,

    room_id INT NOT NULL,
    seat_row VARCHAR(5) NOT NULL,
    seat_number INT NOT NULL,
    seat_label VARCHAR(10) NOT NULL,
    seat_type_id INT NOT NULL,

    status ENUM('AVAILABLE', 'INACTIVE')
        NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT fk_seats_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(room_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_seats_type
        FOREIGN KEY (seat_type_id)
        REFERENCES seat_types(seat_type_id),

    CONSTRAINT uq_seat_position
        UNIQUE (room_id, seat_row, seat_number),
    UNIQUE KEY uq_seat_label (room_id, seat_label),
    UNIQUE KEY uq_seat_room (seat_id, room_id),

    CONSTRAINT chk_seat_number
        CHECK (seat_number > 0)
) ENGINE=InnoDB;


-- =========================================================
-- 6. MOVIES - Phim
-- =========================================================

CREATE TABLE IF NOT EXISTS movies (
    movie_id INT AUTO_INCREMENT PRIMARY KEY,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    duration INT NOT NULL COMMENT 'Thời lượng phim tính bằng phút',

    director VARCHAR(100),
    cast_members TEXT,
    trailer_url TEXT,
    rating DECIMAL(3,1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 10),

    release_date DATE,

    age_rating VARCHAR(10),

    poster_url TEXT,

    status ENUM(
        'NOW_SHOWING',
        'COMING_SOON',
        'END_OF_SHOW'
    ) NOT NULL DEFAULT 'COMING_SOON',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_movies_title (title),
    INDEX idx_movies_release_date (release_date),
    INDEX idx_movies_status (status),
    CONSTRAINT chk_movie_duration
        CHECK (duration > 0)
) ENGINE=InnoDB;


-- =========================================================
-- 7. SHOWTIMES & GENRES - Suất chiếu & Thể loại
-- =========================================================

CREATE TABLE IF NOT EXISTS genres (
    genre_id INT AUTO_INCREMENT PRIMARY KEY,
    genre_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id INT NOT NULL,
    genre_id INT NOT NULL,
    PRIMARY KEY (movie_id, genre_id),
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON DELETE RESTRICT,
    FOREIGN KEY (genre_id) REFERENCES genres(genre_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS showtimes (
    showtime_id INT AUTO_INCREMENT PRIMARY KEY,

    movie_id INT NOT NULL,
    room_id INT NOT NULL,

    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,

    base_price DECIMAL(10,2) NOT NULL,
    cleanup_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,

    status ENUM(
        'SCHEDULED',
        'ONGOING',
        'COMPLETED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'SCHEDULED',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_showtimes_movie
        FOREIGN KEY (movie_id)
        REFERENCES movies(movie_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_showtimes_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(room_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_showtime_time
        CHECK (end_time > start_time),

    CONSTRAINT chk_showtime_price
        CHECK (base_price >= 0),

    UNIQUE KEY uq_showtime_room (showtime_id, room_id),
    INDEX idx_showtimes_movie_start (movie_id, start_time),
    INDEX idx_showtimes_room_start (room_id, start_time),
    INDEX idx_showtimes_start_time (start_time)
) ENGINE=InnoDB;


-- =========================================================
-- 8. COMBOS - Bắp nước / Đồ ăn nhẹ
-- =========================================================

CREATE TABLE IF NOT EXISTS combos (
    combo_id INT AUTO_INCREMENT PRIMARY KEY,
    combo_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    
    CONSTRAINT chk_combo_price CHECK (price >= 0)
) ENGINE=InnoDB;


-- =========================================================
-- 9. VOUCHERS - Mã giảm giá / Khuyến mãi 
-- =========================================================

CREATE TABLE IF NOT EXISTS vouchers (
    voucher_id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type ENUM('PERCENTAGE', 'FIXED_AMOUNT') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_value DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2) NULL,
    usage_limit INT NOT NULL DEFAULT 100,
    used_count INT NOT NULL DEFAULT 0,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    status ENUM('ACTIVE', 'EXPIRED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT chk_discount_value CHECK (discount_value > 0 AND (discount_type <> 'PERCENTAGE' OR discount_value <= 100)),
    CONSTRAINT chk_voucher_limits CHECK (usage_limit >= 0 AND used_count >= 0 AND used_count <= usage_limit),
    CONSTRAINT chk_voucher_amounts CHECK (min_order_value IS NOT NULL AND min_order_value >= 0 AND (max_discount IS NULL OR max_discount >= 0)),
    CONSTRAINT chk_voucher_dates CHECK (end_date > start_date)
) ENGINE=InnoDB;


-- =========================================================
-- 10. BOOKINGS - Đơn đặt vé
-- =========================================================

CREATE TABLE IF NOT EXISTS bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(50) NOT NULL UNIQUE,

    user_id INT NOT NULL,
    showtime_id INT NOT NULL,
    voucher_id INT NULL,

    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

    booking_status ENUM(
        'PENDING',
        'CONFIRMED',
        'CANCELLED',
        'EXPIRED'
    ) NOT NULL DEFAULT 'PENDING',

    hold_expires_at DATETIME NULL,

    cancelled_at DATETIME NULL,
    cancellation_reason VARCHAR(255) NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_bookings_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT fk_bookings_showtime
        FOREIGN KEY (showtime_id)
        REFERENCES showtimes(showtime_id),

    CONSTRAINT fk_bookings_voucher
        FOREIGN KEY (voucher_id)
        REFERENCES vouchers(voucher_id),

    CONSTRAINT chk_booking_amount
        CHECK (total_amount >= 0 AND discount_amount >= 0),

    UNIQUE KEY uq_booking_showtime (booking_id, showtime_id),
    INDEX idx_bookings_user_created (user_id, created_at),
    INDEX idx_bookings_expiry (booking_status, hold_expires_at),

    INDEX idx_bookings_showtime (showtime_id),
    INDEX idx_bookings_status (booking_status),
    INDEX idx_bookings_created_at (created_at)
) ENGINE=InnoDB;


-- =========================================================
-- 11. BOOKING DETAILS - Chi tiết vé & Tồn kho ghế
-- =========================================================

CREATE TABLE IF NOT EXISTS showtime_seats (
    showtime_id INT NOT NULL,
    seat_id INT NOT NULL,
    room_id INT NOT NULL,
    booking_id INT NULL,
    seat_status ENUM('AVAILABLE','PENDING','BOOKED') NOT NULL DEFAULT 'AVAILABLE',
    PRIMARY KEY (showtime_id, seat_id),
    FOREIGN KEY (showtime_id, room_id) REFERENCES showtimes(showtime_id, room_id) ON DELETE RESTRICT,
    FOREIGN KEY (seat_id, room_id) REFERENCES seats(seat_id, room_id) ON DELETE RESTRICT,
    FOREIGN KEY (booking_id, showtime_id) REFERENCES bookings(booking_id, showtime_id) ON DELETE RESTRICT,
    CONSTRAINT chk_inventory_owner CHECK (
        (seat_status = 'AVAILABLE' AND booking_id IS NULL) OR
        (seat_status IN ('PENDING','BOOKED') AND booking_id IS NOT NULL)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_details (
    booking_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_code VARCHAR(50) NOT NULL UNIQUE,
    hold_token VARCHAR(100) NOT NULL,
    showtime_id INT NOT NULL,
    ticket_status ENUM('PENDING', 'VALID', 'USED', 'CANCELLED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    active_seat_id INT GENERATED ALWAYS AS
        (CASE WHEN ticket_status IN ('PENDING','VALID','USED') THEN seat_id ELSE NULL END) STORED,
    UNIQUE KEY uq_active_ticket (showtime_id, active_seat_id),

    booking_id INT NOT NULL,
    seat_id INT NOT NULL,

    ticket_price DECIMAL(10,2) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_booking_details_booking
        FOREIGN KEY (booking_id, showtime_id)
        REFERENCES bookings(booking_id, showtime_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_booking_details_seat
        FOREIGN KEY (seat_id)
        REFERENCES seats(seat_id),

    CONSTRAINT fk_detail_showtime_seat FOREIGN KEY (showtime_id, seat_id)
        REFERENCES showtime_seats(showtime_id, seat_id),
    UNIQUE KEY uq_booking_seat (booking_id, seat_id),

    CONSTRAINT chk_ticket_price
        CHECK (ticket_price >= 0),

    INDEX idx_booking_details_booking (booking_id),
    INDEX idx_booking_details_seat (seat_id)
) ENGINE=InnoDB;


-- =========================================================
-- 12. BOOKING COMBOS - Bắp nước đi kèm đơn
-- =========================================================

CREATE TABLE IF NOT EXISTS booking_combos (
    booking_combo_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    combo_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_booking_combos_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(booking_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_booking_combos_combo
        FOREIGN KEY (combo_id)
        REFERENCES combos(combo_id),

    UNIQUE KEY uq_booking_combo (booking_id, combo_id),
    CONSTRAINT chk_combo_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_combo_quantity CHECK (quantity > 0)
) ENGINE=InnoDB;


-- =========================================================
-- 13. PAYMENTS - Thanh toán
-- =========================================================

CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,

    booking_id INT NOT NULL,

    payment_method ENUM(
        'STRIPE',
        'VNPAY',
        'MOMO',
        'ZALOPAY',
        'CASH'
    ) NOT NULL DEFAULT 'STRIPE',

    transaction_code VARCHAR(100) UNIQUE,

    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_session_id VARCHAR(255) UNIQUE,

    amount DECIMAL(10,2) NOT NULL,

    payment_status ENUM(
        'PENDING',
        'SUCCESS',
        'FAILED',
        'REFUND_PENDING',
        'REFUNDED'
    ) NOT NULL DEFAULT 'PENDING',

    refund_id VARCHAR(255) UNIQUE,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

    settled_booking_id INT GENERATED ALWAYS AS
        (CASE WHEN payment_status IN ('SUCCESS','REFUND_PENDING','REFUNDED') THEN booking_id ELSE NULL END) STORED,
    UNIQUE KEY uq_settled_booking (settled_booking_id),
    paid_at DATETIME NULL,
    refunded_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_payments_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(booking_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_payment_amount
        CHECK (amount >= 0),

    CONSTRAINT chk_refund_amount
        CHECK (refund_amount >= 0 AND refund_amount <= amount),

    INDEX idx_payments_booking (booking_id),
    INDEX idx_payments_status (payment_status),
    INDEX idx_payments_paid_at (paid_at)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS payment_events (
    stripe_event_id VARCHAR(255) PRIMARY KEY,
    payment_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS schema_metadata (
    version INT PRIMARY KEY,
    installed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- =========================================================
-- 15. DỮ LIỆU SEED DANH MỤC BAN ĐẦU HOÀN CHỈNH
-- =========================================================

-- 15.1. Seat Types
INSERT INTO seat_types (seat_type_id, type_name, price_coefficient) VALUES
(1, 'REGULAR', 1.00),
(2, 'VIP', 1.20),
(3, 'COUPLE', 1.50)
ON DUPLICATE KEY UPDATE price_coefficient = VALUES(price_coefficient);

-- 15.2. Combos
INSERT INTO combos (combo_id, combo_name, description, price) VALUES
(1, 'Combo Solo', '1 Bắp lớn + 1 Nước ngọt lớn', 75000.00),
(2, 'Combo Couple', '1 Bắp lớn + 2 Nước ngọt lớn', 99000.00),
(3, 'Combo Family', '2 Bắp lớn + 3 Nước ngọt lớn', 159000.00)
ON DUPLICATE KEY UPDATE price = VALUES(price);

-- 15.3. Vouchers
INSERT INTO vouchers (voucher_id, code, discount_type, discount_value, min_order_value, max_discount, usage_limit, used_count, start_date, end_date, status) VALUES
(1, 'WELCOME2026', 'PERCENTAGE', 10.00, 100000.00, 50000.00, 100, 0, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'ACTIVE'),
(2, 'VIPCINEMA50K', 'FIXED_AMOUNT', 50000.00, 200000.00, NULL, 50, 0, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'ACTIVE')
ON DUPLICATE KEY UPDATE code = VALUES(code);

-- 15.4. Genres
INSERT INTO genres (genre_id, genre_name) VALUES
(1, 'Khoa học viễn tưởng'), (2, 'Phiêu lưu'), (3, 'Tiểu sử'), (4, 'Lịch sử'),
(5, 'Chính kịch'), (6, 'Hành động'), (7, 'Hài hước'), (8, 'Siêu anh hùng'),
(9, 'Quái thú'), (10, 'Giả tưởng'), (11, 'Hoạt hình'), (12, 'Gia đình'), (13, 'Giật gân')
ON DUPLICATE KEY UPDATE genre_name = VALUES(genre_name);

-- 15.5. Users
INSERT INTO users (user_id, fullname, email, phone, password_hash, role, status) VALUES
-- HaQuach@26
(1, 'Quách Văn Hà', 'ha.quach@cinema.vn', '0901234567', '$2b$10$ZpdtqkpANRgcN9kHO0ESWuPNeuS4NwOtDEox1cupmAIj48urHMjYa', 'ADMIN', 'ACTIVE'),
-- lonGi123
(2, 'Nguyễn Hoàng Long', 'long.nguyen@cinema.vn', '0908889999', '$2b$10$4jJ56avcszDov9VQ9gSfqOPt.0bNKY1uAVhO3Tlz5YespyN0LgJQy', 'ADMIN', 'ACTIVE'),
-- 123456
(3, 'Trần Bảo Nam', 'nam.tran@cinema.vn', '0902223344', '$2b$10$uhfz.aw7.eMuJ.Dk4bA5beOJ3RjTGriZ2UDGqBPfz2iWtz.XC9mv.', 'ADMIN', 'ACTIVE'),
-- pThao09
(4, 'Lê Phương Thảo', 'thao.le@cinema.vn', '0903334455', '$2b$10$ysLGfmLiN1qgKfYk9twADe8ByhD0VPU0y7TynSQnqIGys/N0kP5t2', 'ADMIN', 'ACTIVE'),
-- maimai@#
(5, 'Trần Thị Mai', 'mai.tran@gmail.com', '0981112233', '$2b$10$f86zwD2P9UuljXQrrQHs5euXUzE1aWJs8pL6FEqWivNC1Pmwk0VqK', 'CUSTOMER', 'ACTIVE'),
-- DUC112233$
(6, 'Phạm Minh Đức', 'duc.pham@gmail.com', '0982223344', '$2b$10$bFkIbP3ffdqOxAkDiueKiebSSBmwOW0rFWhOw5I6zhJqLhINU/g0e', 'CUSTOMER', 'ACTIVE'),
-- Linhvu@
(7, 'Vũ Thảo Linh', 'linh.vu@gmail.com', '0983334455', '$2b$10$d4FlWuK12dUXPoNYxl.17uNeVh0PVdAU9cRsTsmK2nC0tCzAnVASO', 'CUSTOMER', 'ACTIVE'),
-- Huydang999
(8, 'Đặng Quốc Huy', 'huy.dang@gmail.com', '0984445566', '$2b$10$Xh1hNUKD5r1SEsqBk/G4OucZ.1w1qNGjS.RaloeNKMkqcldmJbNKe', 'CUSTOMER', 'ACTIVE'),
-- anhNGOC67
(9, 'Bùi Ngọc Ánh', 'anh.bui@gmail.com', '0985556677', '$2b$10$2.P.HyZJKtfNvxD/7eVEsuaVnxN7JUOymIQUJsvyv8BuxziAJn3gm', 'CUSTOMER', 'ACTIVE'),
-- Longlong7788
(10, 'Đỗ Thành Long', 'long.do@gmail.com', '0986667788', '$2b$10$mZWEz.WltIZP.a5unaS/f.Gnl9gW4f3W0SdcSW7zmh7l5pbEzd1US', 'CUSTOMER', 'ACTIVE')
ON DUPLICATE KEY UPDATE fullname = VALUES(fullname);

-- 15.6. Cinemas & Rooms
INSERT INTO cinemas (cinema_id, cinema_name, address, city, phone, status) VALUES
(1, 'CGV Landmark 81', '772 Điện Biên Phủ, Phường 22, Bình Thạnh', 'TP. Hồ Chí Minh', '02839998888', 'ACTIVE'),
(2, 'Galaxy Sala', 'Tầng 3 Thiso Mall Sala, 10 Mai Chí Thọ, Thủ Đức', 'TP. Hồ Chí Minh', '02837779999', 'ACTIVE'),
(3, 'Lotte Cinema Gò Vấp', 'Tầng 4 Lotte Mart, 242 Nguyễn Văn Lượng, Gò Vấp', 'TP. Hồ Chí Minh', '02836665555', 'ACTIVE'),
(4, 'BHD Star Cầu Giấy', 'Tầng 8 Discovery Complex, 302 Cầu Giấy', 'Hà Nội', '02438889999', 'ACTIVE')
ON DUPLICATE KEY UPDATE cinema_name = VALUES(cinema_name);

INSERT INTO rooms (room_id, cinema_id, room_name, total_seats, status) VALUES
(1, 1, 'Phòng 01 - IMAX Laser', 40, 'ACTIVE'),
(2, 1, 'Phòng 02 - Gold Class', 30, 'ACTIVE'),
(3, 2, 'Phòng 01 - IMAX', 40, 'ACTIVE'),
(4, 2, 'Phòng 02 - Atmos', 40, 'ACTIVE'),
(5, 3, 'Phòng 01 - Super Plex', 40, 'ACTIVE'),
(6, 3, 'Phòng 02 - Standard 2D', 30, 'ACTIVE'),
(7, 4, 'Phòng 01 - First Class', 30, 'ACTIVE'),
(8, 4, 'Phòng 02 - Digital 2D', 30, 'ACTIVE')
ON DUPLICATE KEY UPDATE room_name = VALUES(room_name);

-- 15.7. Seats (ĐẦY ĐỦ 280 GHẾ CHO TOÀN BỘ 8 PHÒNG CHIẾU)
-- Room 1 (40 ghế: A1-D10)
INSERT INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id, status) VALUES
(1, 'A', 1, 'A1', 1, 'AVAILABLE'), (1, 'A', 2, 'A2', 1, 'AVAILABLE'), (1, 'A', 3, 'A3', 1, 'AVAILABLE'), (1, 'A', 4, 'A4', 1, 'AVAILABLE'), (1, 'A', 5, 'A5', 1, 'AVAILABLE'), (1, 'A', 6, 'A6', 1, 'AVAILABLE'), (1, 'A', 7, 'A7', 1, 'AVAILABLE'), (1, 'A', 8, 'A8', 1, 'AVAILABLE'), (1, 'A', 9, 'A9', 1, 'AVAILABLE'), (1, 'A', 10, 'A10', 1, 'AVAILABLE'),
(1, 'B', 1, 'B1', 1, 'AVAILABLE'), (1, 'B', 2, 'B2', 1, 'AVAILABLE'), (1, 'B', 3, 'B3', 1, 'AVAILABLE'), (1, 'B', 4, 'B4', 1, 'AVAILABLE'), (1, 'B', 5, 'B5', 1, 'AVAILABLE'), (1, 'B', 6, 'B6', 1, 'AVAILABLE'), (1, 'B', 7, 'B7', 1, 'AVAILABLE'), (1, 'B', 8, 'B8', 1, 'AVAILABLE'), (1, 'B', 9, 'B9', 1, 'AVAILABLE'), (1, 'B', 10, 'B10', 1, 'AVAILABLE'),
(1, 'C', 1, 'C1', 2, 'AVAILABLE'), (1, 'C', 2, 'C2', 2, 'AVAILABLE'), (1, 'C', 3, 'C3', 2, 'AVAILABLE'), (1, 'C', 4, 'C4', 2, 'AVAILABLE'), (1, 'C', 5, 'C5', 2, 'AVAILABLE'), (1, 'C', 6, 'C6', 2, 'AVAILABLE'), (1, 'C', 7, 'C7', 2, 'AVAILABLE'), (1, 'C', 8, 'C8', 2, 'AVAILABLE'), (1, 'C', 9, 'C9', 2, 'AVAILABLE'), (1, 'C', 10, 'C10', 2, 'AVAILABLE'),
(1, 'D', 1, 'D1', 2, 'AVAILABLE'), (1, 'D', 2, 'D2', 2, 'AVAILABLE'), (1, 'D', 3, 'D3', 2, 'AVAILABLE'), (1, 'D', 4, 'D4', 2, 'AVAILABLE'), (1, 'D', 5, 'D5', 2, 'AVAILABLE'), (1, 'D', 6, 'D6', 2, 'AVAILABLE'), (1, 'D', 7, 'D7', 2, 'AVAILABLE'), (1, 'D', 8, 'D8', 2, 'AVAILABLE'), (1, 'D', 9, 'D9', 2, 'AVAILABLE'), (1, 'D', 10, 'D10', 2, 'AVAILABLE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Room 2 (30 ghế: A1-C10)
INSERT INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id, status) VALUES
(2, 'A', 1, 'A1', 1, 'AVAILABLE'), (2, 'A', 2, 'A2', 1, 'AVAILABLE'), (2, 'A', 3, 'A3', 1, 'AVAILABLE'), (2, 'A', 4, 'A4', 1, 'AVAILABLE'), (2, 'A', 5, 'A5', 1, 'AVAILABLE'), (2, 'A', 6, 'A6', 1, 'AVAILABLE'), (2, 'A', 7, 'A7', 1, 'AVAILABLE'), (2, 'A', 8, 'A8', 1, 'AVAILABLE'), (2, 'A', 9, 'A9', 1, 'AVAILABLE'), (2, 'A', 10, 'A10', 1, 'AVAILABLE'),
(2, 'B', 1, 'B1', 1, 'AVAILABLE'), (2, 'B', 2, 'B2', 1, 'AVAILABLE'), (2, 'B', 3, 'B3', 1, 'AVAILABLE'), (2, 'B', 4, 'B4', 1, 'AVAILABLE'), (2, 'B', 5, 'B5', 1, 'AVAILABLE'), (2, 'B', 6, 'B6', 1, 'AVAILABLE'), (2, 'B', 7, 'B7', 1, 'AVAILABLE'), (2, 'B', 8, 'B8', 1, 'AVAILABLE'), (2, 'B', 9, 'B9', 1, 'AVAILABLE'), (2, 'B', 10, 'B10', 1, 'AVAILABLE'),
(2, 'C', 1, 'C1', 2, 'AVAILABLE'), (2, 'C', 2, 'C2', 2, 'AVAILABLE'), (2, 'C', 3, 'C3', 2, 'AVAILABLE'), (2, 'C', 4, 'C4', 2, 'AVAILABLE'), (2, 'C', 5, 'C5', 2, 'AVAILABLE'), (2, 'C', 6, 'C6', 2, 'AVAILABLE'), (2, 'C', 7, 'C7', 2, 'AVAILABLE'), (2, 'C', 8, 'C8', 2, 'AVAILABLE'), (2, 'C', 9, 'C9', 2, 'AVAILABLE'), (2, 'C', 10, 'C10', 2, 'AVAILABLE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Room 3 (40 ghế: A1-D10)
INSERT INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id, status) VALUES
(3, 'A', 1, 'A1', 1, 'AVAILABLE'), (3, 'A', 2, 'A2', 1, 'AVAILABLE'), (3, 'A', 3, 'A3', 1, 'AVAILABLE'), (3, 'A', 4, 'A4', 1, 'AVAILABLE'), (3, 'A', 5, 'A5', 1, 'AVAILABLE'), (3, 'A', 6, 'A6', 1, 'AVAILABLE'), (3, 'A', 7, 'A7', 1, 'AVAILABLE'), (3, 'A', 8, 'A8', 1, 'AVAILABLE'), (3, 'A', 9, 'A9', 1, 'AVAILABLE'), (3, 'A', 10, 'A10', 1, 'AVAILABLE'),
(3, 'B', 1, 'B1', 1, 'AVAILABLE'), (3, 'B', 2, 'B2', 1, 'AVAILABLE'), (3, 'B', 3, 'B3', 1, 'AVAILABLE'), (3, 'B', 4, 'B4', 1, 'AVAILABLE'), (3, 'B', 5, 'B5', 1, 'AVAILABLE'), (3, 'B', 6, 'B6', 1, 'AVAILABLE'), (3, 'B', 7, 'B7', 1, 'AVAILABLE'), (3, 'B', 8, 'B8', 1, 'AVAILABLE'), (3, 'B', 9, 'B9', 1, 'AVAILABLE'), (3, 'B', 10, 'B10', 1, 'AVAILABLE'),
(3, 'C', 1, 'C1', 2, 'AVAILABLE'), (3, 'C', 2, 'C2', 2, 'AVAILABLE'), (3, 'C', 3, 'C3', 2, 'AVAILABLE'), (3, 'C', 4, 'C4', 2, 'AVAILABLE'), (3, 'C', 5, 'C5', 2, 'AVAILABLE'), (3, 'C', 6, 'C6', 2, 'AVAILABLE'), (3, 'C', 7, 'C7', 2, 'AVAILABLE'), (3, 'C', 8, 'C8', 2, 'AVAILABLE'), (3, 'C', 9, 'C9', 2, 'AVAILABLE'), (3, 'C', 10, 'C10', 2, 'AVAILABLE'),
(3, 'D', 1, 'D1', 2, 'AVAILABLE'), (3, 'D', 2, 'D2', 2, 'AVAILABLE'), (3, 'D', 3, 'D3', 2, 'AVAILABLE'), (3, 'D', 4, 'D4', 2, 'AVAILABLE'), (3, 'D', 5, 'D5', 2, 'AVAILABLE'), (3, 'D', 6, 'D6', 2, 'AVAILABLE'), (3, 'D', 7, 'D7', 2, 'AVAILABLE'), (3, 'D', 8, 'D8', 2, 'AVAILABLE'), (3, 'D', 9, 'D9', 2, 'AVAILABLE'), (3, 'D', 10, 'D10', 2, 'AVAILABLE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Room 4 (40 ghế: A1-D10)
INSERT INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id, status) VALUES
(4, 'A', 1, 'A1', 1, 'AVAILABLE'), (4, 'A', 2, 'A2', 1, 'AVAILABLE'), (4, 'A', 3, 'A3', 1, 'AVAILABLE'), (4, 'A', 4, 'A4', 1, 'AVAILABLE'), (4, 'A', 5, 'A5', 1, 'AVAILABLE'), (4, 'A', 6, 'A6', 1, 'AVAILABLE'), (4, 'A', 7, 'A7', 1, 'AVAILABLE'), (4, 'A', 8, 'A8', 1, 'AVAILABLE'), (4, 'A', 9, 'A9', 1, 'AVAILABLE'), (4, 'A', 10, 'A10', 1, 'AVAILABLE'),
(4, 'B', 1, 'B1', 1, 'AVAILABLE'), (4, 'B', 2, 'B2', 1, 'AVAILABLE'), (4, 'B', 3, 'B3', 1, 'AVAILABLE'), (4, 'B', 4, 'B4', 1, 'AVAILABLE'), (4, 'B', 5, 'B5', 1, 'AVAILABLE'), (4, 'B', 6, 'B6', 1, 'AVAILABLE'), (4, 'B', 7, 'B7', 1, 'AVAILABLE'), (4, 'B', 8, 'B8', 1, 'AVAILABLE'), (4, 'B', 9, 'B9', 1, 'AVAILABLE'), (4, 'B', 10, 'B10', 1, 'AVAILABLE'),
(4, 'C', 1, 'C1', 2, 'AVAILABLE'), (4, 'C', 2, 'C2', 2, 'AVAILABLE'), (4, 'C', 3, 'C3', 2, 'AVAILABLE'), (4, 'C', 4, 'C4', 2, 'AVAILABLE'), (4, 'C', 5, 'C5', 2, 'AVAILABLE'), (4, 'C', 6, 'C6', 2, 'AVAILABLE'), (4, 'C', 7, 'C7', 2, 'AVAILABLE'), (4, 'C', 8, 'C8', 2, 'AVAILABLE'), (4, 'C', 9, 'C9', 2, 'AVAILABLE'), (4, 'C', 10, 'C10', 2, 'AVAILABLE'),
(4, 'D', 1, 'D1', 2, 'AVAILABLE'), (4, 'D', 2, 'D2', 2, 'AVAILABLE'), (4, 'D', 3, 'D3', 2, 'AVAILABLE'), (4, 'D', 4, 'D4', 2, 'AVAILABLE'), (4, 'D', 5, 'D5', 2, 'AVAILABLE'), (4, 'D', 6, 'D6', 2, 'AVAILABLE'), (4, 'D', 7, 'D7', 2, 'AVAILABLE'), (4, 'D', 8, 'D8', 2, 'AVAILABLE'), (4, 'D', 9, 'D9', 2, 'AVAILABLE'), (4, 'D', 10, 'D10', 2, 'AVAILABLE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Room 5 (40 ghế: A1-D10)
INSERT INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id, status) VALUES
(5, 'A', 1, 'A1', 1, 'AVAILABLE'), (5, 'A', 2, 'A2', 1, 'AVAILABLE'), (5, 'A', 3, 'A3', 1, 'AVAILABLE'), (5, 'A', 4, 'A4', 1, 'AVAILABLE'), (5, 'A', 5, 'A5', 1, 'AVAILABLE'), (5, 'A', 6, 'A6', 1, 'AVAILABLE'), (5, 'A', 7, 'A7', 1, 'AVAILABLE'), (5, 'A', 8, 'A8', 1, 'AVAILABLE'), (5, 'A', 9, 'A9', 1, 'AVAILABLE'), (5, 'A', 10, 'A10', 1, 'AVAILABLE'),
(5, 'B', 1, 'B1', 1, 'AVAILABLE'), (5, 'B', 2, 'B2', 1, 'AVAILABLE'), (5, 'B', 3, 'B3', 1, 'AVAILABLE'), (5, 'B', 4, 'B4', 1, 'AVAILABLE'), (5, 'B', 5, 'B5', 1, 'AVAILABLE'), (5, 'B', 6, 'B6', 1, 'AVAILABLE'), (5, 'B', 7, 'B7', 1, 'AVAILABLE'), (5, 'B', 8, 'B8', 1, 'AVAILABLE'), (5, 'B', 9, 'B9', 1, 'AVAILABLE'), (5, 'B', 10, 'B10', 1, 'AVAILABLE'),
(5, 'C', 1, 'C1', 2, 'AVAILABLE'), (5, 'C', 2, 'C2', 2, 'AVAILABLE'), (5, 'C', 3, 'C3', 2, 'AVAILABLE'), (5, 'C', 4, 'C4', 2, 'AVAILABLE'), (5, 'C', 5, 'C5', 2, 'AVAILABLE'), (5, 'C', 6, 'C6', 2, 'AVAILABLE'), (5, 'C', 7, 'C7', 2, 'AVAILABLE'), (5, 'C', 8, 'C8', 2, 'AVAILABLE'), (5, 'C', 9, 'C9', 2, 'AVAILABLE'), (5, 'C', 10, 'C10', 2, 'AVAILABLE'),
(5, 'D', 1, 'D1', 2, 'AVAILABLE'), (5, 'D', 2, 'D2', 2, 'AVAILABLE'), (5, 'D', 3, 'D3', 2, 'AVAILABLE'), (5, 'D', 4, 'D4', 2, 'AVAILABLE'), (5, 'D', 5, 'D5', 2, 'AVAILABLE'), (5, 'D', 6, 'D6', 2, 'AVAILABLE'), (5, 'D', 7, 'D7', 2, 'AVAILABLE'), (5, 'D', 8, 'D8', 2, 'AVAILABLE'), (5, 'D', 9, 'D9', 2, 'AVAILABLE'), (5, 'D', 10, 'D10', 2, 'AVAILABLE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Room 6 (30 ghế: A1-C10)
INSERT INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id, status) VALUES
(6, 'A', 1, 'A1', 1, 'AVAILABLE'), (6, 'A', 2, 'A2', 1, 'AVAILABLE'), (6, 'A', 3, 'A3', 1, 'AVAILABLE'), (6, 'A', 4, 'A4', 1, 'AVAILABLE'), (6, 'A', 5, 'A5', 1, 'AVAILABLE'), (6, 'A', 6, 'A6', 1, 'AVAILABLE'), (6, 'A', 7, 'A7', 1, 'AVAILABLE'), (6, 'A', 8, 'A8', 1, 'AVAILABLE'), (6, 'A', 9, 'A9', 1, 'AVAILABLE'), (6, 'A', 10, 'A10', 1, 'AVAILABLE'),
(6, 'B', 1, 'B1', 1, 'AVAILABLE'), (6, 'B', 2, 'B2', 1, 'AVAILABLE'), (6, 'B', 3, 'B3', 1, 'AVAILABLE'), (6, 'B', 4, 'B4', 1, 'AVAILABLE'), (6, 'B', 5, 'B5', 1, 'AVAILABLE'), (6, 'B', 6, 'B6', 1, 'AVAILABLE'), (6, 'B', 7, 'B7', 1, 'AVAILABLE'), (6, 'B', 8, 'B8', 1, 'AVAILABLE'), (6, 'B', 9, 'B9', 1, 'AVAILABLE'), (6, 'B', 10, 'B10', 1, 'AVAILABLE'),
(6, 'C', 1, 'C1', 2, 'AVAILABLE'), (6, 'C', 2, 'C2', 2, 'AVAILABLE'), (6, 'C', 3, 'C3', 2, 'AVAILABLE'), (6, 'C', 4, 'C4', 2, 'AVAILABLE'), (6, 'C', 5, 'C5', 2, 'AVAILABLE'), (6, 'C', 6, 'C6', 2, 'AVAILABLE'), (6, 'C', 7, 'C7', 2, 'AVAILABLE'), (6, 'C', 8, 'C8', 2, 'AVAILABLE'), (6, 'C', 9, 'C9', 2, 'AVAILABLE'), (6, 'C', 10, 'C10', 2, 'AVAILABLE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Room 7 (30 ghế: A1-C10)
INSERT INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id, status) VALUES
(7, 'A', 1, 'A1', 1, 'AVAILABLE'), (7, 'A', 2, 'A2', 1, 'AVAILABLE'), (7, 'A', 3, 'A3', 1, 'AVAILABLE'), (7, 'A', 4, 'A4', 1, 'AVAILABLE'), (7, 'A', 5, 'A5', 1, 'AVAILABLE'), (7, 'A', 6, 'A6', 1, 'AVAILABLE'), (7, 'A', 7, 'A7', 1, 'AVAILABLE'), (7, 'A', 8, 'A8', 1, 'AVAILABLE'), (7, 'A', 9, 'A9', 1, 'AVAILABLE'), (7, 'A', 10, 'A10', 1, 'AVAILABLE'),
(7, 'B', 1, 'B1', 1, 'AVAILABLE'), (7, 'B', 2, 'B2', 1, 'AVAILABLE'), (7, 'B', 3, 'B3', 1, 'AVAILABLE'), (7, 'B', 4, 'B4', 1, 'AVAILABLE'), (7, 'B', 5, 'B5', 1, 'AVAILABLE'), (7, 'B', 6, 'B6', 1, 'AVAILABLE'), (7, 'B', 7, 'B7', 1, 'AVAILABLE'), (7, 'B', 8, 'B8', 1, 'AVAILABLE'), (7, 'B', 9, 'B9', 1, 'AVAILABLE'), (7, 'B', 10, 'B10', 1, 'AVAILABLE'),
(7, 'C', 1, 'C1', 2, 'AVAILABLE'), (7, 'C', 2, 'C2', 2, 'AVAILABLE'), (7, 'C', 3, 'C3', 2, 'AVAILABLE'), (7, 'C', 4, 'C4', 2, 'AVAILABLE'), (7, 'C', 5, 'C5', 2, 'AVAILABLE'), (7, 'C', 6, 'C6', 2, 'AVAILABLE'), (7, 'C', 7, 'C7', 2, 'AVAILABLE'), (7, 'C', 8, 'C8', 2, 'AVAILABLE'), (7, 'C', 9, 'C9', 2, 'AVAILABLE'), (7, 'C', 10, 'C10', 2, 'AVAILABLE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Room 8 (30 ghế: A1-C10)
INSERT INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id, status) VALUES
(8, 'A', 1, 'A1', 1, 'AVAILABLE'), (8, 'A', 2, 'A2', 1, 'AVAILABLE'), (8, 'A', 3, 'A3', 1, 'AVAILABLE'), (8, 'A', 4, 'A4', 1, 'AVAILABLE'), (8, 'A', 5, 'A5', 1, 'AVAILABLE'), (8, 'A', 6, 'A6', 1, 'AVAILABLE'), (8, 'A', 7, 'A7', 1, 'AVAILABLE'), (8, 'A', 8, 'A8', 1, 'AVAILABLE'), (8, 'A', 9, 'A9', 1, 'AVAILABLE'), (8, 'A', 10, 'A10', 1, 'AVAILABLE'),
(8, 'B', 1, 'B1', 1, 'AVAILABLE'), (8, 'B', 2, 'B2', 1, 'AVAILABLE'), (8, 'B', 3, 'B3', 1, 'AVAILABLE'), (8, 'B', 4, 'B4', 1, 'AVAILABLE'), (8, 'B', 5, 'B5', 1, 'AVAILABLE'), (8, 'B', 6, 'B6', 1, 'AVAILABLE'), (8, 'B', 7, 'B7', 1, 'AVAILABLE'), (8, 'B', 8, 'B8', 1, 'AVAILABLE'), (8, 'B', 9, 'B9', 1, 'AVAILABLE'), (8, 'B', 10, 'B10', 1, 'AVAILABLE'),
(8, 'C', 1, 'C1', 2, 'AVAILABLE'), (8, 'C', 2, 'C2', 2, 'AVAILABLE'), (8, 'C', 3, 'C3', 2, 'AVAILABLE'), (8, 'C', 4, 'C4', 2, 'AVAILABLE'), (8, 'C', 5, 'C5', 2, 'AVAILABLE'), (8, 'C', 6, 'C6', 2, 'AVAILABLE'), (8, 'C', 7, 'C7', 2, 'AVAILABLE'), (8, 'C', 8, 'C8', 2, 'AVAILABLE'), (8, 'C', 9, 'C9', 2, 'AVAILABLE'), (8, 'C', 10, 'C10', 2, 'AVAILABLE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- 15.8. Movies
INSERT INTO movies (movie_id, title, description, duration, director, cast_members, trailer_url, rating, release_date, age_rating, poster_url, status) VALUES
(1, 'Dune: Part Two', 'Hành trình huyền thoại của Paul Atreides khi anh hợp nhất với Chani...', 166, 'Denis Villeneuve', 'Timothée Chalamet, Zendaya', 'https://www.youtube.com/watch?v=Way9Dexny3w', 8.5, '2024-03-01', 'T16', 'https://image.tmdb.org/t/p/original/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', 'NOW_SHOWING'),
(2, 'Oppenheimer', 'Câu chuyện kịch tính về cuộc đời J. Robert Oppenheimer...', 180, 'Christopher Nolan', 'Cillian Murphy, Emily Blunt', 'https://www.youtube.com/watch?v=uYPbbksJxIg', 8.9, '2023-07-21', 'T18', 'https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', 'NOW_SHOWING'),
(3, 'Deadpool & Wolverine', 'Wade Wilson tái xuất giang hồ...', 128, 'Shawn Levy', 'Ryan Reynolds, Hugh Jackman', 'https://www.youtube.com/watch?v=73_1biulkYk', 7.8, '2024-07-26', 'T18', 'https://image.tmdb.org/t/p/original/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg', 'NOW_SHOWING'),
(4, 'Inside Out 2', 'Khi cô bé Riley bước vào tuổi dậy thì...', 96, 'Kelsey Mann', 'Amy Poehler, Maya Hawke', 'https://www.youtube.com/watch?v=mg50EkStx-s', 7.9, '2024-06-14', 'P', 'https://image.tmdb.org/t/p/original/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg', 'NOW_SHOWING')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- Map Thể loại
INSERT INTO movie_genres (movie_id, genre_id) VALUES
(1, 1), (1, 2), (2, 3), (2, 4), (3, 6), (3, 7), (4, 11), (4, 12)
ON DUPLICATE KEY UPDATE genre_id = VALUES(genre_id);

-- 15.9. Showtimes
INSERT INTO showtimes (showtime_id, movie_id, room_id, start_time, end_time, base_price, status) VALUES
(1, 1, 1, '2026-10-15 18:30:00', '2026-10-15 21:26:00', 120000.00, 'SCHEDULED'),
(2, 4, 2, '2026-10-15 19:00:00', '2026-10-15 20:46:00', 100000.00, 'SCHEDULED'),
(3, 3, 3, '2026-10-15 20:00:00', '2026-10-15 22:18:00', 110000.00, 'SCHEDULED'),
(4, 1, 1, '2026-10-16 14:00:00', '2026-10-16 16:56:00', 100000.00, 'SCHEDULED')
ON DUPLICATE KEY UPDATE base_price = VALUES(base_price);

-- 15.10. Showtime Seats (Khởi tạo toàn bộ ở trạng thái AVAILABLE)
INSERT INTO showtime_seats (showtime_id, seat_id, room_id, booking_id, seat_status) VALUES
(1, 1, 1, NULL, 'AVAILABLE'),
(1, 2, 1, NULL, 'AVAILABLE'),
(1, 3, 1, NULL, 'AVAILABLE'),
(1, 4, 1, NULL, 'AVAILABLE')
ON DUPLICATE KEY UPDATE seat_status = VALUES(seat_status);

INSERT INTO schema_metadata (version) VALUES (2) ON DUPLICATE KEY UPDATE version = 2;

START TRANSACTION;

INSERT INTO genres (genre_id, genre_name) VALUES
(1001, 'Kinh dị'), (1002, 'Bí ẩn'), (1003, 'Tình cảm'),
(1004, 'Tài liệu'), (1005, 'Âm nhạc');

SET @demo_today = DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR);
SET @demo_month = CAST(DATE_FORMAT(@demo_today, '%Y-%m-01') AS DATE);


INSERT INTO movies (
    movie_id, title, description, duration, director, cast_members,
    trailer_url, rating, release_date, age_rating, poster_url, status
) VALUES
(1001, 'A Quiet Place', 'Một gia đình phải giữ im lặng để sống sót trước những sinh vật săn mồi bằng âm thanh.', 90,
 'John Krasinski', 'Emily Blunt, John Krasinski, Millicent Simmonds, Noah Jupe',
 'https://www.youtube.com/watch?v=WR7cc5t7tv8', 7.5, '2018-04-06', 'T16',
 'https://upload.wikimedia.org/wikipedia/en/a/a0/A_Quiet_Place_film_poster.png', 'NOW_SHOWING'),
(1002, 'La La Land', 'Một nữ diễn viên đầy hoài bão và một nghệ sĩ jazz yêu nhau khi theo đuổi sự nghiệp ở Los Angeles.', 128,
 'Damien Chazelle', 'Ryan Gosling, Emma Stone, John Legend',
 'https://www.youtube.com/watch?v=_oBwwSXdO_E', 8.0, '2016-12-09', 'T13',
 'https://upload.wikimedia.org/wikipedia/en/a/ab/La_La_Land_%28film%29.png', 'NOW_SHOWING'),
(1003, 'Free Solo', 'Phim tài liệu theo chân Alex Honnold khi anh chuẩn bị leo vách El Capitan mà không dùng dây bảo hiểm.', 100,
 'Elizabeth Chai Vasarhelyi, Jimmy Chin', 'Alex Honnold, Sanni McCandless, Tommy Caldwell',
 'https://www.youtube.com/watch?v=urRVZ4SW7WU', 8.2, '2018-09-28', 'T13',
 'https://lumiere-a.akamaihd.net/v1/images/docfilmswebsite_1080x1600_freesolo_91d7bed0.jpeg?region=0%2C0%2C1080%2C1600', 'NOW_SHOWING'),
(1004, 'Sing', 'Chú gấu koala Buster Moon tổ chức cuộc thi ca hát để cứu nhà hát đang gặp khó khăn.', 108,
 'Garth Jennings', 'Matthew McConaughey, Reese Witherspoon, Scarlett Johansson, Taron Egerton',
 'https://www.youtube.com/watch?v=vo0xce7eMw0', 7.1, '2016-12-21', 'P',
 'https://images.contentstack.io/v3/assets/blt13adb7e2033fcee5/blt475d20664cb3f25e/691c82e0f1c20313ed0b6864/Sing_Poster_2000x3000_uaa.jpg?width=1200', 'NOW_SHOWING'),
(1005, 'The Martian', 'Bị bỏ lại trên Sao Hỏa, phi hành gia Mark Watney tìm cách sống sót và liên lạc với đội cứu hộ.', 141,
 'Ridley Scott', 'Matt Damon, Jessica Chastain, Chiwetel Ejiofor',
 'https://www.youtube.com/watch?v=ej3ioOneTy8', 8.0, '2015-10-02', 'T13',
 'https://lumiere-a.akamaihd.net/v1/images/image_a119dd78.jpeg?region=0%2C0%2C800%2C1200', 'NOW_SHOWING'),
(1006, 'Finding Nemo', 'Cá hề Marlin cùng Dory băng qua đại dương để tìm Nemo sau khi cậu bị bắt khỏi rạn san hô.', 100,
 'Andrew Stanton', 'Albert Brooks, Ellen DeGeneres, Alexander Gould',
 'https://www.youtube.com/watch?v=UnrNR-mcgLY', 8.2, '2003-05-30', 'P',
 'https://lumiere-a.akamaihd.net/v1/images/p_findingnemo_19752_05271d3f.jpeg?region=0%2C0%2C540%2C810', 'NOW_SHOWING'),
(1007, 'Soul', 'Một giáo viên âm nhạc lạc vào thế giới của các linh hồn ngay khi cơ hội biểu diễn nhạc jazz mở ra.', 100,
 'Pete Docter (đồng đạo diễn Kemp Powers)', 'Jamie Foxx, Tina Fey, Graham Norton',
 'https://www.youtube.com/watch?v=qNYcwbEL-pg', 8.0, '2020-12-25', 'P',
 'https://lumiere-a.akamaihd.net/v1/images/p_soul_disneyplus_v2_20907_764da65d.jpeg?region=0%2C0%2C540%2C810', 'COMING_SOON'),
(1008, 'Shutter Island', 'Hai cảnh sát liên bang đến bệnh viện tâm thần trên đảo để điều tra vụ mất tích của một bệnh nhân.', 138,
 'Martin Scorsese', 'Leonardo DiCaprio, Mark Ruffalo, Ben Kingsley',
 'https://www.youtube.com/watch?v=5iaYLCiq5RM', 8.2, '2010-02-19', 'T16',
 'https://upload.wikimedia.org/wikipedia/en/7/76/Shutterislandposter.jpg', 'END_OF_SHOW');

INSERT INTO movie_genres (movie_id, genre_id) VALUES
(1001, 1001), (1001, 1), (1001, 13),
(1002, 1003), (1002, 1005), (1002, 5),
(1003, 1004), (1003, 2),
(1004, 1005), (1004, 7), (1004, 11), (1004, 12),
(1005, 1), (1005, 2), (1005, 5),
(1006, 2), (1006, 11), (1006, 12),
(1007, 1005), (1007, 10), (1007, 11),
(1008, 1002), (1008, 13);

-- 16.2 48 suất đã chiếu trong sáu tháng trước và 56 suất mở bán
-- trong bảy ngày tới. Các phòng luân phiên chiếu phim ở khung giờ 09:00–21:00.
INSERT INTO showtimes (showtime_id, movie_id, room_id, start_time, end_time, base_price, status)
WITH RECURSIVE slots AS (
    SELECT 0 AS n UNION ALL SELECT n + 1 FROM slots WHERE n < 55
),
schedule AS (
    SELECT 10000 + n AS showtime_id,
           CASE MOD(n, 9)
               WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 4
               WHEN 4 THEN 1001 WHEN 5 THEN 1002 WHEN 6 THEN 1003
               WHEN 7 THEN 1004 ELSE 1008
           END AS movie_id,
           1 + MOD(n, 8) AS room_id,
           TIMESTAMP(
               @demo_month - INTERVAL (1 + FLOOR(n / 8)) MONTH + INTERVAL (4 + 2 * MOD(n, 8)) DAY,
               MAKETIME(9 + MOD(n * 3, 13), 0, 0)
           ) - INTERVAL 7 HOUR AS start_time,
           65000 + 5000 * MOD(n * 3, 15) AS base_price,
           'COMPLETED' AS status
    FROM slots WHERE n < 48
    UNION ALL
    SELECT 10100 + n,
           CASE MOD(n + FLOOR(n / 8), 10)
               WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 4
               WHEN 4 THEN 1001 WHEN 5 THEN 1002 WHEN 6 THEN 1003
               WHEN 7 THEN 1004 WHEN 8 THEN 1005 ELSE 1006
           END,
           1 + MOD(n, 8),
           TIMESTAMP(
               @demo_today + INTERVAL (1 + FLOOR(n / 8)) DAY,
               MAKETIME(9 + MOD(n * 5, 13), 0, 0)
           ) - INTERVAL 7 HOUR,
           75000 + 5000 * MOD(n * 7, 16),
           'SCHEDULED'
    FROM slots
)
SELECT s.showtime_id, s.movie_id, s.room_id, s.start_time,
       s.start_time + INTERVAL m.duration MINUTE, s.base_price, s.status
FROM schedule s JOIN movies m ON m.movie_id = s.movie_id;

-- 16.3 Sơ đồ ghế thật theo phòng của từng suất mới.
INSERT INTO showtime_seats (showtime_id, seat_id, room_id)
SELECT s.showtime_id, seat.seat_id, s.room_id
FROM showtimes s JOIN seats seat ON seat.room_id = s.room_id
WHERE (s.showtime_id BETWEEN 10000 AND 10047 OR s.showtime_id BETWEEN 10100 AND 10155)
  AND seat.status = 'AVAILABLE';

-- 16.4 Mỗi đơn có 1–4 vé. Phân ghế thành nhóm bốn vị trí
-- để các đơn không tranh cùng ghế. Một số suất tương lai có ghế bán trước.
CREATE TEMPORARY TABLE demo_ticket_rows AS
WITH RECURSIVE order_slots AS (
    SELECT 1 AS slot UNION ALL SELECT slot + 1 FROM order_slots WHERE slot < 8
),
seat_positions AS (
    SELECT seat_id, room_id, seat_type_id,
           ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY seat_label, seat_id) AS position
    FROM seats WHERE status = 'AVAILABLE'
),
planned_orders AS (
    SELECT s.showtime_id, s.room_id, s.base_price, s.status AS show_status, o.slot,
           CONCAT('DEMO-BK-', s.showtime_id, '-', o.slot) COLLATE utf8mb4_unicode_ci AS booking_code,
           5 + MOD(s.showtime_id + o.slot, 6) AS user_id,
           CASE
               WHEN s.status = 'COMPLETED' THEN s.start_time - INTERVAL (3 + o.slot) HOUR
               ELSE UTC_TIMESTAMP() - INTERVAL (1 + o.slot) HOUR
           END AS ordered_at,
           CASE WHEN o.slot = 8 THEN 2 ELSE 1 + MOD(s.showtime_id + o.slot, 4) END AS ticket_count,
           CASE WHEN o.slot = 8 THEN 'CANCELLED' ELSE 'CONFIRMED' END AS booking_status
    FROM showtimes s CROSS JOIN order_slots o
    WHERE (
        s.showtime_id BETWEEN 10000 AND 10047
        AND (o.slot <= 3 + MOD(s.showtime_id, 5) OR (o.slot = 8 AND MOD(s.showtime_id, 4) = 0))
    ) OR (
        s.showtime_id BETWEEN 10100 AND 10155 AND o.slot <= MOD(s.showtime_id, 5)
    )
)
SELECT o.*, seat.seat_id, ROUND(o.base_price * st.price_coefficient, 0) AS ticket_price
FROM planned_orders o
JOIN seat_positions seat ON seat.room_id = o.room_id
 AND seat.position BETWEEN 4 * (o.slot - 1) + 1 AND 4 * (o.slot - 1) + o.ticket_count
JOIN seat_types st ON st.seat_type_id = seat.seat_type_id;

-- 16.5 Đơn, vé và trạng thái ghế khớp với nhau.
INSERT INTO bookings (booking_code, user_id, showtime_id, total_amount, booking_status,
                      cancelled_at, cancellation_reason, created_at)
SELECT booking_code, user_id, showtime_id, SUM(ticket_price), booking_status,
       IF(booking_status = 'CANCELLED', ordered_at + INTERVAL 30 MINUTE, NULL),
       IF(booking_status = 'CANCELLED', 'Khách đổi lịch (demo)', NULL),
       ordered_at
FROM demo_ticket_rows
GROUP BY booking_code, user_id, showtime_id, booking_status, ordered_at;

INSERT INTO booking_details (ticket_code, hold_token, showtime_id, ticket_status,
                             booking_id, seat_id, ticket_price, created_at)
SELECT CONCAT('DEMO-TK-', d.showtime_id, '-', d.seat_id),
       CONCAT('demo:', d.showtime_id, ':', d.seat_id), d.showtime_id,
       CASE WHEN d.booking_status = 'CANCELLED' THEN 'REFUNDED'
            WHEN d.show_status = 'COMPLETED' THEN 'USED'
            ELSE 'VALID' END,
       b.booking_id, d.seat_id, d.ticket_price, d.ordered_at
FROM demo_ticket_rows d JOIN bookings b ON b.booking_code = d.booking_code COLLATE utf8mb4_unicode_ci;

UPDATE showtime_seats ss
JOIN demo_ticket_rows d ON d.showtime_id = ss.showtime_id AND d.seat_id = ss.seat_id
JOIN bookings b ON b.booking_code = d.booking_code COLLATE utf8mb4_unicode_ci
SET ss.booking_id = b.booking_id, ss.seat_status = 'BOOKED'
WHERE d.booking_status = 'CONFIRMED';

-- 16.6 Thanh toán và hoàn tiền giả lập cho báo cáo.
-- Không có Stripe ID thật. Các đơn hoàn tiền không tính vào doanh thu thực nhận.
INSERT INTO payments (booking_id, payment_method, transaction_code, amount, payment_status,
                      refund_id, refund_amount, paid_at, refunded_at, created_at)
SELECT b.booking_id,
       ELT(1 + MOD(b.showtime_id + MIN(d.slot), 4), 'MOMO', 'VNPAY', 'ZALOPAY', 'CASH'),
       CONCAT('DEMO-PAY-', b.booking_code), b.total_amount,
       IF(b.booking_status = 'CANCELLED', 'REFUNDED', 'SUCCESS'),
       IF(b.booking_status = 'CANCELLED', CONCAT('DEMO-REFUND-', b.booking_code), NULL),
       IF(b.booking_status = 'CANCELLED', b.total_amount, 0),
       b.created_at + INTERVAL 2 MINUTE, b.cancelled_at, b.created_at
FROM bookings b JOIN demo_ticket_rows d ON b.booking_code = d.booking_code COLLATE utf8mb4_unicode_ci
GROUP BY b.booking_id, b.showtime_id, b.booking_code, b.total_amount,
         b.booking_status, b.created_at, b.cancelled_at;

DROP TEMPORARY TABLE demo_ticket_rows;
COMMIT;
