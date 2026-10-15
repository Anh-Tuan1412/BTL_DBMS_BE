-- Fresh installations only. Existing databases require a reviewed data migration.
-- Requires MySQL 8.0.16+; all application DATETIME values are UTC.
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
-- 7. SHOWTIMES - Suất chiếu
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
    discount_value DECIMAL(10,2) NOT NULL, -- Giá trị giảm (% hoặc số tiền cụ thể)
    min_order_value DECIMAL(10,2) DEFAULT 0, -- Giá trị đơn hàng tối thiểu để áp dụng
    max_discount DECIMAL(10,2) NULL, -- Mức giảm tối đa (đối với giảm theo %)
    usage_limit INT NOT NULL DEFAULT 100, -- Số lượng mã có thể sử dụng
    used_count INT NOT NULL DEFAULT 0, -- Số lần đã được dùng
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    status ENUM('ACTIVE', 'EXPIRED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT chk_discount_value CHECK (discount_value > 0 AND (discount_type <> 'PERCENTAGE' OR discount_value <= 100)),
    CONSTRAINT chk_voucher_limits CHECK (usage_limit >= 0 AND used_count >= 0 AND used_count <= usage_limit),
    CONSTRAINT chk_voucher_amounts CHECK (min_order_value IS NOT NULL AND min_order_value >= 0 AND (max_discount IS NULL OR max_discount >= 0)),
    CONSTRAINT chk_voucher_dates CHECK (end_date > start_date)
) ENGINE=InnoDB;


-- =========================================================
-- 10. BOOKINGS - Đơn đặt vé (ĐÃ ĐƯỢC CHỈNH SỬA TÍCH HỢP VOUCHER)
-- =========================================================

CREATE TABLE IF NOT EXISTS bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(50) NOT NULL UNIQUE,

    user_id INT NOT NULL,
    showtime_id INT NOT NULL,
    voucher_id INT NULL, -- Liên kết mã giảm giá (nếu có sử dụng)

    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- Tổng tiền thanh toán cuối cùng
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- Số tiền được giảm từ voucher

    booking_status ENUM(
        'PENDING',
        'CONFIRMED',
        'CANCELLED',
        'EXPIRED'
    ) NOT NULL DEFAULT 'PENDING',

    -- Dùng cho booking đang giữ ghế (Redis quản lý TTL chính)
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
    CONSTRAINT chk_pending_expiry CHECK (booking_status <> 'PENDING' OR hold_expires_at IS NOT NULL),

    UNIQUE KEY uq_booking_showtime (booking_id, showtime_id),
    INDEX idx_bookings_user_created (user_id, created_at),
    INDEX idx_bookings_expiry (booking_status, hold_expires_at),

    INDEX idx_bookings_showtime (showtime_id),
    INDEX idx_bookings_status (booking_status),
    INDEX idx_bookings_created_at (created_at)
) ENGINE=InnoDB;


-- =========================================================
-- 11. BOOKING DETAILS - Chi tiết vé / ghế đã đặt
-- =========================================================

-- One inventory row per physical seat per screening. History remains in booking_details.
-- Composite foreign keys enforce the same room for both seat and screening.
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
-- 12. BOOKING COMBOS - Chi tiết bắp nước đi kèm đơn đặt vé 
-- =========================================================

CREATE TABLE IF NOT EXISTS booking_combos (
    booking_combo_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    combo_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL, -- Giá tại thời điểm mua

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


-- Stripe webhook inbox: insert event ID and change payment/booking state in one transaction.
-- This table does not replace signature verification in the future Stripe endpoint.
CREATE TABLE IF NOT EXISTS payment_events (
    stripe_event_id VARCHAR(255) PRIMARY KEY,
    payment_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 14. INDEX PHỤC VỤ TÌM KIẾM / LỌC
-- =========================================================

-- Indexes are declared in their CREATE TABLE statements.


-- =========================================================
-- 15. DỮ LIỆU MẪU KHỞI TẠO (SEED DATA)
-- =========================================================

INSERT INTO seat_types
    (type_name, price_coefficient)
VALUES
    ('REGULAR', 1.00),
    ('VIP', 1.20),
    ('COUPLE', 1.50)
ON DUPLICATE KEY UPDATE
    price_coefficient = VALUES(price_coefficient);

INSERT INTO combos (combo_name, description, price)
VALUES
    ('Combo Solo', '1 Bắp lớn + 1 Nước ngọt lớn', 75000.00),
    ('Combo Couple', '1 Bắp lớn + 2 Nước ngọt lớn', 99000.00)
ON DUPLICATE KEY UPDATE
    price = VALUES(price);
CREATE TABLE IF NOT EXISTS schema_metadata (
    version INT PRIMARY KEY,
    installed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
INSERT INTO schema_metadata (version) VALUES (2) ON DUPLICATE KEY UPDATE version = 2;
