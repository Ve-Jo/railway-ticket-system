# API Contracts

## Notes

- Base prefix: `/api`
- Format: `application/json`
- Auth: server-side session via cookie
- Roles: `passenger`, `cashier`, `admin`
- Common error shape:

```json
{
  "message": "Human-readable error message"
}
```

- Main statuses:
  - `401` -> no active session
  - `403` -> role is not allowed
  - `404` -> entity not found
  - `409` -> state conflict, duplicate booking, invalid transition
  - `422` -> validation error

## Auth

### `POST /api/auth/register`

- Auth: public
- Request:

```json
{
  "fullName": "Ivan Petrov",
  "email": "ivan@example.com",
  "login": "ivanpetrov",
  "password": "secret123"
}
```

- Responses:
  - `201` -> created user and active session
  - `409` -> login or email already exists
  - `422` -> invalid payload

### `POST /api/auth/login`

- Auth: public
- Request:

```json
{
  "login": "ivanpetrov",
  "password": "secret123"
}
```

- Responses:
  - `200` -> active session created
  - `401` -> invalid credentials
  - `422` -> invalid payload

### `POST /api/auth/logout`

- Auth: any authenticated user
- Request: empty body
- Responses:
  - `204` -> session destroyed
  - `401` -> no active session

### `GET /api/auth/me`

- Auth: any authenticated user
- Request: none
- Responses:
  - `200`

```json
{
  "user": {
    "id": 1,
    "fullName": "Ivan Petrov",
    "email": "ivan@example.com",
    "login": "ivanpetrov",
    "role": "passenger"
  }
}
```

  - `401` -> no active session

## Stations

### `GET /api/stations`

- Auth: public
- Query:
  - `search` optional string for station name/code filtering
- Responses:
  - `200`

```json
{
  "items": [
    {
      "id": 1,
      "name": "Kyiv-Pasazhyrskyi",
      "code": "KYI"
    }
  ]
}
```

## Trips

### `GET /api/trips/search`

- Auth: public
- Query:
  - `fromStationId` required number
  - `toStationId` required number
  - `date` required string `YYYY-MM-DD`
- Responses:
  - `200`

```json
{
  "items": [
    {
      "id": 12,
      "routeCode": "IC-101",
      "trainName": "Intercity 101",
      "departureStation": "Kyiv-Pasazhyrskyi",
      "arrivalStation": "Lviv",
      "departureAt": "2026-06-20T08:00:00Z",
      "arrivalAt": "2026-06-20T13:20:00Z",
      "basePrice": 650.00,
      "availableSeats": 42
    }
  ]
}
```

  - `422` -> missing or invalid query params

### `GET /api/trips/:tripId`

- Auth: public
- Request: path param `tripId`
- Responses:
  - `200`

```json
{
  "trip": {
    "id": 12,
    "routeCode": "IC-101",
    "trainName": "Intercity 101",
    "departureAt": "2026-06-20T08:00:00Z",
    "arrivalAt": "2026-06-20T13:20:00Z",
    "basePrice": 650.00
  },
  "carriages": [
    {
      "id": 3,
      "number": "05",
      "type": "compartment",
      "seats": [
        {
          "id": 41,
          "number": "1",
          "status": "available"
        },
        {
          "id": 42,
          "number": "2",
          "status": "reserved"
        }
      ]
    }
  ]
}
```

  - `404` -> trip not found

## Bookings

### `POST /api/bookings`

- Auth: `passenger`, `cashier`
- Request:

```json
{
  "tripId": 12,
  "carriageId": 3,
  "seatId": 41,
  "passengerUserId": 7
}
```

- Notes:
  - `passengerUserId` is optional for `passenger` and must match current user
  - `cashier` may create booking for another passenger
- Responses:
  - `201`

```json
{
  "booking": {
    "id": 55,
    "status": "reserved",
    "reservedUntil": "2026-06-20T07:15:00Z",
    "tripId": 12,
    "carriageId": 3,
    "seatId": 41,
    "userId": 7,
    "price": 650.00
  }
}
```

  - `404` -> trip, carriage, seat, or passenger not found
  - `409` -> seat already reserved or paid
  - `422` -> invalid payload

### `GET /api/bookings/:bookingId`

- Auth: booking owner, `cashier`, `admin`
- Responses:
  - `200` -> booking details
  - `403` -> passenger cannot access another user's booking
  - `404` -> booking not found

