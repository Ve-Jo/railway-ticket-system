# Manual Checks

These checks are for manual verification after HTTP scenarios from the booking, payment, ticket, and refund cycle. They are not automated tests.

## Preparation

1. Apply [schema.sql](C:/Users/PAPA/Downloads/diploma/db/schema.sql) and [seeds.sql](C:/Users/PAPA/Downloads/diploma/db/seeds.sql).
2. Start the app and log in with one of the demo users from [demo-data.md](C:/Users/PAPA/Downloads/diploma/docs/demo-data.md).
3. Open [smoke-checks.sql](C:/Users/PAPA/Downloads/diploma/db/smoke-checks.sql) in MySQL client.
4. After each successful scenario, set `@booking_id` in `db/smoke-checks.sql` to the created or affected booking id.

## Scenario 1: Create booking

HTTP:
- `POST /api/bookings`
- Expect `201` with `booking.status = reserved`

SQL:
- Run section `1. Main booking snapshot`
- Run section `2. Seat collision check`
- Run section `8. Seat map for the trip`

Check:
- booking exists with `status = reserved`
- `reserved_until` is filled
- `paid_at`, `cancelled_at`, `refunded_at` are `NULL`
- only one active row exists for the same `trip_id + carriage_id + seat_id`
- chosen seat is no longer `available`

## Scenario 2: Try duplicate booking for the same seat

HTTP:
- call `POST /api/bookings` again for the same `tripId/carriageId/seatId`
- expect `409`

SQL:
- Run section `2. Seat collision check`
- Run section `8. Seat map for the trip`

Check:
- still only one active booking exists for the seat
- no second `reserved` or `paid` row appears for the same seat on the same trip

## Scenario 3: Cancel reserved booking

HTTP:
- `POST /api/bookings/:bookingId/cancel`
- expect `200`

SQL:
- Run section `1. Main booking snapshot`
- Run section `2. Seat collision check`
- Run section `3. Payment records linked to the booking`
- Run section `4. Ticket state linked to the booking`

Check:
- booking changed to `status = cancelled`
- `cancelled_at` is filled
- `active_trip_seat_key` becomes `NULL`
- there is no successful payment and no issued ticket for that booking

## Scenario 4: Pay reserved booking

HTTP:
- create a fresh booking with `POST /api/bookings`
- then call `POST /api/payments`
- expect successful payment response and issued ticket

SQL:
- Run section `1. Main booking snapshot`
- Run section `3. Payment records linked to the booking`
- Run section `4. Ticket state linked to the booking`
- Run section `6. Unified lifecycle snapshot`

Check:
- booking changed to `status = paid`
- `paid_at` is filled
- one payment row exists with successful status used by implementation
- one ticket row exists with `ticket_status = issued`
- payment amount matches booking price

## Scenario 5: Try cancel after payment

HTTP:
- `POST /api/bookings/:bookingId/cancel` for a paid booking
- expect `409`

SQL:
- Run section `1. Main booking snapshot`
- Run section `3. Payment records linked to the booking`
- Run section `4. Ticket state linked to the booking`

Check:
- booking remains `paid`
- payment and ticket remain unchanged

## Scenario 6: Refund paid ticket

HTTP:
- `POST /api/refunds`
- expect `201`

SQL:
- Run section `1. Main booking snapshot`
- Run section `3. Payment records linked to the booking`
- Run section `4. Ticket state linked to the booking`
- Run section `5. Refund state linked to the booking`
- Run section `6. Unified lifecycle snapshot`
- Run section `2. Seat collision check`
- Run section `8. Seat map for the trip`

Check:
- booking changed to `status = refunded`
- ticket changed from `issued` to refunded state used by implementation
- refund row exists and amount matches the payment or booking total
- payment remains present as the original successful payment for that booking
- there are no active `reserved/paid` rows left for the same seat on the same trip
- seat becomes available again because refunded booking is no longer active

## Scenario 7: Passenger ticket views

HTTP:
- `GET /api/tickets/my`
- `GET /api/tickets/:ticketId`

SQL:
- Run section `4. Ticket state linked to the booking`
- Run section `6. Unified lifecycle snapshot`

Check:
- paid booking appears in `GET /api/tickets/my`
- refunded ticket remains available in history-oriented responses if that scope is implemented
- `GET /api/tickets/:ticketId` returns the same ticket id, number, and status as stored in DB

## Scenario 8: Check audit trail

HTTP:
- repeat any of the scenarios above

SQL:
- Run section `7. Operation log entries`

Check:
- skip this scenario if operation logging is not implemented yet
- if implemented, actor, entity and result should look consistent with the HTTP action
