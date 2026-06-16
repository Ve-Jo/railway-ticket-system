import { Link } from "react-router-dom";
import { Armchair, Calendar, Clock, TrainFront } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import styles from "./TripCard.module.css";

function formatDateTime(value) {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2
  }).format(Number(value));
}

function formatDuration(start, end) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} хв`;
  }

  if (minutes === 0) {
    return `${hours} год`;
  }

  return `${hours} год ${minutes} хв`;
}

function normalizeClassLabel(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase().replace(/[_-]+/g, " ");
  const compact = normalized.replace(/\s+/g, "");

  const labels = {
    compartment: "Купе",
    coupe: "Купе",
    kupe: "Купе",
    platzkart: "Плацкарт",
    platzcard: "Плацкарт",
    sleeper: "Плацкарт",
    lux: "Люкс",
    deluxe: "Люкс",
    suite: "Люкс",
    sv: "СВ",
    firstclass: "1 клас",
    first: "1 клас",
    business: "1 клас",
    secondclass: "2 клас",
    second: "2 клас",
    standard: "2 клас",
    thirdclass: "3 клас",
    third: "3 клас",
    economy: "3 клас",
    seated: "Сидячі",
    sitting: "Сидячі",
    seat: "Сидячі",
    shared: "Загальний"
  };

  if (labels[compact]) {
    return labels[compact];
  }

  const digitClass = normalized.match(/^([123])\s*class$/i);
  if (digitClass) {
    return `${digitClass[1]} клас`;
  }

  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickSeatClassEntries(source) {
  if (!source) return [];

  if (Array.isArray(source)) {
    return source.flatMap((item) => {
      if (typeof item === "string" || typeof item === "number") {
        const label = normalizeClassLabel(item);
        return label ? [{ label, seats: null }] : [];
      }

      if (item && typeof item === "object") {
        const label = normalizeClassLabel(
          item.label ?? item.name ?? item.className ?? item.classType ?? item.classCode ?? item.type ?? item.code
        );
        const seats = item.availableSeats ?? item.count ?? item.quantity ?? item.free ?? null;
        return label ? [{ label, seats }] : [];
      }

      return [];
    });
  }

  if (typeof source === "object") {
    return Object.entries(source).flatMap(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const label = normalizeClassLabel(value.label ?? value.name ?? value.className ?? value.classType ?? key);
        const seats = value.availableSeats ?? value.count ?? value.quantity ?? value.free ?? null;
        return label ? [{ label, seats }] : [];
      }

      if (typeof value === "number") {
        const label = normalizeClassLabel(key);
        return label ? [{ label, seats: value }] : [];
      }

      const label = normalizeClassLabel(value ?? key);
      return label ? [{ label, seats: null }] : [];
    });
  }

  const label = normalizeClassLabel(source);
  return label ? [{ label, seats: null }] : [];
}

function getSeatClassBadges(trip) {
  const candidates = [
    typeof trip.carriageClassCodes === "string" ? trip.carriageClassCodes.split("|") : null,
    typeof trip.carriage_class_codes === "string" ? trip.carriage_class_codes.split("|") : trip.carriage_class_codes,
    typeof trip.carriageTypes === "string" ? trip.carriageTypes.split("|") : null,
    typeof trip.carriage_types === "string" ? trip.carriage_types.split("|") : trip.carriage_types,
    trip.seatClasses,
    trip.seat_classes,
    trip.classes,
    trip.classTypes,
    trip.class_types,
    trip.carriageClasses,
    trip.carriage_classes,
    trip.availableSeatsByClass,
    trip.available_seats_by_class,
    trip.placeTypes,
    trip.place_types
  ];

  const unique = new Map();
  for (const candidate of candidates) {
    for (const entry of pickSeatClassEntries(candidate)) {
      const key = entry.label.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, entry);
      }
    }
  }

  return [...unique.values()];
}

function formatSeatClassBadge(entry) {
  if (typeof entry.seats === "number" && Number.isFinite(entry.seats)) {
    return `${entry.label} · ${entry.seats} місць`;
  }

  return entry.label;
}

export function TripCard({ trip, searchParams }) {
  const to = {
    pathname: `/trips/${trip.id}/seats`,
    search: searchParams?.toString() ?? ""
  };

  const seatClasses = getSeatClassBadges(trip);
  const availableSeats = Number(trip.availableSeats ?? 0);
  const isUnavailable = trip.isBookable === false || availableSeats <= 0;

  let availabilityLabel = "";
  if (trip.availabilityStatus === "departed") {
    availabilityLabel = "Рейс уже вирушив";
  } else if (trip.availabilityStatus === "cancelled") {
    availabilityLabel = "Рейс скасовано";
  } else if (availableSeats <= 0) {
    availabilityLabel = "Місць немає";
  }

  return (
    <article className={`${styles.card} ${isUnavailable ? styles.cardMuted : ""}`}>
      <div className={styles.main}>
        <div className={styles.left}>
          <div className={styles.route}>
            <span className={styles.routeCode}>{trip.routeCode}</span>
            <span className={styles.trainName}>{trip.trainName}</span>
          </div>

          <div className={styles.stations}>
            <div className={styles.stationBlock}>
              <strong>{trip.departureStation}</strong>
              <span className={styles.time}>
                <Clock size={14} />
                {formatDateTime(trip.departureAt)}
              </span>
            </div>

            <div className={styles.journey}>
              <span className={styles.duration}>
                <Clock size={14} />
                {formatDuration(trip.departureAt, trip.arrivalAt)}
              </span>
              <span className={styles.journeyHint}>
                <TrainFront size={14} />
                Прямий рейс
              </span>
            </div>

            <div className={styles.stationBlock}>
              <strong>{trip.arrivalStation}</strong>
              <span className={styles.time}>
                <Clock size={14} />
                {formatDateTime(trip.arrivalAt)}
              </span>
            </div>
          </div>

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <Calendar size={14} />
              {new Date(trip.departureAt).toLocaleDateString("uk-UA")}
            </span>
            <span className={styles.metaItem}>
              <Armchair size={14} />
              Вільних місць: {availableSeats}
            </span>
          </div>

          <div className={styles.classSection}>
            <span className={styles.classLabel}>Типи місць</span>
            <div className={styles.classList}>
              {seatClasses.length > 0 ? (
                seatClasses.map((entry) => (
                  <span key={entry.label} className={styles.classBadge}>
                    {formatSeatClassBadge(entry)}
                  </span>
                ))
              ) : (
                <span className={styles.classPlaceholder}>Тип вагона та класи місць відображаються тут автоматично.</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.summary}>
            <div className={styles.price}>{formatCurrency(trip.basePrice)}</div>
            {availabilityLabel ? <span className={styles.statusPill}>{availabilityLabel}</span> : null}
          </div>

          <div className={styles.footer}>
            {isUnavailable ? (
              <Button variant="secondary" disabled>
                Недоступно
              </Button>
            ) : (
              <Link to={to} state={{ tripSummary: trip }}>
                <Button variant="primary">Обрати місце</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
