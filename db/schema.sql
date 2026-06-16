SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_code (code),
    UNIQUE KEY uq_roles_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    role_id BIGINT UNSIGNED NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NULL,
    full_name VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_phone (phone),
    KEY idx_users_role_id (role_id),
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE stations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(16) NOT NULL,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(120) NOT NULL,
    address VARCHAR(255) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stations_code (code),
    UNIQUE KEY uq_stations_name_city (name, city)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE routes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(150) NOT NULL,
    origin_station_id BIGINT UNSIGNED NOT NULL,
    destination_station_id BIGINT UNSIGNED NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_routes_code (code),
    KEY idx_routes_origin_station_id (origin_station_id),
    KEY idx_routes_destination_station_id (destination_station_id),
    CONSTRAINT fk_routes_origin_station
        FOREIGN KEY (origin_station_id) REFERENCES stations (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_routes_destination_station
        FOREIGN KEY (destination_station_id) REFERENCES stations (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE route_stations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    route_id BIGINT UNSIGNED NOT NULL,
    station_id BIGINT UNSIGNED NOT NULL,
    stop_order INT UNSIGNED NOT NULL,
    arrival_offset_minutes INT UNSIGNED NULL,
    departure_offset_minutes INT UNSIGNED NULL,
    stop_duration_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    distance_from_origin_km DECIMAL(8,2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_route_stations_route_order (route_id, stop_order),
    UNIQUE KEY uq_route_stations_route_station (route_id, station_id),
    KEY idx_route_stations_station_id (station_id),
    CONSTRAINT chk_route_stations_offsets CHECK (
        departure_offset_minutes IS NULL
        OR arrival_offset_minutes IS NULL
        OR departure_offset_minutes >= arrival_offset_minutes
    ),
    CONSTRAINT fk_route_stations_route
        FOREIGN KEY (route_id) REFERENCES routes (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_route_stations_station
        FOREIGN KEY (station_id) REFERENCES stations (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE trains (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_trains_code (code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE carriages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    train_id BIGINT UNSIGNED NOT NULL,
    carriage_number VARCHAR(10) NOT NULL,
    carriage_type VARCHAR(50) NOT NULL,
    class_code VARCHAR(20) NOT NULL,
    seat_capacity INT UNSIGNED NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_carriages_train_number (train_id, carriage_number),
    KEY idx_carriages_train_id (train_id),
    CONSTRAINT chk_carriages_seat_capacity CHECK (seat_capacity > 0),
    CONSTRAINT fk_carriages_train
        FOREIGN KEY (train_id) REFERENCES trains (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE seats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    carriage_id BIGINT UNSIGNED NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    seat_type VARCHAR(50) NOT NULL,
    class_code VARCHAR(20) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_seats_carriage_number (carriage_id, seat_number),
    KEY idx_seats_carriage_id (carriage_id),
    CONSTRAINT fk_seats_carriage
        FOREIGN KEY (carriage_id) REFERENCES carriages (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE trips (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    route_id BIGINT UNSIGNED NOT NULL,
    train_id BIGINT UNSIGNED NOT NULL,
    trip_code VARCHAR(32) NOT NULL,
    departure_datetime DATETIME NOT NULL,
    arrival_datetime DATETIME NOT NULL,
    departure_date DATE AS (DATE(departure_datetime)) STORED,
    base_price DECIMAL(10,2) NOT NULL,
    status ENUM('scheduled', 'cancelled', 'completed') NOT NULL DEFAULT 'scheduled',
    sale_start_at DATETIME NULL,
    sale_end_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_trips_trip_code (trip_code),
    UNIQUE KEY uq_trips_train_departure (train_id, departure_datetime),
    KEY idx_trips_route_id (route_id),
    KEY idx_trips_departure_search (departure_date, status),
    CONSTRAINT chk_trips_dates CHECK (arrival_datetime > departure_datetime),
    CONSTRAINT chk_trips_price CHECK (base_price >= 0),
    CONSTRAINT chk_trips_sale_window CHECK (
        sale_start_at IS NULL
        OR sale_end_at IS NULL
        OR sale_end_at >= sale_start_at
    ),
    CONSTRAINT fk_trips_route
        FOREIGN KEY (route_id) REFERENCES routes (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_trips_train
        FOREIGN KEY (train_id) REFERENCES trains (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE bookings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_number VARCHAR(32) NOT NULL,
    trip_id BIGINT UNSIGNED NOT NULL,
    carriage_id BIGINT UNSIGNED NOT NULL,
    seat_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    passenger_full_name VARCHAR(150) NOT NULL,
    passenger_document_number VARCHAR(50) NULL,
    source_channel ENUM('passenger', 'cashier') NOT NULL DEFAULT 'passenger',
    status ENUM('reserved', 'paid', 'cancelled', 'refunded', 'expired') NOT NULL,
    reserved_until DATETIME NULL,
    paid_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    refunded_at DATETIME NULL,
    total_price DECIMAL(10,2) NOT NULL,
    active_trip_seat_key VARCHAR(96)
        AS (
            CASE
                WHEN status IN ('reserved', 'paid')
                THEN CONCAT(trip_id, ':', carriage_id, ':', seat_id)
                ELSE NULL
            END
        ) STORED,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bookings_booking_number (booking_number),
    UNIQUE KEY uq_bookings_active_trip_seat (active_trip_seat_key),
    KEY idx_bookings_user_id (user_id),
    KEY idx_bookings_created_by_user_id (created_by_user_id),
    KEY idx_bookings_trip_status (trip_id, status),
    KEY idx_bookings_trip_carriage_seat (trip_id, carriage_id, seat_id),
    KEY idx_bookings_reserved_until (reserved_until),
    CONSTRAINT chk_bookings_price CHECK (total_price >= 0),
    CONSTRAINT chk_bookings_status_dates CHECK (
        (status = 'reserved' AND reserved_until IS NOT NULL AND paid_at IS NULL AND refunded_at IS NULL)
        OR (status = 'paid' AND paid_at IS NOT NULL)
        OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
        OR (status = 'expired' AND cancelled_at IS NOT NULL)
        OR (status = 'refunded' AND paid_at IS NOT NULL AND refunded_at IS NOT NULL)
    ),
    CONSTRAINT fk_bookings_trip
        FOREIGN KEY (trip_id) REFERENCES trips (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_carriage
        FOREIGN KEY (carriage_id) REFERENCES carriages (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_seat
        FOREIGN KEY (seat_id) REFERENCES seats (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE tickets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    ticket_number VARCHAR(32) NOT NULL,
    ticket_status ENUM('issued', 'refunded', 'void') NOT NULL DEFAULT 'issued',
    issued_at DATETIME NOT NULL,
    refunded_at DATETIME NULL,
    qr_payload VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tickets_booking_id (booking_id),
    UNIQUE KEY uq_tickets_ticket_number (ticket_number),
    KEY idx_tickets_status (ticket_status),
    CONSTRAINT chk_tickets_refund_dates CHECK (
        (ticket_status = 'issued' AND refunded_at IS NULL)
        OR (ticket_status IN ('refunded', 'void'))
    ),
    CONSTRAINT fk_tickets_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    processed_by_user_id BIGINT UNSIGNED NULL,
    payment_reference VARCHAR(64) NOT NULL,
    payment_method ENUM('demo', 'cash', 'card') NOT NULL DEFAULT 'demo',
    status ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    amount DECIMAL(10,2) NOT NULL,
    paid_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_reference (payment_reference),
    KEY idx_payments_booking_id (booking_id),
    KEY idx_payments_status (status),
    KEY idx_payments_processed_by_user_id (processed_by_user_id),
    CONSTRAINT chk_payments_amount CHECK (amount >= 0),
    CONSTRAINT chk_payments_status_dates CHECK (
        (status = 'succeeded' AND paid_at IS NOT NULL)
        OR (status <> 'succeeded')
    ),
    CONSTRAINT fk_payments_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_payments_processed_by_user
        FOREIGN KEY (processed_by_user_id) REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id BIGINT UNSIGNED NOT NULL,
    booking_id BIGINT UNSIGNED NOT NULL,
    payment_id BIGINT UNSIGNED NULL,
    processed_by_user_id BIGINT UNSIGNED NULL,
    refund_reference VARCHAR(64) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason VARCHAR(255) NULL,
    status ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
    refunded_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_refunds_ticket_id (ticket_id),
    UNIQUE KEY uq_refunds_booking_id (booking_id),
    UNIQUE KEY uq_refunds_reference (refund_reference),
    KEY idx_refunds_payment_id (payment_id),
    KEY idx_refunds_processed_by_user_id (processed_by_user_id),
    KEY idx_refunds_status (status),
    CONSTRAINT chk_refunds_amount CHECK (amount >= 0),
    CONSTRAINT chk_refunds_status_dates CHECK (
        (status = 'completed' AND refunded_at IS NOT NULL)
        OR (status <> 'completed')
    ),
    CONSTRAINT fk_refunds_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_refunds_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_refunds_payment
        FOREIGN KEY (payment_id) REFERENCES payments (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_refunds_processed_by_user
        FOREIGN KEY (processed_by_user_id) REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE operation_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_user_id BIGINT UNSIGNED NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    result_status ENUM('success', 'failure') NOT NULL,
    ip_address VARCHAR(45) NULL,
    details JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_operation_logs_actor_user_id (actor_user_id),
    KEY idx_operation_logs_entity (entity_type, entity_id),
    KEY idx_operation_logs_action_created_at (action, created_at),
    CONSTRAINT fk_operation_logs_actor_user
        FOREIGN KEY (actor_user_id) REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT chk_operation_logs_details_json CHECK (
        details IS NULL OR JSON_VALID(details)
    )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO roles (code, name, description) VALUES
    ('passenger', 'Пасажир', 'Користувач, який шукає рейси, бронює та оплачує квитки.'),
    ('cashier', 'Касир', 'Співробітник, який може оформлювати продажі та повернення через службовий інтерфейс.'),
    ('admin', 'Адміністратор', 'Користувач з доступом до керування довідниками та журналами операцій.');
