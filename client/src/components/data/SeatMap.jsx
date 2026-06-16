import { useMemo } from "react";
import {
  AlertCircle,
  Armchair,
  Bath,
  Calendar,
  CheckCircle2,
  DoorOpen,
  LayoutGrid,
  MapPin,
  Receipt,
  Train,
  TrainFront
} from "lucide-react";
import { Card } from "../ui/Card.jsx";
import { StatusBadge } from "../ui/StatusBadge.jsx";
import { Alert } from "../ui/Alert.jsx";
import styles from "./SeatMap.module.css";

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

function getSeatStatusClass(status) {
  switch (status) {
    case "available":
      return styles.available;
    case "reserved":
      return styles.reserved;
    case "paid":
      return styles.paid;
    default:
      return styles.paid;
  }
}

function getSeatStatusLabel(status) {
  switch (status) {
    case "available":
      return "Вільно";
    case "reserved":
      return "Бронь";
    case "paid":
      return "Зайнято";
    default:
      return status;
  }
}

function getSelectionHint(tripIsBookable, isAuthenticated, userRole) {
  if (tripIsBookable === false) {
    return "Бронювання для цього рейсу вже закрите.";
  }

  if (!isAuthenticated) {
    return "Увійдіть як пасажир, щоб вибрати місце та перейти до бронювання.";
  }

  if (userRole !== "passenger") {
    return "Вибір місця для бронювання доступний лише для облікового запису пасажира.";
  }

  return "Оберіть будь-яке вільне місце на схемі.";
}

function normalizeCarriageSpec(carriage) {
  const rawType = String(carriage.type ?? "").trim().toLowerCase();
  const rawClass = String(carriage.classCode ?? "").trim().toLowerCase();
  const key = rawClass || rawType;

  if (["lux", "sv", "deluxe"].includes(key) || ["lux", "sv", "deluxe"].includes(rawType)) {
    return { label: "Люкс", layout: "lux" };
  }

  if (["coupe", "compartment", "kupe"].includes(key) || ["coupe", "compartment", "kupe"].includes(rawType)) {
    return { label: "Купе", layout: "coupe" };
  }

  if (["platzkart", "platzcard", "sleeper"].includes(key) || ["platzkart", "platzcard", "sleeper"].includes(rawType)) {
    return { label: "Плацкарт", layout: "platzkart" };
  }

  if (key === "first") {
    return { label: "1 клас", layout: "seated" };
  }

  if (key === "second") {
    return { label: "2 клас", layout: "seated" };
  }

  if (key === "third") {
    return { label: "3 клас", layout: "seated" };
  }

  if (rawType === "seated") {
    return { label: "Сидячий", layout: "seated" };
  }

  return { label: carriage.type || "Вагон", layout: "seated" };
}

function parseSeatToken(seatNumber) {
  const text = String(seatNumber ?? "").trim();
  const match = text.match(/^(\d+)\s*([A-Za-zА-Яа-яІіЇїЄє]?)$/);

  if (!match) {
    return {
      index: Number.MAX_SAFE_INTEGER,
      side: "Z",
      numeric: null
    };
  }

  return {
    index: Number(match[1]),
    side: (match[2] || "").toUpperCase(),
    numeric: Number(match[1])
  };
}

function buildSeatedColumns(seats) {
  const columns = new Map();

  for (const seat of seats) {
    const token = parseSeatToken(seat.number);
    const key = String(token.index);

    if (!columns.has(key)) {
      columns.set(key, {
        index: token.index,
        top: null,
        bottom: null
      });
    }

    const column = columns.get(key);
    const enrichedSeat = { ...seat, token };

    if (token.side === "B" || token.side === "D" || token.side === "F") {
      column.top = enrichedSeat;
    } else {
      column.bottom = enrichedSeat;
    }
  }

  return [...columns.values()].sort((a, b) => a.index - b.index);
}

