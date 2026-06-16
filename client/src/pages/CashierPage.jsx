import { useMemo, useState } from "react";
import { ApiError, apiRequest } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { Tabs } from "../components/ui/Tabs.jsx";
import { Field } from "../components/ui/Field.jsx";
import { Input } from "../components/ui/Input.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Alert } from "../components/ui/Alert.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { BookingCard } from "../components/data/BookingCard.jsx";
import { TicketCard } from "../components/data/TicketCard.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Search, Loader2, Banknote, RotateCcw } from "lucide-react";
import styles from "./CashierPage.module.css";

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 2 }).format(Number(value));
}

function getStatusLabel(status) {
  switch (status) {
    case "reserved": return "Заброньовано";
    case "paid":
    case "issued": return "Оплачено";
    case "refunded": return "Повернено";
    case "cancelled": return "Скасовано";
    case "expired": return "Прострочено";
    default: return status ?? "Невідомо";
  }
}

function normalizeBooking(item) {
  if (!item) return null;
  return {
    id: item.id,
    status: item.status ?? "reserved",
    reservedUntil: item.reservedUntil ?? item.reserved_until ?? null,
    price: item.price ?? item.basePrice ?? item.base_price ?? null,
    userId: item.userId ?? item.user_id ?? null,
    passengerLogin: item.passengerLogin ?? item.passenger_login ?? item.login ?? null,
    passengerName: item.passengerName ?? item.passenger_name ?? item.fullName ?? item.full_name ?? null,
    tripId: item.tripId ?? item.trip_id ?? null,
    routeCode: item.routeCode ?? item.route_code ?? "Маршрут",
    trainName: item.trainName ?? item.train_name ?? "Поїзд",
    departureStation: item.departureStation ?? item.departure_station ?? "Станція відправлення",
    arrivalStation: item.arrivalStation ?? item.arrival_station ?? "Станція прибуття",
    departureAt: item.departureAt ?? item.departure_at ?? null,
    arrivalAt: item.arrivalAt ?? item.arrival_at ?? null,
    carriageNumber: item.carriageNumber ?? item.carriage_number ?? item.carriageNo ?? "—",
    seatNumber: item.seatNumber ?? item.seat_number ?? item.seatNo ?? "—"
  };
}

function normalizeTicket(item) {
  if (!item) return null;
  return {
    id: item.id,
    ticketNumber: item.ticketNumber ?? item.ticket_number ?? `Квиток #${item.id}`,
    status: item.status ?? "issued",
    price: item.price ?? item.basePrice ?? item.base_price ?? null,
    userId: item.userId ?? item.user_id ?? null,
    passengerLogin: item.passengerLogin ?? item.passenger_login ?? item.login ?? null,
    passengerName: item.passengerName ?? item.passenger_name ?? item.fullName ?? item.full_name ?? null,
    tripId: item.tripId ?? item.trip_id ?? null,
    routeCode: item.routeCode ?? item.route_code ?? "Маршрут",
    trainName: item.trainName ?? item.train_name ?? "Поїзд",
    departureStation: item.departureStation ?? item.departure_station ?? "Станція відправлення",
    arrivalStation: item.arrivalStation ?? item.arrival_station ?? "Станція прибуття",
    departureAt: item.departureAt ?? item.departure_at ?? null,
    arrivalAt: item.arrivalAt ?? item.arrival_at ?? null,
    carriageNumber: item.carriageNumber ?? item.carriage_number ?? item.carriageNo ?? "—",
    seatNumber: item.seatNumber ?? item.seat_number ?? item.seatNo ?? "—",
    bookingId: item.bookingId ?? item.booking_id ?? null,
    refundable: ["issued", "paid"].includes(item.status ?? "issued")
  };
}

function normalizeItems(payload, normalizer) {
  const items = payload?.items ?? payload?.data?.items ?? [];
  return items.map(normalizer).filter(Boolean);
}

function normalizeBookingPayload(payload) {
  return normalizeBooking(payload?.booking ?? payload?.data?.booking ?? payload);
}

function normalizeTicketPayload(payload) {
  return normalizeTicket(payload?.ticket ?? payload?.data?.ticket ?? payload);
}

