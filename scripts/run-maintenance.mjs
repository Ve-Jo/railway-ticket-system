import { closePool } from "../server/src/db/connection.js";
import { expireStaleBookings } from "../server/src/services/bookingMaintenance.js";
import {
  completeDepartedTrips,
  ensureTripDemandCoverage,
  ensureUpcomingTrips
} from "../server/src/services/tripMaintenance.js";

async function main() {
  const expiredCount = await expireStaleBookings();
  const completedTripsCount = await completeDepartedTrips();
  const createdTripsCount = await ensureUpcomingTrips();
  const autofilledBookingsCount = await ensureTripDemandCoverage();

  console.log(JSON.stringify({
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
