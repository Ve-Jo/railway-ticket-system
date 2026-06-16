import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { expireStaleBookings } from "./services/bookingMaintenance.js";
import {
  completeDepartedTrips,
  ensureTripDemandCoverage,
  ensureUpcomingTrips
} from "./services/tripMaintenance.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`Server is running on http://localhost:${env.port}`);
});

async function runMaintenanceCycle() {
  try {
    const expiredCount = await expireStaleBookings();
    const completedTripsCount = await completeDepartedTrips();
    const createdTripsCount = await ensureUpcomingTrips();
    const autofilledBookingsCount = await ensureTripDemandCoverage();

    if (expiredCount > 0) {
      console.log(`Expired stale bookings: ${expiredCount}`);
    }

    if (completedTripsCount > 0) {
      console.log(`Completed departed trips: ${completedTripsCount}`);
    }

    if (createdTripsCount > 0) {
      console.log(`Generated upcoming trips: ${createdTripsCount}`);
    }

    if (autofilledBookingsCount > 0) {
      console.log(`Autofilled simulated bookings: ${autofilledBookingsCount}`);
    }
  } catch (error) {
    console.error("Failed to run maintenance cycle", error);
  }
}

runMaintenanceCycle();
setInterval(runMaintenanceCycle, 60 * 1000);
