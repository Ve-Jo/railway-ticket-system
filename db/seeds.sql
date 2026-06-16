SET NAMES utf8mb4;

START TRANSACTION;

SET @demo_password_hash = '$2a$10$ACnqgRQ8i0ddgOIn9DDlbO.7syxGqy6AyeMvT5.AJgU1MQx9MDzQm';

INSERT INTO users (role_id, username, email, phone, full_name, password_hash, is_active)
SELECT r.id, 'passenger_demo', 'passenger.demo@example.com', '+380500000001', CONVERT(0xD086D0B2D0B0D0BD20D09FD0B0D181D0B0D0B6D0B8D180 USING utf8mb4), @demo_password_hash, 1
FROM roles r
WHERE r.code = 'passenger'
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  username = VALUES(username),
  email = VALUES(email),
  phone = VALUES(phone),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  is_active = VALUES(is_active);

INSERT INTO users (role_id, username, email, phone, full_name, password_hash, is_active)
SELECT r.id, 'cashier_demo', 'cashier.demo@example.com', '+380500000002', CONVERT(0xD09ED0BBD18CD0B3D0B020D09AD0B0D181D0B8D180 USING utf8mb4), @demo_password_hash, 1
FROM roles r
WHERE r.code = 'cashier'
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  username = VALUES(username),
  email = VALUES(email),
  phone = VALUES(phone),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  is_active = VALUES(is_active);

INSERT INTO users (role_id, username, email, phone, full_name, password_hash, is_active)
SELECT r.id, 'admin_demo', 'admin.demo@example.com', '+380500000003', CONVERT(0xD09CD0B0D180D0B8D0BDD0B020D090D0B4D0BCD196D0BDD196D181D182D180D0B0D182D0BED180 USING utf8mb4), @demo_password_hash, 1
FROM roles r
WHERE r.code = 'admin'
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  username = VALUES(username),
  email = VALUES(email),
  phone = VALUES(phone),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  is_active = VALUES(is_active);

INSERT INTO stations (code, name, city, address, is_active)
SELECT 'KYIV-PAS', 'Київ-Пасажирський', 'Київ', 'Вокзальна площа, 1', 1
WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code = 'KYIV-PAS');

INSERT INTO stations (code, name, city, address, is_active)
SELECT 'VINN-TSN', 'Вінниця', 'Вінниця', 'площа Героїв Чорнобиля, 1', 1
WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code = 'VINN-TSN');

INSERT INTO stations (code, name, city, address, is_active)
SELECT 'KHM-TSN', 'Хмельницький', 'Хмельницький', 'Проскурівська, 10', 1
WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code = 'KHM-TSN');

INSERT INTO stations (code, name, city, address, is_active)
SELECT 'TERN-TSN', 'Тернопіль', 'Тернопіль', 'площа Перемоги, 1', 1
WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code = 'TERN-TSN');

INSERT INTO stations (code, name, city, address, is_active)
SELECT 'LVIV-PAS', 'Львів', 'Львів', 'площа Двірцева, 1', 1
WHERE NOT EXISTS (SELECT 1 FROM stations WHERE code = 'LVIV-PAS');

INSERT INTO routes (code, name, origin_station_id, destination_station_id, is_active)
SELECT
  'R-KYIV-LVIV',
  'Київ - Львів',
  s1.id,
  s2.id,
  1
FROM stations s1
CROSS JOIN stations s2
WHERE s1.code = 'KYIV-PAS'
  AND s2.code = 'LVIV-PAS'
  AND NOT EXISTS (SELECT 1 FROM routes WHERE code = 'R-KYIV-LVIV');

INSERT INTO routes (code, name, origin_station_id, destination_station_id, is_active)
SELECT
  'R-LVIV-KYIV',
  'Львів - Київ',
  s1.id,
  s2.id,
  1
