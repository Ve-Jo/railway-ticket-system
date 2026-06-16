import { Armchair, Calendar, CreditCard, MapPin, User } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { StatusBadge } from "../ui/StatusBadge.jsx";
import styles from "./TicketCard.module.css";

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2
  }).format(Number(value));
}

export function TicketCard({ ticket, onRefund, isProcessing = false }) {
  const hasDeparted = ticket.departureAt ? new Date(ticket.departureAt).getTime() <= Date.now() : false;
  const canRefund =
    ticket.refundable &&
    !hasDeparted &&
    ticket.status !== "refunded" &&
    ticket.status !== "cancelled" &&
    ticket.status !== "expired";

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.route}>
          <span className={styles.ticketNumber}>{ticket.ticketNumber}</span>
          <span className={styles.trainName}>
            {ticket.routeCode} · {ticket.trainName}
          </span>
        </div>
        <StatusBadge status={ticket.status}>{ticket.status}</StatusBadge>
      </div>

      <div className={styles.body}>
        <div className={styles.row}>
          <span className={styles.metaItem}>
            <MapPin size={14} />
            {ticket.departureStation} — {ticket.arrivalStation}
          </span>
          <span className={styles.metaItem}>
            <Calendar size={14} />
            {formatDateTime(ticket.departureAt)} — {formatDateTime(ticket.arrivalAt)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.metaItem}>
            <Armchair size={14} />
            Вагон {ticket.carriageNumber}, місце {ticket.seatNumber}
          </span>
          <span className={styles.metaItem}>
            <CreditCard size={14} />
            {formatCurrency(ticket.price)}
          </span>
        </div>
        {ticket.passengerName || ticket.passengerLogin ? (
          <div className={styles.row}>
            <span className={styles.metaItem}>
              <User size={14} />
              {ticket.passengerName ?? ticket.passengerLogin}
            </span>
          </div>
        ) : null}
      </div>

      {onRefund && canRefund ? (
        <div className={styles.footer}>
          <Button variant="secondary" onClick={() => onRefund(ticket)} isLoading={isProcessing}>
            Оформити повернення
          </Button>
        </div>
      ) : null}
    </article>
  );
}
