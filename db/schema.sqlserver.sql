SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE roles (
    id BIGINT IDENTITY(1,1) NOT NULL,
    code VARCHAR(32) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(255) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_roles_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_roles_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_roles PRIMARY KEY (id),
    CONSTRAINT UQ_roles_code UNIQUE (code),
    CONSTRAINT UQ_roles_name UNIQUE (name)
);
GO

CREATE TABLE users (
    id BIGINT IDENTITY(1,1) NOT NULL,
    role_id BIGINT NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NULL,
    full_name NVARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_users_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_users_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_users PRIMARY KEY (id),
    CONSTRAINT UQ_users_username UNIQUE (username),
    CONSTRAINT UQ_users_email UNIQUE (email),
    CONSTRAINT FK_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
);
GO

CREATE UNIQUE INDEX IX_users_phone_unique
ON users (phone)
WHERE phone IS NOT NULL;
GO

CREATE TABLE stations (
    id BIGINT IDENTITY(1,1) NOT NULL,
    code VARCHAR(16) NOT NULL,
    name NVARCHAR(150) NOT NULL,
    city NVARCHAR(120) NOT NULL,
    address NVARCHAR(255) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_stations_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_stations_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_stations_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_stations PRIMARY KEY (id),
    CONSTRAINT UQ_stations_code UNIQUE (code),
    CONSTRAINT UQ_stations_name_city UNIQUE (name, city)
);
GO

CREATE TABLE routes (
    id BIGINT IDENTITY(1,1) NOT NULL,
    code VARCHAR(32) NOT NULL,
    name NVARCHAR(150) NOT NULL,
    origin_station_id BIGINT NOT NULL,
    destination_station_id BIGINT NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_routes_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_routes_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_routes_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_routes PRIMARY KEY (id),
    CONSTRAINT UQ_routes_code UNIQUE (code),
    CONSTRAINT FK_routes_origin_station FOREIGN KEY (origin_station_id) REFERENCES stations (id),
    CONSTRAINT FK_routes_destination_station FOREIGN KEY (destination_station_id) REFERENCES stations (id)
);
GO

CREATE INDEX IX_routes_origin_station_id ON routes (origin_station_id);
CREATE INDEX IX_routes_destination_station_id ON routes (destination_station_id);
GO

CREATE TABLE route_stations (
    id BIGINT IDENTITY(1,1) NOT NULL,
    route_id BIGINT NOT NULL,
    station_id BIGINT NOT NULL,
    stop_order INT NOT NULL,
    arrival_offset_minutes INT NULL,
    departure_offset_minutes INT NULL,
    stop_duration_minutes INT NOT NULL CONSTRAINT DF_route_stations_stop_duration_minutes DEFAULT 0,
    distance_from_origin_km DECIMAL(8,2) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_route_stations_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_route_stations_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_route_stations PRIMARY KEY (id),
    CONSTRAINT UQ_route_stations_route_order UNIQUE (route_id, stop_order),
    CONSTRAINT UQ_route_stations_route_station UNIQUE (route_id, station_id),
    CONSTRAINT CK_route_stations_stop_order_nonnegative CHECK (stop_order >= 0),
    CONSTRAINT CK_route_stations_arrival_offset_nonnegative CHECK (arrival_offset_minutes IS NULL OR arrival_offset_minutes >= 0),
    CONSTRAINT CK_route_stations_departure_offset_nonnegative CHECK (departure_offset_minutes IS NULL OR departure_offset_minutes >= 0),
    CONSTRAINT CK_route_stations_stop_duration_nonnegative CHECK (stop_duration_minutes >= 0),
    CONSTRAINT CK_route_stations_offsets CHECK (
        departure_offset_minutes IS NULL
        OR arrival_offset_minutes IS NULL
        OR departure_offset_minutes >= arrival_offset_minutes
    ),
    CONSTRAINT FK_route_stations_route FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE,
    CONSTRAINT FK_route_stations_station FOREIGN KEY (station_id) REFERENCES stations (id)
);
GO

CREATE INDEX IX_route_stations_station_id ON route_stations (station_id);
GO

CREATE TABLE trains (
    id BIGINT IDENTITY(1,1) NOT NULL,
    code VARCHAR(32) NOT NULL,
    name NVARCHAR(150) NOT NULL,
    category NVARCHAR(50) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_trains_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_trains_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_trains_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_trains PRIMARY KEY (id),
    CONSTRAINT UQ_trains_code UNIQUE (code)
);
GO