FROM stations s1
CROSS JOIN stations s2
WHERE s1.code = 'LVIV-PAS'
  AND s2.code = 'KYIV-PAS'
  AND NOT EXISTS (SELECT 1 FROM routes WHERE code = 'R-LVIV-KYIV');

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 1, NULL, 0, 15, 0.00
FROM routes r
JOIN stations s ON s.code = 'KYIV-PAS'
WHERE r.code = 'R-KYIV-LVIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 2, 120, 130, 10, 270.00
FROM routes r
JOIN stations s ON s.code = 'VINN-TSN'
WHERE r.code = 'R-KYIV-LVIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 3, 220, 228, 8, 367.00
FROM routes r
JOIN stations s ON s.code = 'KHM-TSN'
WHERE r.code = 'R-KYIV-LVIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 4, 305, 313, 8, 489.00
FROM routes r
JOIN stations s ON s.code = 'TERN-TSN'
WHERE r.code = 'R-KYIV-LVIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 5, 420, NULL, 0, 540.00
FROM routes r
JOIN stations s ON s.code = 'LVIV-PAS'
WHERE r.code = 'R-KYIV-LVIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 1, NULL, 0, 20, 0.00
FROM routes r
JOIN stations s ON s.code = 'LVIV-PAS'
WHERE r.code = 'R-LVIV-KYIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 2, 108, 116, 8, 51.00
FROM routes r
JOIN stations s ON s.code = 'TERN-TSN'
WHERE r.code = 'R-LVIV-KYIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 3, 192, 200, 8, 173.00
FROM routes r
JOIN stations s ON s.code = 'KHM-TSN'
WHERE r.code = 'R-LVIV-KYIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 4, 286, 296, 10, 270.00
FROM routes r
JOIN stations s ON s.code = 'VINN-TSN'
WHERE r.code = 'R-LVIV-KYIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO route_stations (
  route_id,
  station_id,
  stop_order,
  arrival_offset_minutes,
  departure_offset_minutes,
  stop_duration_minutes,
  distance_from_origin_km
)
SELECT r.id, s.id, 5, 420, NULL, 0, 540.00
FROM routes r
JOIN stations s ON s.code = 'KYIV-PAS'
WHERE r.code = 'R-LVIV-KYIV'
  AND NOT EXISTS (
    SELECT 1 FROM route_stations rs WHERE rs.route_id = r.id AND rs.station_id = s.id
  );

INSERT INTO trains (code, name, category, is_active)
SELECT 'IC-701', 'Інтерсіті 701', 'Intercity', 1
WHERE NOT EXISTS (SELECT 1 FROM trains WHERE code = 'IC-701');

INSERT INTO carriages (train_id, carriage_number, carriage_type, class_code, seat_capacity, is_active)
SELECT t.id, '01', 'seated', 'first', 8, 1
FROM trains t
WHERE t.code = 'IC-701'
  AND NOT EXISTS (
    SELECT 1 FROM carriages c WHERE c.train_id = t.id AND c.carriage_number = '01'
  );

INSERT INTO carriages (train_id, carriage_number, carriage_type, class_code, seat_capacity, is_active)
SELECT t.id, '02', 'seated', 'second', 8, 1
FROM trains t
WHERE t.code = 'IC-701'
  AND NOT EXISTS (
    SELECT 1 FROM carriages c WHERE c.train_id = t.id AND c.carriage_number = '02'
  );

INSERT INTO carriages (train_id, carriage_number, carriage_type, class_code, seat_capacity, is_active)
SELECT t.id, '03', 'coupe', 'coupe', 8, 1
FROM trains t
WHERE t.code = 'IC-701'
  AND NOT EXISTS (
    SELECT 1 FROM carriages c WHERE c.train_id = t.id AND c.carriage_number = '03'
  );

INSERT INTO carriages (train_id, carriage_number, carriage_type, class_code, seat_capacity, is_active)
SELECT t.id, '04', 'lux', 'lux', 4, 1
FROM trains t
WHERE t.code = 'IC-701'
  AND NOT EXISTS (
    SELECT 1 FROM carriages c WHERE c.train_id = t.id AND c.carriage_number = '04'
  );

INSERT INTO carriages (train_id, carriage_number, carriage_type, class_code, seat_capacity, is_active)
SELECT t.id, '05', 'platzkart', 'platzkart', 12, 1
FROM trains t
WHERE t.code = 'IC-701'
  AND NOT EXISTS (
    SELECT 1 FROM carriages c WHERE c.train_id = t.id AND c.carriage_number = '05'
  );