function buildCompartments(seats, seatsPerCompartment) {
  const compartments = new Map();

  for (const seat of seats) {
    const token = parseSeatToken(seat.number);
    const numeric = token.numeric ?? 0;
    const compartmentIndex = Math.floor((Math.max(numeric, 1) - 1) / seatsPerCompartment) + 1;

    if (!compartments.has(compartmentIndex)) {
      compartments.set(compartmentIndex, {
        index: compartmentIndex,
        upper: [],
        lower: []
      });
    }

    const compartment = compartments.get(compartmentIndex);
    const type = String(seat.type ?? "").toLowerCase();

    if (type.includes("upper")) {
      compartment.upper.push(seat);
    } else {
      compartment.lower.push(seat);
    }
  }

  return [...compartments.values()].sort((a, b) => a.index - b.index);
}

function buildPlatzkartLayout(seats) {
  const main = [];
  const side = [];

  for (const seat of seats) {
    const token = parseSeatToken(seat.number);
    const type = String(seat.type ?? "").toLowerCase();

    if (type.includes("side")) {
      side.push({ ...seat, token });
    } else {
      main.push({ ...seat, token });
    }
  }

  return {
    compartments: buildCompartments(main, 4),
    sidePairs: buildCompartments(side, 2)
  };
}

function summarizeSeatLevels(seats) {
  return seats.reduce(
    (summary, seat) => {
      const type = String(seat.type ?? "").toLowerCase();
      if (type.includes("side-upper")) summary.sideUpper += 1;
      else if (type.includes("side-lower")) summary.sideLower += 1;
      else if (type.includes("upper")) summary.upper += 1;
      else summary.lower += 1;
      return summary;
    },
    { upper: 0, lower: 0, sideUpper: 0, sideLower: 0 }
  );
}

function renderSeatButton({ seat, carriage, trip, selectedSeat, onSelect, canSelect }) {
  if (!seat) {
    return <span className={styles.seatPlaceholder} />;
  }

  const isSelected = selectedSeat?.seatId === seat.id;
  const isDisabled = !canSelect || seat.status !== "available";

  return (
    <button
      key={seat.id}
      type="button"
      className={`${styles.seat} ${getSeatStatusClass(seat.status)} ${isSelected ? styles.selected : ""}`}
      onClick={() =>
        onSelect({
          tripId: trip.id,
          carriageId: carriage.id,
          carriageNumber: carriage.number,
          seatId: seat.id,
          seatNumber: seat.number,
          price: trip.basePrice
        })
      }
      disabled={isDisabled}
      title={getSeatStatusLabel(seat.status)}
      aria-pressed={isSelected}
    >
      <span className={styles.seatNumber}>
        <Armchair size={14} />
        {seat.number}
      </span>
      <span className={styles.seatStatus}>{getSeatStatusLabel(seat.status)}</span>
    </button>
  );
}

function renderSeatedLayout(carriage, trip, selectedSeat, onSelect, canSelect) {
  return (
    <div className={styles.wagonViewport}>
      <div className={styles.wagonShell}>
        <div className={styles.endFacility}>
          <span className={styles.facilityBox}>
            <Bath size={18} />
          </span>
        </div>

        <div className={styles.wagonGrid}>
          {carriage.layoutData.columns.map((column) => (
            <div key={`${carriage.id}-${column.index}`} className={styles.seatColumn}>
              {renderSeatButton({ seat: column.top, carriage, trip, selectedSeat, onSelect, canSelect })}
              {renderSeatButton({ seat: column.bottom, carriage, trip, selectedSeat, onSelect, canSelect })}
            </div>
          ))}
        </div>

        <div className={styles.endFacility}>
          <span className={styles.facilityBox}>
            <Bath size={18} />
          </span>
        </div>
      </div>

      <div className={styles.wagonFooterRail}>
        <span className={styles.serviceMarker}>
          <DoorOpen size={15} />
          Вхід
        </span>
        <span className={styles.serviceMarker}>
          <DoorOpen size={15} />
          Вихід
        </span>
      </div>
    </div>
  );
}

