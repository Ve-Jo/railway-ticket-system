import { query } from "../db/connection.js";
import { formatDateTimeForMySql } from "../utils/bookingHelpers.js";

export async function expireStaleBookings() {
  const now = new Date();
  const result = await query(
    `
      UPDATE bookings
      SET status = 'expired',
          cancelled_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'reserved'
        AND reserved_until IS NOT NULL
        AND reserved_until <= ?
    `,
    [formatDateTimeForMySql(now), formatDateTimeForMySql(now)]
  );

  return result.affectedRows ?? 0;
}
