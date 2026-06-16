import { closePool, withTransaction } from "../server/src/db/connection.js";
import { expireStaleBookings } from "../server/src/services/bookingMaintenance.js";
import {
  completeDepartedTrips,
  ensureTripDemandCoverage,
  ensureUpcomingTrips
} from "../server/src/services/tripMaintenance.js";

async function resetFutureTrips() {
  return withTransaction(async (connection) => {
    const [futureTripRows] = await connection.execute(
      `
        SELECT id
        FROM trips
        WHERE status = 'scheduled'
          AND departure_datetime > NOW()
      `
    );

    const futureTripIds = futureTripRows.map((row) => row.id);
    if (futureTripIds.length === 0) {
      return {
        deletedTrips: 0,
        deletedBookings: 0,
        deletedPayments: 0,
        deletedTickets: 0,
        deletedRefunds: 0
      };
    }

    const placeholders = futureTripIds.map(() => "?").join(", ");

    const [futureBookingRows] = await connection.execute(
      `
        SELECT id
        FROM bookings
        WHERE trip_id IN (${placeholders})
      `,
      futureTripIds
    );

    const futureBookingIds = futureBookingRows.map((row) => row.id);
    const bookingPlaceholders = futureBookingIds.map(() => "?").join(", ");

    let deletedRefunds = 0;
    let deletedPayments = 0;
    let deletedTickets = 0;

    if (futureBookingIds.length > 0) {
      const [deleteRefundsResult] = await connection.execute(
        `
          DELETE FROM refunds
          WHERE booking_id IN (${bookingPlaceholders})
        `,
        futureBookingIds
      );
      deletedRefunds = deleteRefundsResult.affectedRows ?? 0;

      const [deletePaymentsResult] = await connection.execute(
        `
          DELETE FROM payments
          WHERE booking_id IN (${bookingPlaceholders})
        `,
        futureBookingIds
      );
      deletedPayments = deletePaymentsResult.affectedRows ?? 0;

      const [deleteTicketsResult] = await connection.execute(
        `
          DELETE FROM tickets
          WHERE booking_id IN (${bookingPlaceholders})
        `,
        futureBookingIds
      );
      deletedTickets = deleteTicketsResult.affectedRows ?? 0;
    }

    const [deleteBookingsResult] = await connection.execute(
      `
        DELETE FROM bookings
        WHERE trip_id IN (${placeholders})
      `,
      futureTripIds
    );

    const [deleteTripsResult] = await connection.execute(
      `
        DELETE FROM trips
        WHERE id IN (${placeholders})
      `,
      futureTripIds
    );

    return {
      deletedTrips: deleteTripsResult.affectedRows ?? 0,
      deletedBookings: deleteBookingsResult.affectedRows ?? 0,
      deletedPayments,
      deletedTickets,
      deletedRefunds
    };
  });
}

async function main() {
  const reset = await resetFutureTrips();
  const expiredCount = await expireStaleBookings();
  const completedTripsCount = await completeDepartedTrips();
  const createdTripsCount = await ensureUpcomingTrips();
  const autofilledBookingsCount = await ensureTripDemandCoverage();

  console.log(JSON.stringify({
    reset,
    expiredCount,
    completedTripsCount,
    createdTripsCount,
    autofilledBookingsCount
  }, null, 2));
}

try {
  await main();
} finally {
  await closePool();
}