function renderCoupeLikeLayout(carriage, trip, selectedSeat, onSelect, canSelect) {
  return (
    <div className={styles.compartmentGrid}>
      {carriage.layoutData.compartments.map((compartment) => (
        <div key={`${carriage.id}-c-${compartment.index}`} className={styles.compartmentCard}>
          <div className={styles.compartmentHeader}>
            <span>Купе {compartment.index}</span>
          </div>
          <div className={styles.compartmentRows}>
            <div className={styles.compartmentRow}>
              {compartment.upper.length > 0
                ? compartment.upper.map((seat) =>
                    renderSeatButton({ seat, carriage, trip, selectedSeat, onSelect, canSelect })
                  )
                : <span className={styles.seatPlaceholder} />}
            </div>
            <div className={styles.compartmentRow}>
              {compartment.lower.length > 0
                ? compartment.lower.map((seat) =>
                    renderSeatButton({ seat, carriage, trip, selectedSeat, onSelect, canSelect })
                  )
                : <span className={styles.seatPlaceholder} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderPlatzkartLayout(carriage, trip, selectedSeat, onSelect, canSelect) {
  return (
    <div className={styles.platzkartLayout}>
      <div className={styles.compartmentGrid}>
        {carriage.layoutData.compartments.map((compartment) => (
          <div key={`${carriage.id}-p-${compartment.index}`} className={styles.compartmentCard}>
            <div className={styles.compartmentHeader}>
              <span>Секція {compartment.index}</span>
            </div>
            <div className={styles.compartmentRows}>
              <div className={styles.compartmentRow}>
                {compartment.upper.length > 0
                  ? compartment.upper.map((seat) =>
                      renderSeatButton({ seat, carriage, trip, selectedSeat, onSelect, canSelect })
                    )
                  : <span className={styles.seatPlaceholder} />}
              </div>
              <div className={styles.compartmentRow}>
                {compartment.lower.length > 0
                  ? compartment.lower.map((seat) =>
                      renderSeatButton({ seat, carriage, trip, selectedSeat, onSelect, canSelect })
                    )
                  : <span className={styles.seatPlaceholder} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {carriage.layoutData.sidePairs.length > 0 ? (
        <div className={styles.sideBerthRow}>
          {carriage.layoutData.sidePairs.map((pair) => (
            <div key={`${carriage.id}-s-${pair.index}`} className={styles.sideBerthCard}>
              <span className={styles.sideBerthLabel}>Бокові місця</span>
              <div className={styles.compartmentRows}>
                <div className={styles.compartmentRow}>
                  {pair.upper.length > 0
                    ? pair.upper.map((seat) =>
                        renderSeatButton({ seat, carriage, trip, selectedSeat, onSelect, canSelect })
                      )
                    : <span className={styles.seatPlaceholder} />}
                </div>
                <div className={styles.compartmentRow}>
                  {pair.lower.length > 0
                    ? pair.lower.map((seat) =>
                        renderSeatButton({ seat, carriage, trip, selectedSeat, onSelect, canSelect })
                      )
                    : <span className={styles.seatPlaceholder} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SeatMap({
  trip,
  tripSummary,
  selectedSeat,
  onSelect,
  isAuthenticated,
  userRole,
  showAuthNotice = false,
  asideFooter = null
}) {
  const carriageStats = useMemo(() => {
    return (trip?.carriages ?? []).map((carriage) => {
      const available = carriage.seats.filter((seat) => seat.status === "available").length;
      const reserved = carriage.seats.filter((seat) => seat.status === "reserved").length;
      const paid = carriage.seats.filter((seat) => seat.status === "paid").length;
      const spec = normalizeCarriageSpec(carriage);

      let layoutData = {};
      if (spec.layout === "seated") {
        layoutData = { columns: buildSeatedColumns(carriage.seats) };
      } else if (spec.layout === "platzkart") {
        layoutData = buildPlatzkartLayout(carriage.seats);
      } else if (spec.layout === "lux") {
        layoutData = { compartments: buildCompartments(carriage.seats, 2) };
      } else {
        layoutData = { compartments: buildCompartments(carriage.seats, 4) };
      }

      return {
        ...carriage,
        spec,
        available,
        reserved,
        paid,
        totalSeats: carriage.seats.length,
        seatSummary: summarizeSeatLevels(carriage.seats),
        layoutData
      };
    });
  }, [trip]);

  const totals = useMemo(() => {
    return carriageStats.reduce(
      (accumulator, carriage) => ({
        available: accumulator.available + carriage.available,
        reserved: accumulator.reserved + carriage.reserved,
        paid: accumulator.paid + carriage.paid,
        totalSeats: accumulator.totalSeats + carriage.totalSeats
      }),
      { available: 0, reserved: 0, paid: 0, totalSeats: 0 }
    );
  }, [carriageStats]);

  const canSelect = trip?.isBookable !== false && isAuthenticated && userRole === "passenger";
  const selectionHint = getSelectionHint(trip?.isBookable, isAuthenticated, userRole);

  return (
    <div className={styles.layout}>
      <Card className={styles.summary}>
        <div className={styles.summaryHeader}>
          <div className={styles.summaryRoute}>
            <span className={styles.routeCode}>{trip.routeCode}</span>
            <span className={styles.trainName}>
              <TrainFront size={16} />
              {trip.trainName}
            </span>
          </div>
          <div className={styles.priceBlock}>
            <span className={styles.priceLabel}>Базова вартість</span>
            <div className={styles.price}>{formatCurrency(trip.basePrice)}</div>
          </div>
        </div>

        <div className={styles.summaryMeta}>
          <span className={styles.metaItem}>
            <MapPin size={14} />
            {tripSummary?.departureStation ?? trip.departureStation ?? "Станція відправлення"} →
            {" "}
            {tripSummary?.arrivalStation ?? trip.arrivalStation ?? "Станція прибуття"}
          </span>
          <span className={styles.metaItem}>
            <Calendar size={14} />
            {formatDateTime(trip.departureAt)} - {formatDateTime(trip.arrivalAt)}
          </span>
        </div>

        <div className={styles.tripInsights}>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>
              <Train size={14} />
              Вагони
            </span>
            <strong>{carriageStats.length}</strong>
          </div>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>
              <Armchair size={14} />
              Вільні місця
            </span>
            <strong>{totals.available}</strong>
          </div>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>
              <LayoutGrid size={14} />
              Усього місць
            </span>
            <strong>{totals.totalSeats}</strong>
          </div>
        </div>
      </Card>

      {carriageStats.length === 0 ? (
        <Card className={styles.emptyCard}>
          <div className={styles.emptyIcon}>
            <Train size={20} />
          </div>
          <div className={styles.emptyContent}>
            <h3 className={styles.emptyTitle}>Для цього рейсу ще немає доступних вагонів</h3>
            <p className={styles.emptyText}>
              Спробуйте повернутися до списку рейсів і вибрати інший варіант або перевірте цей рейс пізніше.
            </p>
          </div>
        </Card>
      ) : (
        <div className={styles.experience}>
          <div className={styles.mainColumn}>
            <Card className={styles.carriageOverviewCard}>
              <div className={styles.selectorHeader}>
                <div>
                  <h3 className={styles.selectorTitle}>Схема всіх вагонів</h3>
                  <p className={styles.selectorText}>
                    Кожен вагон має свій тип і окремий шаблон відображення: сидячий, 1 клас, 2 клас, купе, люкс або плацкарт.
                  </p>
                </div>
              </div>
            </Card>

            {carriageStats.map((carriage) => (
              <Card key={carriage.id} className={styles.carriageCard}>
                <div className={styles.carriageHeader}>
                  <div>
                    <h3 className={styles.carriageTitle}>
                      <Train size={18} />
                      Вагон {carriage.number}
                    </h3>
                    <div className={styles.carriageMeta}>
                      <p className={styles.carriageType}>{carriage.spec.label}</p>
                      {(carriage.spec.layout === "coupe" || carriage.spec.layout === "lux" || carriage.spec.layout === "platzkart") ? (
                        <span className={styles.levelSummary}>
                          Верхніх: {carriage.seatSummary.upper + carriage.seatSummary.sideUpper}
                          {" | "}
                          Нижніх: {carriage.seatSummary.lower + carriage.seatSummary.sideLower}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={styles.legend}>
                  <StatusBadge status="available">Вільно ({carriage.available})</StatusBadge>
                  <StatusBadge status="reserved">Бронь ({carriage.reserved})</StatusBadge>
                  <StatusBadge status="paid">Зайнято ({carriage.paid})</StatusBadge>
                  {(carriage.spec.layout === "coupe" || carriage.spec.layout === "lux" || carriage.spec.layout === "platzkart") ? (
                    <>
                      <span className={styles.legendLevel}>Верхні полки</span>
                      <span className={styles.legendLevel}>Нижні полки</span>
                    </>
                  ) : null}
                </div>

                {carriage.totalSeats === 0 ? (
                  <div className={styles.inlineState}>
                    <AlertCircle size={18} />
                    <span>У цьому вагоні ще немає місць для вибору.</span>
                  </div>
                ) : (
                  <div className={styles.carriageBody}>
                    {carriage.spec.layout === "seated"
                      ? renderSeatedLayout(carriage, trip, selectedSeat, onSelect, canSelect)
                      : carriage.spec.layout === "platzkart"
                        ? renderPlatzkartLayout(carriage, trip, selectedSeat, onSelect, canSelect)
                        : renderCoupeLikeLayout(carriage, trip, selectedSeat, onSelect, canSelect)}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <aside className={styles.asideColumn}>
            {showAuthNotice ? (
              <Alert variant="warning" title="Потрібен вхід">
                Увійдіть в обліковий запис пасажира, щоб створити бронь. Перегляд доступності місць залишається відкритим.
              </Alert>
            ) : null}

            <Card className={styles.selectionCard}>
              <div className={styles.selectionHeader}>
                <Receipt size={18} />
                <h3 className={styles.selectionTitle}>Ваш вибір</h3>
              </div>

              {selectedSeat ? (
                <div className={styles.selectionContent}>
                  <div className={styles.selectionState}>
                    <CheckCircle2 size={18} />
                    <span>Місце вибрано</span>
                  </div>
                  <div className={styles.selectionDetails}>
                    <div>
                      <span className={styles.selectionLabel}>Вагон</span>
                      <strong>{selectedSeat.carriageNumber}</strong>
                    </div>
                    <div>
                      <span className={styles.selectionLabel}>Місце</span>
                      <strong>{selectedSeat.seatNumber}</strong>
                    </div>
                    <div>
                      <span className={styles.selectionLabel}>До сплати</span>
                      <strong>{formatCurrency(selectedSeat.price)}</strong>
                    </div>
                  </div>
                  <p className={styles.selectionHint}>
                    Якщо хочете інший варіант, просто натисніть на інше вільне місце.
                  </p>
                </div>
              ) : (
                <div className={styles.selectionEmpty}>
                  <div className={styles.emptyIcon}>
                    <Armchair size={20} />
                  </div>
                  <p className={styles.selectionEmptyTitle}>Місце ще не вибрано</p>
                  <p className={styles.selectionHint}>{selectionHint}</p>
                </div>
              )}
            </Card>

            {asideFooter ? <div className={styles.asideFooter}>{asideFooter}</div> : null}
          </aside>
        </div>
      )}
    </div>
  );
}