INSERT INTO seats (carriage_id, seat_number, seat_type, class_code, is_active)
SELECT c.id, n.seat_number, 'window', c.class_code, 1
FROM carriages c
JOIN (
  SELECT '1A' AS seat_number UNION ALL
  SELECT '1B' UNION ALL
  SELECT '2A' UNION ALL
  SELECT '2B' UNION ALL
  SELECT '3A' UNION ALL
  SELECT '3B' UNION ALL
  SELECT '4A' UNION ALL
  SELECT '4B'
) n
WHERE c.carriage_number = '01'
  AND NOT EXISTS (
    SELECT 1 FROM seats s WHERE s.carriage_id = c.id AND s.seat_number = n.seat_number
  );

INSERT INTO seats (carriage_id, seat_number, seat_type, class_code, is_active)
SELECT c.id, n.seat_number, 'aisle', c.class_code, 1
FROM carriages c
JOIN (
  SELECT '5A' AS seat_number UNION ALL
  SELECT '5B' UNION ALL
  SELECT '6A' UNION ALL
  SELECT '6B' UNION ALL
  SELECT '7A' UNION ALL
  SELECT '7B' UNION ALL
  SELECT '8A' UNION ALL
  SELECT '8B'
) n
WHERE c.carriage_number = '02'
  AND NOT EXISTS (
    SELECT 1 FROM seats s WHERE s.carriage_id = c.id AND s.seat_number = n.seat_number
  );

INSERT INTO seats (carriage_id, seat_number, seat_type, class_code, is_active)
SELECT c.id, n.seat_number, n.seat_type, c.class_code, 1
FROM carriages c
JOIN (
  SELECT '1' AS seat_number, 'lower' AS seat_type UNION ALL
  SELECT '2', 'lower' UNION ALL
  SELECT '3', 'upper' UNION ALL
  SELECT '4', 'upper' UNION ALL
  SELECT '5', 'lower' UNION ALL
  SELECT '6', 'lower' UNION ALL
  SELECT '7', 'upper' UNION ALL
  SELECT '8', 'upper'
) n
WHERE c.carriage_number = '03'
  AND NOT EXISTS (
    SELECT 1 FROM seats s WHERE s.carriage_id = c.id AND s.seat_number = n.seat_number
  );

INSERT INTO seats (carriage_id, seat_number, seat_type, class_code, is_active)
SELECT c.id, n.seat_number, n.seat_type, c.class_code, 1
FROM carriages c
JOIN (
  SELECT '1' AS seat_number, 'lower' AS seat_type UNION ALL
  SELECT '2', 'lower' UNION ALL
  SELECT '3', 'lower' UNION ALL
  SELECT '4', 'lower'
) n
WHERE c.carriage_number = '04'
  AND NOT EXISTS (
    SELECT 1 FROM seats s WHERE s.carriage_id = c.id AND s.seat_number = n.seat_number
  );

