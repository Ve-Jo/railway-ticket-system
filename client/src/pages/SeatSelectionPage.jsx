import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Info, Loader2, Ticket } from "lucide-react";
import { ApiError, apiRequest } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { SeatMap } from "../components/data/SeatMap.jsx";
import { Alert } from "../components/ui/Alert.jsx";
import { Button } from "../components/ui/Button.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import styles from "./SeatSelectionPage.module.css";

function formatCurrency(value) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2
  }).format(Number(value));
}

export function SeatSelectionPage() {
  const { tripId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const tripSummary = location.state?.tripSummary;

  const [details, setDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSeat, setSelectedSeat] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTrip() {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest(`/trips/${tripId}`);
        if (!isMounted) return;
        setDetails(response);
      } catch (requestError) {
        if (!isMounted) return;
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Не вдалося завантажити деталі рейсу. Спробуйте ще раз."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTrip();
    return () => {
      isMounted = false;
    };
  }, [tripId]);

  const handleSeatSelect = (seat) => {
    setSelectedSeat(seat);
  };

  const handleProceedToBooking = () => {
    if (!selectedSeat || !details?.trip || details.trip.isBookable === false) {
      return;
    }

    navigate("/booking", {
      state: {
        bookingDraft: selectedSeat,
        tripSummary: {
          ...(tripSummary ?? {}),
          id: details.trip.id,
          routeCode: details.trip.routeCode,
          trainName: details.trip.trainName,
          departureAt: details.trip.departureAt,
          arrivalAt: details.trip.arrivalAt,
          basePrice: details.trip.basePrice,
          departureStation: tripSummary?.departureStation ?? details.trip.departureStation ?? "Станція відправлення",
          arrivalStation: tripSummary?.arrivalStation ?? details.trip.arrivalStation ?? "Станція прибуття"
        }
      }
    });
  };

  const title = details?.trip?.routeCode ? `Вибір місця: ${details.trip.routeCode}` : "Вибір місця";

  const helperText = useMemo(() => {
    if (details?.trip?.isBookable === false) {
      return "Цей рейс уже вирушив або більше недоступний для бронювання. Схема місць залишається доступною лише для демонстрації.";
    }

    if (!isAuthenticated) {
      return "Ви можете переглянути зайнятість, але для бронювання потрібно увійти як пасажир.";
    }

    if (user?.role !== "passenger") {
      return "Схема місць доступна для перегляду, але оформлення бронювання доступне лише пасажирам.";
    }

    if (selectedSeat) {
      return `Підтверджено вибір: вагон ${selectedSeat.carriageNumber}, місце ${selectedSeat.seatNumber}.`;
    }

    return "Оберіть будь-яке вільне місце на схемі вагонів, щоб перейти до бронювання.";
  }, [details?.trip?.isBookable, isAuthenticated, selectedSeat, user?.role]);

  const bookingPanel = (
    <section className={styles.bookingPanel}>
      <div className={styles.bookingSummary}>
        <div className={styles.bookingHeader}>
          <span className={styles.bookingIcon}>
            <Ticket size={18} />
          </span>
          <div>
            <h3 className={styles.bookingTitle}>Готовність до бронювання</h3>
            <p className={styles.bookingText}>
              {selectedSeat
                ? "Ваше місце вже обране. Можна переходити до оформлення."
                : "Після вибору місця тут з’явиться коротке резюме бронювання."}
            </p>
          </div>
        </div>

        {selectedSeat ? (
          <div className={styles.bookingDetails}>
            <div className={styles.bookingState}>
              <CheckCircle2 size={18} />
              <span>Місце підтверджено</span>
            </div>
            <div className={styles.bookingMeta}>
              <span>Вагон {selectedSeat.carriageNumber}</span>
              <span>Місце {selectedSeat.seatNumber}</span>
              <span>{formatCurrency(selectedSeat.price)}</span>
            </div>
          </div>
        ) : (
          <div className={styles.bookingHint}>
            <Info size={16} />
            <span>Кнопка оформлення стане активною після вибору доступного місця.</span>
          </div>
        )}
      </div>

      <Button
        variant="primary"
        onClick={handleProceedToBooking}
        disabled={!selectedSeat || details?.trip?.isBookable === false}
        className={styles.bookingAction}
      >
        {details?.trip?.isBookable === false
          ? "Бронювання недоступне"
          : selectedSeat
            ? "Перейти до бронювання"
            : "Оберіть місце для продовження"}
      </Button>
    </section>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title={title}
        description="Оберіть вільне місце у вагоні та продовжте до оформлення броні."
        actions={
          selectedSeat && details?.trip?.isBookable !== false ? (
            <Button variant="primary" onClick={handleProceedToBooking}>
              Продовжити з місцем {selectedSeat.seatNumber}
            </Button>
          ) : null
        }
      />

      <div className={styles.toolbar}>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Назад до результатів
        </Button>
      </div>

      <section className={styles.introPanel}>
        <div className={styles.introCopy}>
          <p className={styles.introEyebrow}>План вибору</p>
          <h2 className={styles.introTitle}>Усі доступні вагони на одній схемі</h2>
          <p className={styles.introText}>{helperText}</p>
        </div>
        <div className={styles.introChecklist}>
          <span className={styles.checkItem}>1. Перегляньте всі вагони одразу</span>
          <span className={styles.checkItem}>2. Оберіть вільне місце на схемі</span>
          <span className={styles.checkItem}>3. Перейдіть до оформлення бронювання</span>
        </div>
      </section>

      {isAuthenticated && user?.role !== "passenger" ? (
        <Alert variant="info" title="Інформація">
          Бронювання доступне для пасажирів. Ви можете переглядати розташування місць.
        </Alert>
      ) : null}

      {!isLoading && details?.trip?.isBookable === false ? (
        <Alert variant="info" title="Бронювання закрите">
          Рейс уже вирушив або переведений у завершений стан. Для демонстрації можна переглянути схему вагонів, але оформити квиток уже не можна.
        </Alert>
      ) : null}

      {isLoading ? (
        <div className={styles.state}>
          <Loader2 className={styles.spinner} size={32} />
          <span>Завантаження деталей рейсу...</span>
        </div>
      ) : null}

      {!isLoading && error ? <Alert variant="error">{error}</Alert> : null}

      {!isLoading && !error && details?.trip ? (
        <SeatMap
          trip={{
            ...details.trip,
            carriages: details.carriages ?? []
          }}
          tripSummary={tripSummary}
          selectedSeat={selectedSeat}
          onSelect={handleSeatSelect}
          isAuthenticated={isAuthenticated}
          userRole={user?.role}
          showAuthNotice={!isAuthenticated}
          asideFooter={bookingPanel}
        />
      ) : null}
    </div>
  );
}
