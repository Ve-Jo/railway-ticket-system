# Ручні перевірки

Ці перевірки призначені для ручної верифікації HTTP-сценаріїв у циклі бронювання, оплати, випуску квитка та повернення. Це не автоматичні тести.

## Підготовка

1. Застосувати [db/schema.sql](C:/Users/PAPA/Downloads/diploma/db/schema.sql) та [db/seeds.sql](C:/Users/PAPA/Downloads/diploma/db/seeds.sql).
2. Запустити застосунок і увійти під одним із демо-користувачів із [docs/demo-data.md](C:/Users/PAPA/Downloads/diploma/docs/demo-data.md).
3. Відкрити [db/smoke-checks.sql](C:/Users/PAPA/Downloads/diploma/db/smoke-checks.sql) у MySQL-клієнті.
4. Після кожного успішного сценарію встановити `@booking_id` у `db/smoke-checks.sql` на створений або змінений ідентифікатор бронювання.

## Сценарій 1: створення бронювання

HTTP:

- `POST /api/bookings`
- очікування: `201` і `booking.status = reserved`

SQL:

- виконати секцію `1. Main booking snapshot`
- виконати секцію `2. Seat collision check`
- виконати секцію `8. Seat map for the trip`

Перевірити:

- бронювання існує зі статусом `reserved`;
- `reserved_until` заповнений;
- `paid_at`, `cancelled_at`, `refunded_at` дорівнюють `NULL`;
- для комбінації `trip_id + carriage_id + seat_id` існує лише один активний запис;
- вибране місце більше не `available`.

## Сценарій 2: повторна спроба забронювати те саме місце

HTTP:

- ще раз викликати `POST /api/bookings` для того самого `tripId/carriageId/seatId`
- очікування: `409`

SQL:

- виконати секцію `2. Seat collision check`
- виконати секцію `8. Seat map for the trip`

Перевірити:

- для цього місця й надалі існує лише одне активне бронювання;
- другий запис зі статусом `reserved` або `paid` не з'явився.

## Сценарій 3: скасування бронювання

HTTP:

- `POST /api/bookings/:bookingId/cancel`
- очікування: `200`

SQL:

- виконати секцію `1. Main booking snapshot`
- виконати секцію `2. Seat collision check`
- виконати секцію `3. Payment records linked to the booking`
- виконати секцію `4. Ticket state linked to the booking`

Перевірити:

- бронювання перейшло у `cancelled`;
- `cancelled_at` заповнений;
- `active_trip_seat_key` став `NULL`;
- для бронювання немає успішної оплати й виданого квитка.

## Сценарій 4: оплата бронювання

HTTP:

- створити нове бронювання через `POST /api/bookings`
- потім викликати `POST /api/payments`
- очікування: успішна оплата і створений квиток

SQL:

- виконати секцію `1. Main booking snapshot`
- виконати секцію `3. Payment records linked to the booking`
- виконати секцію `4. Ticket state linked to the booking`
- виконати секцію `6. Unified lifecycle snapshot`

Перевірити:

- бронювання перейшло у `paid`;
- `paid_at` заповнений;
- існує один успішний запис оплати;
- існує один квиток зі статусом `issued`;
- сума оплати відповідає сумі бронювання.

## Сценарій 5: спроба скасувати вже оплачений квиток

HTTP:

- `POST /api/bookings/:bookingId/cancel` для оплаченого бронювання
- очікування: `409`

SQL:

- виконати секцію `1. Main booking snapshot`
- виконати секцію `3. Payment records linked to the booking`
- виконати секцію `4. Ticket state linked to the booking`

Перевірити:

- бронювання лишилось у статусі `paid`;
- оплата й квиток не змінилися.

## Сценарій 6: повернення оплаченого квитка

HTTP:

- `POST /api/refunds`
- очікування: `201`

SQL:

- виконати секцію `1. Main booking snapshot`
- виконати секцію `3. Payment records linked to the booking`
- виконати секцію `4. Ticket state linked to the booking`
- виконати секцію `5. Refund state linked to the booking`
- виконати секцію `6. Unified lifecycle snapshot`
- виконати секцію `2. Seat collision check`
- виконати секцію `8. Seat map for the trip`

Перевірити:

- бронювання перейшло у `refunded`;
- квиток змінився з `issued` на стан повернення;
- запис повернення існує і його сума збігається із сумою оплати або бронювання;
- початковий успішний платіж збережено;
- для цього місця не залишилось активних `reserved/paid` записів;
- місце знову стало доступним.

## Сценарій 7: перегляд квитків пасажира

HTTP:

- `GET /api/tickets/my`
- `GET /api/tickets/:ticketId`

SQL:

- виконати секцію `4. Ticket state linked to the booking`
- виконати секцію `6. Unified lifecycle snapshot`

Перевірити:

- оплачений квиток присутній у `GET /api/tickets/my`;
- повернений квиток залишається доступним в історії, якщо такий режим підтримано;
- `GET /api/tickets/:ticketId` повертає той самий `ticketId`, номер і статус, що збережені в БД.

## Сценарій 8: аудит дій

HTTP:

- повторити будь-який із наведених вище сценаріїв

SQL:

- виконати секцію `7. Operation log entries`

Перевірити:

- якщо журналювання ще не реалізовано, сценарій можна пропустити;
- якщо журналювання реалізовано, `actor`, `entity` і `result` повинні відповідати HTTP-дії.