INSERT INTO seats (carriage_id, seat_number, seat_type, class_code, is_active)
SELECT c.id, n.seat_number, n.seat_type, c.class_code, 1
FROM carriages c
JOIN (
  SELECT '1' AS seat_number, 'lower' AS seat_type UNION ALL
  SELECT '2', 'lower' UNION ALL
  SELECT '3', 'upper' UNION ALL
  SELECT '4', 'upper' UNION ALL
  SELECT '5', 'lower' UNION ALL
  SELECT '6', 'lower' UNION ALL
  SELECT '7', 'upper' UNION ALL
  SELECT '8', 'upper' UNION ALL
  SELECT '37', 'side-lower' UNION ALL
  SELECT '38', 'side-upper' UNION ALL
  SELECT '39', 'side-lower' UNION ALL
  SELECT '40', 'side-upper'
) n
WHERE c.carriage_number = '05'
  AND NOT EXISTS (
    SELECT 1 FROM seats s WHERE s.carriage_id = c.id AND s.seat_number = n.seat_number
  );

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT r.id, t.id, 'TRIP-701-20260701', '2026-07-01 07:00:00', '2026-07-01 14:00:00', 620.00, 'scheduled', '2026-06-15 08:00:00', '2026-07-01 06:30:00'
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-KYIV-LVIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT r.id, t.id, 'TRIP-701-20260702', '2026-07-02 07:00:00', '2026-07-02 14:00:00', 620.00, 'scheduled', '2026-06-16 08:00:00', '2026-07-02 06:30:00'
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-KYIV-LVIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT r.id, t.id, 'TRIP-702-20260703', '2026-07-03 16:00:00', '2026-07-03 23:00:00', 640.00, 'scheduled', '2026-06-17 08:00:00', '2026-07-03 15:30:00'
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-LVIV-KYIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT
  r.id,
  t.id,
  CONCAT('TRIP-701-', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '%Y%m%d')),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '18:20:00'),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '18:20:00') + INTERVAL 7 HOUR,
  605.00,
  'scheduled',
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 11 DAY), '08:00:00'),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:50:00')
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-KYIV-LVIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT
  r.id,
  t.id,
  CONCAT('TRIP-701-', DATE_FORMAT(CURDATE(), '%Y%m%d')),
  TIMESTAMP(CURDATE(), '07:15:00'),
  TIMESTAMP(CURDATE(), '07:15:00') + INTERVAL 7 HOUR,
  610.00,
  'scheduled',
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 10 DAY), '08:00:00'),
  TIMESTAMP(CURDATE(), '06:45:00')
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-KYIV-LVIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT
  r.id,
  t.id,
  CONCAT('TRIP-702-', DATE_FORMAT(CURDATE(), '%Y%m%d')),
  TIMESTAMP(CURDATE(), '16:40:00'),
  TIMESTAMP(CURDATE(), '16:40:00') + INTERVAL 7 HOUR,
  625.00,
  'scheduled',
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 10 DAY), '09:00:00'),
  TIMESTAMP(CURDATE(), '16:10:00')
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-LVIV-KYIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT
  r.id,
  t.id,
  CONCAT('TRIP-701-', DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y%m%d'), '-M'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '07:30:00'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '07:30:00') + INTERVAL 7 HOUR,
  615.00,
  'scheduled',
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 9 DAY), '08:30:00'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '07:00:00')
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-KYIV-LVIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT
  r.id,
  t.id,
  CONCAT('TRIP-702-', DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y%m%d'), '-E'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '17:10:00'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '17:10:00') + INTERVAL 7 HOUR,
  635.00,
  'scheduled',
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 9 DAY), '09:00:00'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '16:40:00')
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-LVIV-KYIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT
  r.id,
  t.id,
  CONCAT('TRIP-701-', DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 2 DAY), '%Y%m%d'), '-E'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 2 DAY), '18:45:00'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 2 DAY), '18:45:00') + INTERVAL 7 HOUR,
  645.00,
  'scheduled',
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 8 DAY), '08:00:00'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 2 DAY), '18:15:00')
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-KYIV-LVIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

INSERT INTO trips (
  route_id,
  train_id,
  trip_code,
  departure_datetime,
  arrival_datetime,
  base_price,
  status,
  sale_start_at,
  sale_end_at
)
SELECT
  r.id,
  t.id,
  CONCAT('TRIP-702-', DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 3 DAY), '%Y%m%d')),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 3 DAY), '06:50:00'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 3 DAY), '06:50:00') + INTERVAL 7 HOUR,
  630.00,
  'scheduled',
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 7 DAY), '09:00:00'),
  TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 3 DAY), '06:20:00')
FROM routes r
CROSS JOIN trains t
WHERE r.code = 'R-LVIV-KYIV'
  AND t.code = 'IC-701'
ON DUPLICATE KEY UPDATE
  route_id = VALUES(route_id),
  train_id = VALUES(train_id),
  departure_datetime = VALUES(departure_datetime),
  arrival_datetime = VALUES(arrival_datetime),
  base_price = VALUES(base_price),
  status = VALUES(status),
  sale_start_at = VALUES(sale_start_at),
  sale_end_at = VALUES(sale_end_at);

COMMIT;
