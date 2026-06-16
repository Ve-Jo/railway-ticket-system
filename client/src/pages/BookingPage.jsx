import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError, apiRequest } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { StatusBadge } from "../components/ui/StatusBadge.jsx";
import { Alert } from "../components/ui/Alert.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { ArrowLeft, Ticket } from "lucide-react";
import styles from "./BookingPage.module.css";

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value)
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function normalizeBookingResponse(payload, fallback) {
  const booking = payload?.booking ?? payload?.data?.booking ?? fallback ?? null;
  if (!booking) return null;
  return {
    id: booking.id,
    status: booking.status,
    reservedUntil: booking.reservedUntil ?? booking.reserved_until ?? null,
    tripId: booking.tripId ?? booking.trip_id ?? fallback?.tripId ?? null,
    carriageId: booking.carriageId ?? booking.carriage_id ?? fallback?.carriageId ?? null,
    seatId: booking.seatId ?? booking.seat_id ?? fallback?.seatId ?? null,
    userId: booking.userId ?? booking.user_id ?? null,
    price: booking.price ?? fallback?.price ?? null
  };
}

function normalizePaymentResponse(payload) {
  return {
    payment: payload?.payment ?? payload?.data?.payment ?? null,
    ticket: payload?.ticket ?? payload?.data?.ticket ?? null
  };
}

export function BookingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const bookingDraft = location.state?.bookingDraft ?? null;
  const tripSummary = location.state?.tripSummary ?? null;

  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const price = useMemo(() => {
    if (booking?.price != null) return booking.price;
    return tripSummary?.basePrice ?? bookingDraft?.price ?? 0;
  }, [booking, tripSummary, bookingDraft]);

  const canCreateBooking = Boolean(bookingDraft && !booking);
  const canPay = booking?.status === "reserved" && !payment;
  const canCancel = booking?.status === "reserved";

  const handleCreateBooking = async () => {
    if (!bookingDraft) return;
    setIsBooking(true);
    setError("");
    setSuccess("");

    try {
      const payload = await apiRequest("/bookings", {
        method: "POST",
        body: {
          tripId: bookingDraft.tripId,
          carriageId: bookingDraft.carriageId,
          seatId: bookingDraft.seatId
        }
      });

      const nextBooking = normalizeBookingResponse(payload, {
        tripId: bookingDraft.tripId,
        carriageId: bookingDraft.carriageId,
        seatId: bookingDraft.seatId,
        price
      });

      setBooking(nextBooking);
      setSuccess("Бронь створено. Оплатіть її або скасуйте впродовж резервного часу.");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Не вдалося створити бронь. Спробуйте ще раз."
      );
    } finally {
      setIsBooking(false);
    }
  };

  const handlePay = async () => {
    if (!booking) return;
    setIsPaying(true);
    setError("");
    setSuccess("");

    try {
      const payload = await apiRequest("/payments", {
        method: "POST",
        body: {
          bookingId: booking.id,
          method: "mock",
          amount: Number(price)
        }
      });

      const { payment: nextPayment, ticket: nextTicket } = normalizePaymentResponse(payload);
      setPayment(nextPayment);
      setTicket(nextTicket);
      setBooking((current) => (current ? { ...current, status: "paid" } : current));
      setSuccess("Оплату успішно завершено. Бронь перетворено на оплачений квиток.");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не вдалося завершити оплату.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    setIsCancelling(true);
    setError("");
    setSuccess("");

    try {
      const payload = await apiRequest(`/bookings/${booking.id}/cancel`, { method: "POST" });
      const nextBooking = normalizeBookingResponse(payload, booking);
      setBooking({ ...booking, ...nextBooking, status: nextBooking?.status ?? "cancelled" });
      setSuccess("Бронь скасовано. Місце знову доступне для бронювання.");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не вдалося скасувати бронь.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (!bookingDraft || !tripSummary) {
    return (
      <EmptyState
        icon={Ticket}
        title="Немає обраного місця"
        description="Відкрийте цю сторінку після вибору місця на сторінці рейсу."
        action={
          <Link to="/search">
            <Button variant="primary">Пошук рейсів</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Оформлення та оплата"
        description="Підтвердіть обране місце, створіть бронь та оплатіть квиток."
      />

      <div className={styles.toolbar}>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Назад до вибору місця
        </Button>
      </div>

      <div className={styles.layout}>
        <Card>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.routeCode}>{tripSummary.routeCode}</h3>
              <p className={styles.trainName}>{tripSummary.trainName}</p>
            </div>
            <div className={styles.price}>{formatCurrency(price)}</div>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>Пасажир</span>
              <strong>{user?.fullName ?? user?.login ?? "Поточний користувач"}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Маршрут</span>
              <strong>
                {tripSummary.departureStation} — {tripSummary.arrivalStation}
              </strong>
            </div>
            <div className={styles.metaItem}>
              <span>Відправлення</span>
              <strong>{formatDateTime(tripSummary.departureAt)}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Прибуття</span>
              <strong>{formatDateTime(tripSummary.arrivalAt)}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Вагон</span>
              <strong>{bookingDraft.carriageNumber}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Місце</span>
              <strong>{bookingDraft.seatNumber}</strong>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className={styles.cardTitle}>Статус бронювання</h3>
          {!booking ? (
            <div className={styles.stateBlock}>
              <p className={styles.stateText}>
                Місце обрано, але бронь ще не створено. Створіть бронь, щоб заблокувати місце для оплати.
              </p>
              <Button
                variant="primary"
                onClick={handleCreateBooking}
                disabled={!canCreateBooking || isBooking}
                isLoading={isBooking}
              >
                Створити бронь
              </Button>
            </div>
          ) : (
            <div className={styles.stateBlock}>
              <div className={styles.statusRow}>
                <StatusBadge status={booking.status}>{booking.status}</StatusBadge>
                <span className={styles.bookingId}>Бронь #{booking.id}</span>
              </div>
              <p className={styles.stateText}>
                Заброньовано до: <strong>{formatDateTime(booking.reservedUntil)}</strong>
              </p>
              <div className={styles.actions}>
                <Button
                  variant="primary"
                  onClick={handlePay}
                  disabled={!canPay || isPaying || isCancelling}
                  isLoading={isPaying}
                >
                  Оплатити
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={!canCancel || isPaying || isCancelling}
                  isLoading={isCancelling}
                >
                  Скасувати бронь
                </Button>
              </div>
            </div>
          )}

          {success ? <Alert variant="success">{success}</Alert> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
        </Card>

        {payment || ticket ? (
          <Card>
            <h3 className={styles.cardTitle}>Результат оплати</h3>
            <div className={styles.metaGrid}>
              {payment ? (
                <>
                  <div className={styles.metaItem}>
                    <span>Статус платежу</span>
                    <strong>{payment.status ?? "завершено"}</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Спосіб оплати</span>
                    <strong>{payment.method ?? "mock"}</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Час оплати</span>
                    <strong>{formatDateTime(payment.paidAt)}</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Сума</span>
                    <strong>{formatCurrency(payment.amount ?? price)}</strong>
                  </div>
                </>
              ) : null}
              {ticket ? (
                <>
                  <div className={styles.metaItem}>
                    <span>Квиток</span>
                    <strong>#{ticket.id}</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Номер квитка</span>
                    <strong>{ticket.ticketNumber ?? "Згенеровано сервером"}</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Статус</span>
                    <strong>{ticket.status ?? "виданий"}</strong>
                  </div>
                </>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
