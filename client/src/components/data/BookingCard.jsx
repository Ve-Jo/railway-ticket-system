import { Button } from "../ui/Button.jsx";
import { StatusBadge } from "../ui/StatusBadge.jsx";
import { MapPin, Calendar, Armchair, User, CreditCard, Clock } from "lucide-react";
import styles from "./BookingCard.module.css";

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 2 }).format(Number(value));
}

export function BookingCard({ booking, onConfirmPayment, isProcessing = false }) {
  const canConfirm = booking.status === "reserved";

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.route}>
          <span className={styles.bookingId}>Бронь #{booking.id}</span>
          <span className={styles.trainName}>
            {booking.routeCode} · {booking.trainName}
          </span>
        </div>
        <StatusBadge status={booking.status}>{booking.status}</StatusBadge>
      </div>

      <div className={styles.body}>
        <div className={styles.row}>
          <span className={styles.metaItem}>
            <MapPin size={14} />
            {booking.departureStation} — {booking.arrivalStation}
          </span>
          <span className={styles.metaItem}>
            <Calendar size={14} />
            {formatDateTime(booking.departureAt)} — {formatDateTime(booking.arrivalAt)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.metaItem}>
            <Armchair size={14} />
            Вагон {booking.carriageNumber}, місце {booking.seatNumber}
          </span>
          <span className={styles.metaItem}>
            <CreditCard size={14} />
            {formatCurrency(booking.price)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.metaItem}>
            <User size={14} />
            {booking.passengerName ?? booking.passengerLogin ?? `Користувач #${booking.userId ?? "?"}`}
          </span>
          <span className={styles.metaItem}>
            <Clock size={14} />
            Заброньовано до: {formatDateTime(booking.reservedUntil)}
          </span>
        </div>
      </div>

      {onConfirmPayment && canConfirm ? (
        <div className={styles.footer}>
          <Button variant="primary" onClick={() => onConfirmPayment(booking)} isLoading={isProcessing}>
            Підтвердити оплату
          </Button>
        </div>
      ) : null}
    </article>
  );
}