function normalizePaymentPayload(payload) {
  return {
    payment: payload?.payment ?? payload?.data?.payment ?? null,
    ticket: normalizeTicket(payload?.ticket ?? payload?.data?.ticket ?? null)
  };
}

function normalizeRefundPayload(payload) {
  return payload?.refund ?? payload?.data?.refund ?? null;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    login: user.login ?? user.username ?? "",
    email: user.email ?? "",
    fullName: user.fullName ?? user.full_name ?? ""
  };
}

async function requestIfAvailable(path) {
  try {
    return await apiRequest(path);
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) return null;
    throw error;
  }
}

const searchModes = [
  { id: "mixed", label: "Всі результати" },
  { id: "booking", label: "Бронювання" },
  { id: "ticket", label: "Квитки" }
];

export function CashierPage() {
  const { user } = useAuth();
  const [searchMode, setSearchMode] = useState("mixed");
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [processedTicket, setProcessedTicket] = useState(null);
  const [activeAction, setActiveAction] = useState(null);

  const cashierName = useMemo(() => user?.fullName ?? user?.login ?? user?.email ?? "касир", [user]);
  const hasResults = bookings.length > 0 || tickets.length > 0;

  const handleSearch = async (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Введіть ID броні, ID квитка або логін пасажира.");
      setSuccess("");
      setBookings([]);
      setTickets([]);
      return;
    }

    setIsSearching(true);
    setError("");
    setSuccess("");
    setProcessedTicket(null);

    try {
      const nextBookings = [];
      const nextTickets = [];
      const looksNumeric = /^\d+$/.test(trimmedQuery);

      if (looksNumeric && (searchMode === "mixed" || searchMode === "booking")) {
        const bookingPayload = await requestIfAvailable(`/bookings/${trimmedQuery}`);
        const booking = normalizeBookingPayload(bookingPayload);
        if (booking) nextBookings.push(booking);
      }

      if (looksNumeric && (searchMode === "mixed" || searchMode === "ticket")) {
        const ticketPayload = await requestIfAvailable(`/tickets/${trimmedQuery}`);
        const ticket = normalizeTicketPayload(ticketPayload);
        if (ticket) nextTickets.push(ticket);
      }

      if (!looksNumeric || (nextBookings.length === 0 && nextTickets.length === 0)) {
        const usersPayload = await requestIfAvailable(`/admin/users?search=${encodeURIComponent(trimmedQuery)}`);
        const matchedUsers = usersPayload?.items ?? usersPayload?.data?.items ?? [];
        const targetUser = matchedUsers.find((item) => {
          const login = item?.login?.toLowerCase?.();
          const email = item?.email?.toLowerCase?.();
          const fullName = item?.fullName?.toLowerCase?.() ?? item?.full_name?.toLowerCase?.();
          const needle = trimmedQuery.toLowerCase();
          return login === needle || email === needle || fullName === needle;
        }) ?? matchedUsers[0];

        if (targetUser?.id) {
          const requests = [];
          requests.push(searchMode === "mixed" || searchMode === "booking" ? requestIfAvailable(`/admin/bookings?userId=${targetUser.id}`) : Promise.resolve(null));
          requests.push(searchMode === "mixed" || searchMode === "ticket" ? requestIfAvailable(`/admin/tickets?userId=${targetUser.id}`) : Promise.resolve(null));
          const [bookingsPayload, ticketsPayload] = await Promise.all(requests);
          nextBookings.push(...normalizeItems(bookingsPayload, normalizeBooking));
          nextTickets.push(...normalizeItems(ticketsPayload, normalizeTicket));
        }
      }

      setBookings(nextBookings);
      setTickets(nextTickets);

      if (nextBookings.length === 0 && nextTickets.length === 0) {
        setSuccess("");
        setError("За запитом не знайдено броней або квитків.");
        return;
      }

      setSuccess("Пошук завершено. Підтвердьте оплату броні або оформіть повернення квитка.");
    } catch (requestError) {
      setBookings([]);
      setTickets([]);
      setSuccess("");
      setError(requestError instanceof ApiError ? requestError.message : "Не вдалося виконати пошук.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmPayment = async (booking) => {
    setActiveAction(`pay:${booking.id}`);
    setError("");
    setSuccess("");
    setProcessedTicket(null);

    try {
      const payload = await apiRequest("/payments", {
        method: "POST",
        body: {
          bookingId: booking.id,
          method: "cash-desk",
          amount: Number(booking.price ?? 0)
        }
      });
      const { payment, ticket } = normalizePaymentPayload(payload);
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: "paid" } : item));
      if (ticket) {
        setTickets((current) => {
          const withoutSameTicket = current.filter((item) => item.id !== ticket.id);
          return [ticket, ...withoutSameTicket];
        });
        setProcessedTicket(ticket);
      }
      setSuccess(payment?.id ? `Оплату броні #${booking.id} підтверджено. Платіж #${payment.id}.` : `Оплату броні #${booking.id} підтверджено.`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не вдалося підтвердити оплату.");
    } finally {
      setActiveAction(null);
    }
  };

  const handleRefund = async (ticket) => {
    setActiveAction(`refund:${ticket.id}`);
    setError("");
    setSuccess("");
    setProcessedTicket(null);

    try {
      const payload = await apiRequest("/refunds", {
        method: "POST",
        body: {
          ticketId: ticket.id,
          reason: "Повернення через касира"
        }
      });
      const refund = normalizeRefundPayload(payload);
      setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status: "refunded" } : item));
      setSuccess(refund?.id ? `Повернення оформлено для ${ticket.ticketNumber}. Номер повернення: ${refund.id}.` : `Повернення оформлено для ${ticket.ticketNumber}.`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не вдалося оформити повернення.");
    } finally {
      setActiveAction(null);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setBookings([]);
    setTickets([]);
    setError("");
    setSuccess("");
    setProcessedTicket(null);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={`Касир: ${cashierName}`}
        description="Пошук броней та квитків за ID або логіном пасажира. Підтвердження оплати та оформлення повернення."
      />

      <div className={styles.searchPanel}>
        <Card className={styles.searchCard}>
          <h3 className={styles.panelTitle}>Пошук</h3>
          <Tabs tabs={searchModes} activeTab={searchMode} onChange={setSearchMode} />

          <form className={styles.searchForm} onSubmit={handleSearch}>
            <Field label="ID броні, ID квитка або логін пасажира">
              <Input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Наприклад: 15 або passenger_demo"
              />
            </Field>
            <div className={styles.formActions}>
              <Button type="submit" variant="primary" isLoading={isSearching} disabled={isSearching}>
                <Search size={16} />
                Знайти
              </Button>
              <Button type="button" variant="ghost" onClick={clearSearch} disabled={isSearching}>
                Очистити
              </Button>
            </div>
          </form>

          {success ? <Alert variant="success">{success}</Alert> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
        </Card>
      </div>

      {processedTicket ? (
        <div className={styles.resultsSection}>
          <h2 className={styles.resultsTitle}>
            <Banknote size={20} />
            Виданий квиток
          </h2>
          <TicketCard
            ticket={processedTicket}
            onRefund={handleRefund}
            isProcessing={activeAction === `refund:${processedTicket.id}`}
          />
        </div>
      ) : null}

      {!isSearching && !hasResults ? (
        <EmptyState
          icon={Search}
          title="Готово до роботи"
          description="Результати пошуку з'являться тут після введення ID броні, ID квитка або логіна пасажира."
        />
      ) : null}

      {hasResults ? (
        <div className={styles.resultsSection}>
          <h2 className={styles.resultsTitle}>
            <Banknote size={20} />
            Бронювання
          </h2>
          {bookings.length ? (
            <div className={styles.cardList}>
              {bookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onConfirmPayment={handleConfirmPayment}
                  isProcessing={activeAction === `pay:${booking.id}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={Banknote} title="Бронювання не знайдено" description="За запитом немає зарезервованих броней." />
          )}
        </div>
      ) : null}

      {hasResults ? (
        <div className={styles.resultsSection}>
          <h2 className={styles.resultsTitle}>
            <RotateCcw size={20} />
            Квитки
          </h2>
          {tickets.length ? (
            <div className={styles.cardList}>
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onRefund={handleRefund}
                  isProcessing={activeAction === `refund:${ticket.id}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={RotateCcw} title="Квитки не знайдено" description="За запитом немає квитків." />
          )}
        </div>
      ) : null}
    </div>
  );
}
