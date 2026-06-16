import { useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { TicketCard } from "../components/data/TicketCard.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Alert } from "../components/ui/Alert.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Ticket, RefreshCw, Loader2 } from "lucide-react";
import styles from "./PassengerDashboardPage.module.css";

function normalizeTicket(item) {
  if (!item) return null;
  return {
    id: item.id,
    ticketNumber: item.ticketNumber ?? item.ticket_number ?? `Квиток #${item.id}`,
    status: item.status ?? "issued",
    tripId: item.tripId ?? item.trip_id ?? null,
    departureAt: item.departureAt ?? item.departure_at ?? null,
    arrivalAt: item.arrivalAt ?? item.arrival_at ?? null,
    departureStation: item.departureStation ?? item.departure_station ?? "Станція відправлення",
    arrivalStation: item.arrivalStation ?? item.arrival_station ?? "Станція прибуття",
    routeCode: item.routeCode ?? item.route_code ?? "Маршрут",
    trainName: item.trainName ?? item.train_name ?? "Поїзд",
    seatNumber: item.seatNumber ?? item.seat_number ?? "—",
    carriageNumber: item.carriageNumber ?? item.carriage_number ?? "—",
    price: item.price ?? item.basePrice ?? item.base_price ?? null,
    refundable:
      typeof item.refundable === "boolean"
        ? item.refundable
        : ["issued", "paid"].includes(item.status ?? "issued"),
    passengerName: item.passengerName ?? item.passenger_name ?? item.fullName ?? item.full_name ?? null,
    passengerLogin: item.passengerLogin ?? item.passenger_login ?? item.login ?? null
  };
}

function normalizeTicketList(payload) {
  const items = payload?.items ?? payload?.data?.items ?? [];
  return items.map(normalizeTicket).filter(Boolean);
}

function normalizeRefund(payload) {
  return payload?.refund ?? payload?.data?.refund ?? null;
}

export function PassengerDashboardPage() {
  const { user } = useAuth();
  const [activeTickets, setActiveTickets] = useState([]);
  const [historyTickets, setHistoryTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refundingTicketId, setRefundingTicketId] = useState(null);

  const displayName = useMemo(
    () => user?.fullName ?? user?.name ?? user?.login ?? user?.email ?? "пасажир",
    [user]
  );

  const loadTickets = async () => {
    setIsLoading(true);
    setError("");

    try {
      const [activePayload, historyPayload] = await Promise.all([
        apiRequest("/tickets/my?scope=active"),
        apiRequest("/tickets/my?scope=history")
      ]);
      setActiveTickets(normalizeTicketList(activePayload));
      setHistoryTickets(normalizeTicketList(historyPayload));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не вдалося завантажити ваші квитки.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleRefund = async (ticket) => {
    setRefundingTicketId(ticket.id);
    setError("");
    setSuccess("");

    try {
      const payload = await apiRequest("/refunds", {
        method: "POST",
        body: {
          ticketId: ticket.id,
          reason: "Повернення за ініціативою пасажира"
        }
      });
      const refund = normalizeRefund(payload);
      setActiveTickets((current) => current.filter((item) => item.id !== ticket.id));
      setHistoryTickets((current) => [
        { ...ticket, status: "refunded", refundable: false },
        ...current.filter((item) => item.id !== ticket.id)
      ]);
      setSuccess(
        refund?.id
          ? `Повернення оформлено для ${ticket.ticketNumber}. Номер повернення: ${refund.id}.`
          : `Повернення оформлено для ${ticket.ticketNumber}.`
      );
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не вдалося оформити повернення.");
    } finally {
      setRefundingTicketId(null);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={`Ласкаво просимо, ${displayName}`}
        description="Ваші активні квитки, історія поїздок та можливість оформити повернення."
        actions={
          <Button variant="secondary" onClick={loadTickets} isLoading={isLoading} disabled={isLoading}>
            <RefreshCw size={16} />
            Оновити
          </Button>
        }
      />

      <div className={styles.summary}>
        <Card className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Активних квитків</span>
          <strong className={styles.summaryValue}>{activeTickets.length}</strong>
        </Card>
        <Card className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Записів в історії</span>
          <strong className={styles.summaryValue}>{historyTickets.length}</strong>
        </Card>
      </div>

      {success ? <Alert variant="success">{success}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {isLoading ? (
        <div className={styles.state}>
          <Loader2 className={styles.spinner} size={32} />
          <span>Завантаження квитків…</span>
        </div>
      ) : (
        <div className={styles.sections}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Активні квитки</h2>
            {activeTickets.length ? (
              <div className={styles.ticketList}>
                {activeTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onRefund={handleRefund}
                    isProcessing={refundingTicketId === ticket.id}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Ticket}
                title="Немає активних квитків"
                description="Забронюйте та оплатіть квиток, щоб він з'явився тут."
              />
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Історія поїздок</h2>
            {historyTickets.length ? (
              <div className={styles.ticketList}>
                {historyTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Ticket}
                title="Історія порожня"
                description="Тут відображатимуться минулі, скасовані та повернені квитки."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
