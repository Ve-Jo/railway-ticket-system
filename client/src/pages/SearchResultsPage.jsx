import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { ApiError, apiRequest } from "../api/apiClient.js";
import { TripCard } from "../components/data/TripCard.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Alert } from "../components/ui/Alert.jsx";
import { Button } from "../components/ui/Button.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import styles from "./SearchResultsPage.module.css";

export function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(
    () => ({
      fromStationId: searchParams.get("fromStationId") ?? "",
      toStationId: searchParams.get("toStationId") ?? "",
      date: searchParams.get("date") ?? ""
    }),
    [searchParams]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadTrips() {
      if (!query.fromStationId || !query.toStationId || !query.date) {
        setItems([]);
        setError("Параметри пошуку неповні. Поверніться до форми пошуку.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const params = new URLSearchParams(query);
        const response = await apiRequest(`/trips/search?${params.toString()}`);
        if (!isMounted) return;
        setItems(response?.items ?? []);
      } catch (requestError) {
        if (!isMounted) return;
        setError(requestError instanceof ApiError ? requestError.message : "Не вдалося завантажити рейси. Спробуйте ще раз.");
        setItems([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTrips();
    return () => {
      isMounted = false;
    };
  }, [query]);

  const title = isLoading
    ? "Завантаження рейсів..."
    : error
      ? "Помилка під час завантаження"
      : items.length > 0
        ? `Знайдено рейсів: ${items.length}`
        : "Рейсів не знайдено";

  const summaryTrip = items[0] ?? null;
  const description = summaryTrip && query.date
    ? `Маршрут: ${summaryTrip.departureStation} → ${summaryTrip.arrivalStation}, дата: ${query.date}`
    : query.date
      ? `Дата подорожі: ${query.date}. Перегляньте доступні рейси та класи вагонів.`
      : "Результати пошуку доступних рейсів.";

  return (
    <div className={styles.page}>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link to={`/search?${searchParams.toString()}`}>
            <Button variant="secondary" size="md">
              <Search size={16} />
              Змінити пошук
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className={styles.state}>
          <Loader2 className={styles.spinner} size={32} />
          <span>Завантаження рейсів...</span>
        </div>
      ) : null}

      {!isLoading && error ? <Alert variant="error">{error}</Alert> : null}

      {!isLoading && !error && items.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Рейсів не знайдено"
          description="Спробуйте змінити дату або станції пошуку."
          action={
            <Link to="/search">
              <Button variant="primary">Новий пошук</Button>
            </Link>
          }
        />
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className={styles.list}>
          {items.map((trip) => (
            <TripCard key={trip.id} trip={trip} searchParams={searchParams} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
