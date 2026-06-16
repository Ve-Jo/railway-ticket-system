SET NAMES utf8mb4;

-- Manual smoke checks for booking/payment/ticket/refund flows.
-- Usage:
-- 1. Set the booking id created by the API scenario.
-- 2. Run the relevant SELECT blocks after each HTTP step.

SET @booking_id := 1;

-- Optional helper: inspect demo trips before running scenarios.
SELECT
    t.id,
    t.trip_code,
    DATE_FORMAT(t.departure_datetime, '%Y-%m-%d %H:%i:%s') AS departure_at,
    r.name AS route_name,
    t.base_price,
    t.status
FROM trips t
JOIN routes r ON r.id = t.route_id
ORDER BY t.departure_datetime, t.id;

-- 1. Main booking snapshot.
SELECT
    b.id,
    b.booking_number,
    b.status,
    b.source_channel,
    b.trip_id,
    tr.trip_code,
    c.carriage_number,
    s.seat_number,
    b.user_id,
    u.username,
    b.created_by_user_id,
    creator.username AS created_by_username,
    b.passenger_full_name,
    b.total_price,
    DATE_FORMAT(b.reserved_until, '%Y-%m-%d %H:%i:%s') AS reserved_until,
    DATE_FORMAT(b.paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
    DATE_FORMAT(b.cancelled_at, '%Y-%m-%d %H:%i:%s') AS cancelled_at,
    DATE_FORMAT(b.refunded_at, '%Y-%m-%d %H:%i:%s') AS refunded_at,
    b.active_trip_seat_key,
    DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(b.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
FROM bookings b
JOIN trips tr ON tr.id = b.trip_id
JOIN carriages c ON c.id = b.carriage_id
JOIN seats s ON s.id = b.seat_id
JOIN users u ON u.id = b.user_id
LEFT JOIN users creator ON creator.id = b.created_by_user_id
WHERE b.id = @booking_id;

-- 2. Seat collision check for the same trip/carriage/seat.
-- Expectation:
-- - reserved/paid flow -> exactly 1 active row
-- - cancelled/expired/refunded flow -> 0 active rows
SELECT
    b.trip_id,
    b.carriage_id,
    b.seat_id,
    COUNT(*) AS active_rows,
    GROUP_CONCAT(CONCAT(b.id, ':', b.status) ORDER BY b.id SEPARATOR ', ') AS active_bookings
FROM bookings b
WHERE (b.trip_id, b.carriage_id, b.seat_id) = (
    SELECT trip_id, carriage_id, seat_id
    FROM bookings
    WHERE id = @booking_id
)
AND b.status IN ('reserved', 'paid')
GROUP BY b.trip_id, b.carriage_id, b.seat_id;

-- 3. Payment records linked to the booking.
SELECT
    p.id,
    p.payment_reference,
    p.payment_method,
    p.status,
    p.amount,
    DATE_FORMAT(p.paid_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
    p.processed_by_user_id,
    processor.username AS processed_by_username,
    DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(p.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
FROM payments p
LEFT JOIN users processor ON processor.id = p.processed_by_user_id
WHERE p.booking_id = @booking_id
ORDER BY p.id;

-- 4. Ticket state linked to the booking.
SELECT
    tk.id,
    tk.ticket_number,
    tk.ticket_status,
    DATE_FORMAT(tk.issued_at, '%Y-%m-%d %H:%i:%s') AS issued_at,
    DATE_FORMAT(tk.refunded_at, '%Y-%m-%d %H:%i:%s') AS refunded_at,
    tk.qr_payload,
    DATE_FORMAT(tk.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(tk.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
FROM tickets tk
WHERE tk.booking_id = @booking_id;

-- 5. Refund state linked to the booking.
SELECT
    r.id,
    r.refund_reference,
    r.status,
    r.amount,
    r.reason,
    DATE_FORMAT(r.refunded_at, '%Y-%m-%d %H:%i:%s') AS refunded_at,
    r.payment_id,
    r.processed_by_user_id,
    processor.username AS processed_by_username,
    DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(r.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
FROM refunds r
LEFT JOIN users processor ON processor.id = r.processed_by_user_id
WHERE r.booking_id = @booking_id;

-- 6. Unified lifecycle snapshot in one row.
SELECT
    b.id AS booking_id,
    b.status AS booking_status,
    b.total_price,
    p.id AS payment_id,
    p.status AS payment_status,
    p.amount AS payment_amount,
    tk.id AS ticket_id,
    tk.ticket_status,
    r.id AS refund_id,
    r.status AS refund_status
FROM bookings b
LEFT JOIN payments p ON p.booking_id = b.id
LEFT JOIN tickets tk ON tk.booking_id = b.id
LEFT JOIN refunds r ON r.booking_id = b.id
WHERE b.id = @booking_id;

-- 7. Optional operation log entries for booking/ticket/refund entities.
-- Run this block only if operation logging has been implemented in the backend.
SELECT
    ol.id,
    ol.entity_type,
    ol.entity_id,
    ol.action,
    ol.result_status,
    ol.actor_user_id,
    actor.username AS actor_username,
    ol.details,
    DATE_FORMAT(ol.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
FROM operation_logs ol
LEFT JOIN users actor ON actor.id = ol.actor_user_id
WHERE (ol.entity_type = 'booking' AND ol.entity_id = @booking_id)
   OR (ol.entity_type = 'ticket' AND ol.entity_id IN (
        SELECT id FROM tickets WHERE booking_id = @booking_id
   ))
   OR (ol.entity_type = 'refund' AND ol.entity_id IN (
        SELECT id FROM refunds WHERE booking_id = @booking_id
   ))
ORDER BY ol.id;

-- 8. Seat map for the trip to verify visible status changes around the checked seat.
SELECT
    c.carriage_number,
    s.seat_number,
    COALESCE(active_booking.status, 'available') AS seat_status,
    active_booking.id AS active_booking_id,
    active_booking.user_id AS active_booking_user_id
FROM seats s
JOIN carriages c ON c.id = s.carriage_id
LEFT JOIN (
    SELECT b1.trip_id, b1.carriage_id, b1.seat_id, b1.id, b1.status, b1.user_id
    FROM bookings b1
    WHERE b1.status IN ('reserved', 'paid')
) active_booking
    ON active_booking.carriage_id = s.carriage_id
   AND active_booking.seat_id = s.id
   AND active_booking.trip_id = (SELECT trip_id FROM bookings WHERE id = @booking_id)
WHERE s.carriage_id IN (
    SELECT carriage_id FROM bookings WHERE id = @booking_id
)
ORDER BY c.carriage_number, s.seat_number;