### `POST /api/bookings/:bookingId/cancel`

- Auth: booking owner, `cashier`
- Request: empty body
- Responses:
  - `200` -> booking status changed to `cancelled`
  - `403` -> not allowed
  - `404` -> booking not found
  - `409` -> booking already paid, cancelled, expired, or refunded

## Payments

### `POST /api/payments`

- Auth: `passenger`, `cashier`
- Request:

```json
{
  "bookingId": 55,
  "method": "mock",
  "amount": 650.00
}
```

- Notes:
  - `passenger` may pay only own active booking
  - `cashier` may confirm payment for any valid booking
  - successful payment must atomically move booking `reserved -> paid` and issue ticket
- Responses:
  - `201`

```json
{
  "payment": {
    "id": 80,
    "status": "completed",
    "bookingId": 55,
    "amount": 650.00,
    "method": "mock",
    "paidAt": "2026-06-20T07:05:00Z"
  },
  "ticket": {
    "id": 23,
    "ticketNumber": "TK-20260620-000023",
    "status": "issued"
  }
}
```

  - `404` -> booking not found
  - `409` -> booking expired, cancelled, already paid, or amount mismatch
  - `422` -> invalid payload

## Tickets

### `GET /api/tickets/my`

- Auth: `passenger`
- Query:
  - `scope` optional: `active` or `history`
- Responses:
  - `200`

```json
{
  "items": [
    {
      "id": 23,
      "ticketNumber": "TK-20260620-000023",
      "status": "issued",
      "tripId": 12,
      "departureAt": "2026-06-20T08:00:00Z",
      "arrivalAt": "2026-06-20T13:20:00Z",
      "seatNumber": "1",
      "carriageNumber": "05"
    }
  ]
}
```

### `GET /api/tickets/:ticketId`

- Auth: ticket owner, `cashier`, `admin`
- Responses:
  - `200` -> ticket details
  - `403` -> not allowed
  - `404` -> ticket not found

## Refunds

### `POST /api/refunds`

- Auth: ticket owner, `cashier`
- Request:

```json
{
  "ticketId": 23,
  "reason": "Trip cancelled by passenger"
}
```

- Notes:
  - only `paid/issued` ticket before trip departure
  - successful refund must atomically mark booking and ticket as refunded
- Responses:
  - `201`

```json
{
  "refund": {
    "id": 14,
    "ticketId": 23,
    "status": "completed",
    "refundedAt": "2026-06-19T18:00:00Z"
  }
}
```

  - `404` -> ticket not found
  - `409` -> ticket already refunded or trip already started
  - `422` -> invalid payload

## Admin Basics

### `GET /api/admin/users`

- Auth: `admin`
- Query:
  - `role` optional
  - `search` optional
- Responses:
  - `200` -> users list

### `GET /api/admin/bookings`

- Auth: `admin`, `cashier`
- Query:
  - `status` optional
  - `tripId` optional
  - `userId` optional
- Responses:
  - `200` -> bookings list

### `GET /api/admin/tickets`

- Auth: `admin`, `cashier`
- Query:
  - `status` optional
  - `tripId` optional
  - `userId` optional
- Responses:
  - `200` -> tickets list

### `GET /api/admin/refunds`

- Auth: `admin`, `cashier`
- Query:
  - `status` optional
  - `tripId` optional
  - `userId` optional
- Responses:
  - `200` -> refunds list

### `POST /api/admin/stations`

- Auth: `admin`
- Request:

```json
{
  "name": "Dnipro",
  "code": "DNP"
}
```

- Responses:
  - `201` -> station created
  - `409` -> duplicate code
  - `422` -> invalid payload

### `POST /api/admin/trips`

- Auth: `admin`
- Request:

```json
{
  "routeId": 2,
  "trainId": 4,
  "departureAt": "2026-06-20T08:00:00Z",
  "arrivalAt": "2026-06-20T13:20:00Z",
  "basePrice": 650.00
}
```

- Responses:
  - `201` -> trip created
  - `404` -> route or train not found
  - `422` -> invalid payload

### `PATCH /api/admin/trips/:tripId`

- Auth: `admin`
- Request: partial trip fields
- Responses:
  - `200` -> trip updated
  - `404` -> trip not found
  - `409` -> invalid state change
  - `422` -> invalid payload
