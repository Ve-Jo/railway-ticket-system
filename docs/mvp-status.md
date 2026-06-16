# MVP Status

## Purpose

This document tracks functional coverage of [TZ.md](C:/Users/PAPA/Downloads/diploma/TZ.md) against the current implementation and project docs. It is intended for two follow-up stages:

- finishing the remaining functional gaps before declaring MVP complete;
- moving into the visual and UX pass with a clear understanding of what is already stable.

## Status Legend

- `done` -> confirmed by implemented flow, route contract, schema, or manual-check doc
- `partial` -> partly covered, documented, or expected from current flow, but not yet fully closed against the TЗ
- `planned` -> fixed in TЗ/docs, but not confirmed as implemented yet

## MVP Matrix

| Area from TZ | Status | Notes |
| --- | --- | --- |
| Registration, login, logout, session auth | `done` | Covered by auth flow and API contracts: `register/login/logout/me`, server-side `sessions/cookies`, client auth shell. |
| Role separation: passenger, cashier, admin | `partial` | Roles and route protection exist; passenger flow is confirmed. Cashier/admin role-specific business flows are not fully closed. |
| Search trips by departure, arrival, date | `done` | Confirmed in docs and client flow for stations, search results, and trip details. |
| Show available trips | `done` | Search results include time, route, price, and available seats. |
| Show carriages and seats for selected trip | `done` | Passenger seat-selection flow is implemented and documented. |
| Recheck seat availability before booking/payment | `done` | Confirmed by DB design and booking/payment flow notes. |
| Create booking | `done` | Booking creation exists for passenger flow and is covered by manual checks. |
| Booking expiration window | `partial` | `reserved_until` and release rules are designed; expired reservations are handled on business actions, but background auto-expire is still called out as unfinished. |
| Payment imitation | `done` | `POST /api/payments` is part of the implemented lifecycle and manual checks. |
| Move booking to paid ticket | `done` | Payment flow issues a ticket and marks booking as paid. |
| View active and archived tickets | `done` | Passenger dashboard uses `GET /api/tickets/my` for active/history scopes. |
| Refund paid ticket | `done` | Refund flow and checks are documented as part of the implemented passenger cycle. |
| Cashier can find booking and confirm sale | `partial` | Role and contracts are defined, but cashier service flow is still an open functional block. |
| Admin can manage stations, routes, trains, carriages, trips, prices | `partial` | DB model and API contracts exist, but full CRUD closure should be treated as incomplete until admin API and UI flows are confirmed. |
| Operation logging | `partial` | `operation_logs` is present in schema and manual checks mention it as optional if implemented; logging should not be considered fully closed yet. |
| Prevent double booking / double sale | `done` | Centralized in `bookings` with unique active seat key and transaction-oriented flow. |
| Store users, trips, bookings, tickets, payments, refunds in MySQL | `partial` | Schema, seeds, and flow design are present; final live verification on a real MySQL run is still required. |

## Goals From TZ

| Goal | Status | Notes |
| --- | --- | --- |
| Goal 1. Users and roles | `done` | Session auth and protected access are already part of the working foundation. |
| Goal 2. Trip search and seat selection | `done` | Search, results, and seat-view flow are already covered. |
| Goal 3. Booking | `partial` | Main booking flow works, but automatic expiration is not fully closed. |
| Goal 4. Sale and payment imitation | `partial` | Passenger sale path is closed; cashier sale path still needs explicit closure. |
| Goal 5. Refunds | `done` | Passenger refund lifecycle is functionally covered. |
| Goal 6. Administrative section | `partial` | Data model and contracts exist; complete admin CRUD and service views still need confirmation. |
| Goal 7. Data integrity | `partial` | Double-sale protection is designed and integrated, but operation logs and final integration verification remain. |

## Role Coverage

### Passenger

Status: `done`

Confirmed flow:

1. Register or log in.
2. Search trips by route and date.
3. Open trip details and inspect seats.
4. Reserve an available seat.
5. Pay for the reservation.
6. View active ticket.
7. Refund paid ticket.
8. See refunded ticket in history.

### Cashier

Status: `partial`

Expected by TЗ:

- search trips and seats;
- find passenger bookings;
- confirm payment or perform sale;
- perform refund.

Current assessment:

- role exists in auth/domain model;
- API contracts allow cashier access in booking/payment/refund scenarios;
- full cashier workflow should still be treated as not fully demonstrated until dedicated service screens and end-to-end checks are confirmed.

### Admin

Status: `partial`

Expected by TЗ:

- manage stations, routes, trains, carriages, seats, trips, and prices;
- review service lists and operation logs.

Current assessment:

- data model is prepared;
- admin-related contracts are documented;
- full CRUD completion and operator-facing admin workflow should still be treated as open.

## Confirmed Supporting Artifacts

- DB schema: [db/schema.sql](C:/Users/PAPA/Downloads/diploma/db/schema.sql)
- DB design notes: [database-design.md](C:/Users/PAPA/Downloads/diploma/docs/database-design.md)
- Demo seed data: [demo-data.md](C:/Users/PAPA/Downloads/diploma/docs/demo-data.md)
- API surface: [api-contracts.md](C:/Users/PAPA/Downloads/diploma/docs/api-contracts.md)
- Manual lifecycle checks: [manual-checks.md](C:/Users/PAPA/Downloads/diploma/docs/manual-checks.md)

## Remaining Functional Work Before Final MVP Closure

1. Close the cashier workflow as a demonstrated end-to-end scenario, not only as role rules and API expectations.
2. Close admin CRUD for stations, routes, trains, carriages, seats, trips, and prices.
3. Confirm service lists for bookings, tickets, and refunds.
4. Finish operation logging and make it part of the standard manual verification flow.
5. Add or confirm background expiration for stale bookings if this remains a project requirement beyond lazy cleanup on business actions.
6. Run the full manual checklist on a live MySQL database and record the outcome.

## What Is Ready For The Visual Stage

These parts are already suitable for layout, UX, and visual refinement once the remaining functional work is either completed or consciously deferred:

- auth screens and navigation shell;
- trip search screen;
- search results screen;
- seat selection screen;
- booking and payment screen;
- passenger dashboard with active/history tickets and refund action.

## Final Readiness Summary

- Passenger MVP lifecycle: `ready`
- Cashier flow: `needs closure`
- Admin flow: `needs closure`
- Audit/logging: `needs closure`
- Final integration verification: `needs closure`

At the current stage, the project looks functionally close to MVP, but it should not yet be marked as fully complete against the TЗ until cashier, admin, logging, and live end-to-end verification are explicitly closed.