CREATE TABLE carriages (
    id BIGINT IDENTITY(1,1) NOT NULL,
    train_id BIGINT NOT NULL,
    carriage_number VARCHAR(10) NOT NULL,
    carriage_type NVARCHAR(50) NOT NULL,
    class_code VARCHAR(20) NOT NULL,
    seat_capacity INT NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_carriages_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_carriages_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_carriages_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_carriages PRIMARY KEY (id),
    CONSTRAINT UQ_carriages_train_number UNIQUE (train_id, carriage_number),
    CONSTRAINT CK_carriages_seat_capacity CHECK (seat_capacity > 0),
    CONSTRAINT FK_carriages_train FOREIGN KEY (train_id) REFERENCES trains (id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_carriages_train_id ON carriages (train_id);
GO

CREATE TABLE seats (
    id BIGINT IDENTITY(1,1) NOT NULL,
    carriage_id BIGINT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    seat_type NVARCHAR(50) NOT NULL,
    class_code VARCHAR(20) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_seats_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_seats_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_seats_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_seats PRIMARY KEY (id),
    CONSTRAINT UQ_seats_carriage_number UNIQUE (carriage_id, seat_number),
    CONSTRAINT FK_seats_carriage FOREIGN KEY (carriage_id) REFERENCES carriages (id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_seats_carriage_id ON seats (carriage_id);
GO

CREATE TABLE trips (
    id BIGINT IDENTITY(1,1) NOT NULL,
    route_id BIGINT NOT NULL,
    train_id BIGINT NOT NULL,
    trip_code VARCHAR(32) NOT NULL,
    departure_datetime DATETIME2(0) NOT NULL,
    arrival_datetime DATETIME2(0) NOT NULL,
    departure_date AS CAST(departure_datetime AS DATE) PERSISTED,
    base_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_trips_status DEFAULT 'scheduled',
    sale_start_at DATETIME2(0) NULL,
    sale_end_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_trips_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_trips_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_trips PRIMARY KEY (id),
    CONSTRAINT UQ_trips_trip_code UNIQUE (trip_code),
    CONSTRAINT UQ_trips_train_departure UNIQUE (train_id, departure_datetime),
    CONSTRAINT CK_trips_status CHECK (status IN ('scheduled', 'cancelled', 'completed')),
    CONSTRAINT CK_trips_dates CHECK (arrival_datetime > departure_datetime),
    CONSTRAINT CK_trips_price CHECK (base_price >= 0),
    CONSTRAINT CK_trips_sale_window CHECK (
        sale_start_at IS NULL
        OR sale_end_at IS NULL
        OR sale_end_at >= sale_start_at
    ),
    CONSTRAINT FK_trips_route FOREIGN KEY (route_id) REFERENCES routes (id),
    CONSTRAINT FK_trips_train FOREIGN KEY (train_id) REFERENCES trains (id)
);
GO

CREATE INDEX IX_trips_route_id ON trips (route_id);
CREATE INDEX IX_trips_departure_search ON trips (departure_date, status);
GO

CREATE TABLE bookings (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_number VARCHAR(32) NOT NULL,
    trip_id BIGINT NOT NULL,
    carriage_id BIGINT NOT NULL,
    seat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_by_user_id BIGINT NULL,
    passenger_full_name NVARCHAR(150) NOT NULL,
    passenger_document_number VARCHAR(50) NULL,
    source_channel VARCHAR(20) NOT NULL CONSTRAINT DF_bookings_source_channel DEFAULT 'passenger',
    status VARCHAR(20) NOT NULL,
    reserved_until DATETIME2(0) NULL,
    paid_at DATETIME2(0) NULL,
    cancelled_at DATETIME2(0) NULL,
    refunded_at DATETIME2(0) NULL,
    total_price DECIMAL(10,2) NOT NULL,
    active_trip_seat_key AS (
        CASE
            WHEN status IN ('reserved', 'paid')
            THEN CONCAT(CONVERT(VARCHAR(20), trip_id), ':', CONVERT(VARCHAR(20), carriage_id), ':', CONVERT(VARCHAR(20), seat_id))
            ELSE NULL
        END
    ) PERSISTED,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_bookings_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_bookings_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_bookings PRIMARY KEY (id),
    CONSTRAINT UQ_bookings_booking_number UNIQUE (booking_number),
    CONSTRAINT CK_bookings_source_channel CHECK (source_channel IN ('passenger', 'cashier')),
    CONSTRAINT CK_bookings_status CHECK (status IN ('reserved', 'paid', 'cancelled', 'refunded', 'expired')),
    CONSTRAINT CK_bookings_price CHECK (total_price >= 0),
    CONSTRAINT CK_bookings_status_dates CHECK (
        (status = 'reserved' AND reserved_until IS NOT NULL AND paid_at IS NULL AND refunded_at IS NULL)
        OR (status = 'paid' AND paid_at IS NOT NULL)
        OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
        OR (status = 'expired' AND cancelled_at IS NOT NULL)
        OR (status = 'refunded' AND paid_at IS NOT NULL AND refunded_at IS NOT NULL)
    ),
    CONSTRAINT FK_bookings_trip FOREIGN KEY (trip_id) REFERENCES trips (id),
    CONSTRAINT FK_bookings_carriage FOREIGN KEY (carriage_id) REFERENCES carriages (id),
    CONSTRAINT FK_bookings_seat FOREIGN KEY (seat_id) REFERENCES seats (id),
    CONSTRAINT FK_bookings_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT FK_bookings_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
);
GO

CREATE UNIQUE INDEX IX_bookings_active_trip_seat_unique
ON bookings (active_trip_seat_key)
WHERE active_trip_seat_key IS NOT NULL;
GO

CREATE INDEX IX_bookings_user_id ON bookings (user_id);
CREATE INDEX IX_bookings_created_by_user_id ON bookings (created_by_user_id);
CREATE INDEX IX_bookings_trip_status ON bookings (trip_id, status);
CREATE INDEX IX_bookings_trip_carriage_seat ON bookings (trip_id, carriage_id, seat_id);
CREATE INDEX IX_bookings_reserved_until ON bookings (reserved_until);
GO

CREATE TABLE tickets (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id BIGINT NOT NULL,
    ticket_number VARCHAR(32) NOT NULL,
    ticket_status VARCHAR(20) NOT NULL CONSTRAINT DF_tickets_ticket_status DEFAULT 'issued',
    issued_at DATETIME2(0) NOT NULL,
    refunded_at DATETIME2(0) NULL,
    qr_payload NVARCHAR(255) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_tickets_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_tickets_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_tickets PRIMARY KEY (id),
    CONSTRAINT UQ_tickets_booking_id UNIQUE (booking_id),
    CONSTRAINT UQ_tickets_ticket_number UNIQUE (ticket_number),
    CONSTRAINT CK_tickets_status CHECK (ticket_status IN ('issued', 'refunded', 'void')),
    CONSTRAINT CK_tickets_refund_dates CHECK (
        (ticket_status = 'issued' AND refunded_at IS NULL)
        OR (ticket_status IN ('refunded', 'void'))
    ),
    CONSTRAINT FK_tickets_booking FOREIGN KEY (booking_id) REFERENCES bookings (id)
);
GO

CREATE INDEX IX_tickets_status ON tickets (ticket_status);
GO

CREATE TABLE payments (
    id BIGINT IDENTITY(1,1) NOT NULL,
    booking_id BIGINT NOT NULL,
    processed_by_user_id BIGINT NULL,
    payment_reference VARCHAR(64) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CONSTRAINT DF_payments_payment_method DEFAULT 'demo',
    status VARCHAR(20) NOT NULL CONSTRAINT DF_payments_status DEFAULT 'pending',
    amount DECIMAL(10,2) NOT NULL,
    paid_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_payments_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_payments_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_payments PRIMARY KEY (id),
    CONSTRAINT UQ_payments_reference UNIQUE (payment_reference),
    CONSTRAINT CK_payments_payment_method CHECK (payment_method IN ('demo', 'cash', 'card')),
    CONSTRAINT CK_payments_status CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded')),
    CONSTRAINT CK_payments_amount CHECK (amount >= 0),
    CONSTRAINT CK_payments_status_dates CHECK (
        (status = 'succeeded' AND paid_at IS NOT NULL)
        OR (status <> 'succeeded')
    ),
    CONSTRAINT FK_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings (id),
    CONSTRAINT FK_payments_processed_by_user FOREIGN KEY (processed_by_user_id) REFERENCES users (id) ON DELETE SET NULL
);
GO

CREATE INDEX IX_payments_booking_id ON payments (booking_id);
CREATE INDEX IX_payments_status ON payments (status);
CREATE INDEX IX_payments_processed_by_user_id ON payments (processed_by_user_id);
GO

CREATE TABLE refunds (
    id BIGINT IDENTITY(1,1) NOT NULL,
    ticket_id BIGINT NOT NULL,
    booking_id BIGINT NOT NULL,
    payment_id BIGINT NULL,
    processed_by_user_id BIGINT NULL,
    refund_reference VARCHAR(64) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason NVARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_refunds_status DEFAULT 'pending',
    refunded_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_refunds_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_refunds_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_refunds PRIMARY KEY (id),
    CONSTRAINT UQ_refunds_ticket_id UNIQUE (ticket_id),
    CONSTRAINT UQ_refunds_booking_id UNIQUE (booking_id),
    CONSTRAINT UQ_refunds_reference UNIQUE (refund_reference),
    CONSTRAINT CK_refunds_status CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    CONSTRAINT CK_refunds_amount CHECK (amount >= 0),
    CONSTRAINT CK_refunds_status_dates CHECK (
        (status = 'completed' AND refunded_at IS NOT NULL)
        OR (status <> 'completed')
    ),
    CONSTRAINT FK_refunds_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id),
    CONSTRAINT FK_refunds_booking FOREIGN KEY (booking_id) REFERENCES bookings (id),
    CONSTRAINT FK_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE SET NULL,
    CONSTRAINT FK_refunds_processed_by_user FOREIGN KEY (processed_by_user_id) REFERENCES users (id) ON DELETE SET NULL
);
GO

CREATE INDEX IX_refunds_payment_id ON refunds (payment_id);
CREATE INDEX IX_refunds_processed_by_user_id ON refunds (processed_by_user_id);
CREATE INDEX IX_refunds_status ON refunds (status);
GO

CREATE TABLE operation_logs (
    id BIGINT IDENTITY(1,1) NOT NULL,
    actor_user_id BIGINT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NULL,
    action VARCHAR(100) NOT NULL,
    result_status VARCHAR(20) NOT NULL,
    ip_address VARCHAR(45) NULL,
    details NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_operation_logs_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_operation_logs PRIMARY KEY (id),
    CONSTRAINT CK_operation_logs_result_status CHECK (result_status IN ('success', 'failure')),
    CONSTRAINT CK_operation_logs_details_json CHECK (details IS NULL OR ISJSON(details) = 1),
    CONSTRAINT FK_operation_logs_actor_user FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
);
GO

CREATE INDEX IX_operation_logs_actor_user_id ON operation_logs (actor_user_id);
CREATE INDEX IX_operation_logs_entity ON operation_logs (entity_type, entity_id);
CREATE INDEX IX_operation_logs_action_created_at ON operation_logs (action, created_at);
GO

CREATE TRIGGER TR_roles_set_updated_at ON roles
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE r
    SET updated_at = SYSUTCDATETIME()
    FROM roles r
    INNER JOIN inserted i ON i.id = r.id;
END;
GO

CREATE TRIGGER TR_users_set_updated_at ON users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE u
    SET updated_at = SYSUTCDATETIME()
    FROM users u
    INNER JOIN inserted i ON i.id = u.id;
END;
GO

CREATE TRIGGER TR_stations_set_updated_at ON stations
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE s
    SET updated_at = SYSUTCDATETIME()
    FROM stations s
    INNER JOIN inserted i ON i.id = s.id;
END;
GO

CREATE TRIGGER TR_routes_set_updated_at ON routes
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE r
    SET updated_at = SYSUTCDATETIME()
    FROM routes r
    INNER JOIN inserted i ON i.id = r.id;
END;
GO

CREATE TRIGGER TR_route_stations_set_updated_at ON route_stations
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE rs
    SET updated_at = SYSUTCDATETIME()
    FROM route_stations rs
    INNER JOIN inserted i ON i.id = rs.id;
END;
GO

CREATE TRIGGER TR_trains_set_updated_at ON trains
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE t
    SET updated_at = SYSUTCDATETIME()
    FROM trains t
    INNER JOIN inserted i ON i.id = t.id;
END;
GO

CREATE TRIGGER TR_carriages_set_updated_at ON carriages
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c
    SET updated_at = SYSUTCDATETIME()
    FROM carriages c
    INNER JOIN inserted i ON i.id = c.id;
END;
GO

CREATE TRIGGER TR_seats_set_updated_at ON seats
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE s
    SET updated_at = SYSUTCDATETIME()
    FROM seats s
    INNER JOIN inserted i ON i.id = s.id;
END;
GO

CREATE TRIGGER TR_trips_set_updated_at ON trips
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE t
    SET updated_at = SYSUTCDATETIME()
    FROM trips t
    INNER JOIN inserted i ON i.id = t.id;
END;
GO

CREATE TRIGGER TR_bookings_set_updated_at ON bookings
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE b
    SET updated_at = SYSUTCDATETIME()
    FROM bookings b
    INNER JOIN inserted i ON i.id = b.id;
END;
GO

CREATE TRIGGER TR_tickets_set_updated_at ON tickets
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE t
    SET updated_at = SYSUTCDATETIME()
    FROM tickets t
    INNER JOIN inserted i ON i.id = t.id;
END;
GO

CREATE TRIGGER TR_payments_set_updated_at ON payments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
    SET updated_at = SYSUTCDATETIME()
    FROM payments p
    INNER JOIN inserted i ON i.id = p.id;
END;
GO

CREATE TRIGGER TR_refunds_set_updated_at ON refunds
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE r
    SET updated_at = SYSUTCDATETIME()
    FROM refunds r
    INNER JOIN inserted i ON i.id = r.id;
END;
GO

INSERT INTO roles (code, name, description) VALUES
    ('passenger', N'Пасажир', N'Користувач, який шукає рейси, бронює та оплачує квитки.'),
    ('cashier', N'Касир', N'Співробітник, який може оформлювати продажі та повернення через службовий інтерфейс.'),
    ('admin', N'Адміністратор', N'Користувач з доступом до керування довідниками та журналами операцій.');
GO
