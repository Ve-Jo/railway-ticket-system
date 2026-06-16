import { useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { PageSection } from "../components/PageSection.jsx";
import styles from "./AdminPage.module.css";

const TAB_DEFINITIONS = [
  { id: "stations", label: "Станції" },
  { id: "routes", label: "Маршрути" },
  { id: "trips", label: "Рейси" },
  { id: "fleet", label: "Рухомий склад" },
  { id: "users", label: "Користувачі" },
  { id: "logs", label: "Журнал операцій" }
];

const EMPTY_STATION_FORM = {
  name: "",
  code: "",
  city: "",
  address: "",
  isActive: true
};

const EMPTY_ROUTE_FORM = {
  code: "",
  name: "",
  fromStationId: "",
  toStationId: "",
  isActive: true,
  stops: []
};

const EMPTY_TRIP_FORM = {
  routeId: "",
  trainId: "",
  tripCode: "",
  departureAt: "",
  arrivalAt: "",
  basePrice: "",
  status: "scheduled",
  saleStartAt: "",
  saleEndAt: ""
};

const EMPTY_TRAIN_FORM = {
  name: "",
  code: "",
  category: "standard",
  isActive: true
};

const EMPTY_CARRIAGE_FORM = {
  trainId: "",
  number: "",
  type: "",
  classCode: "standard",
  seatCapacity: "",
  isActive: true
};

const EMPTY_SEAT_FORM = {
  carriageId: "",
  number: "",
  seatType: "standard",
  classType: "standard",
  isActive: true
};

const EMPTY_USER_FORM = {
  username: "",
  email: "",
  fullName: "",
  phone: "",
  password: "",
  role: "cashier"
};

function extractItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items;
  }

  return [];
}

function toInputDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) {
    return "Не вказано";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) {
    return "Не вказано";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCurrency(value) {
  if (value == null || value === "") {
    return "Не вказано";
  }

  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2
  }).format(Number(value));
}

function parseJsonStops(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeStation(item) {
  if (!item) return null;
  return {
    id: item.id,
    name: item.name ?? "",
    code: item.code ?? "",
    city: item.city ?? "",
    address: item.address ?? "",
    isActive: Boolean(item.isActive ?? item.is_active ?? 1)
  };
}

function normalizeRoute(item) {
  if (!item) return null;
  return {
    id: item.id,
    code: item.code ?? item.routeCode ?? "",
    name: item.name ?? "",
    fromStationId: item.fromStationId ?? item.from_station_id ?? item.originStationId ?? item.origin_station_id ?? "",
    toStationId: item.toStationId ?? item.to_station_id ?? item.destinationStationId ?? item.destination_station_id ?? "",
    fromStationName: item.fromStationName ?? item.originStationName ?? item.departureStation ?? "",
    toStationName: item.toStationName ?? item.destinationStationName ?? item.arrivalStation ?? "",
    isActive: Boolean(item.isActive ?? item.is_active ?? 1),
    stops: parseJsonStops(item.stops ?? item.routeStations ?? item.route_stations ?? [])
  };
}

function normalizeTrip(item) {
  if (!item) return null;
  return {
    id: item.id,
    routeId: item.routeId ?? item.route_id ?? "",
    trainId: item.trainId ?? item.train_id ?? "",
    tripCode: item.tripCode ?? item.trip_code ?? "",
    routeCode: item.routeCode ?? "",
    trainName: item.trainName ?? "",
    departureAt: item.departureAt ?? item.departure_at ?? "",
    arrivalAt: item.arrivalAt ?? item.arrival_at ?? "",
    departureStation: item.departureStation ?? "",
    arrivalStation: item.arrivalStation ?? "",
    basePrice: item.basePrice ?? item.base_price ?? "",
    status: item.status ?? "scheduled",
    saleStartAt: item.saleStartAt ?? item.sale_start_at ?? "",
    saleEndAt: item.saleEndAt ?? item.sale_end_at ?? "",
    availableSeats: item.availableSeats ?? item.available_seats ?? null
  };
}

function normalizeTrain(item) {
  if (!item) return null;
  return {
    id: item.id,
    code: item.code ?? "",
    name: item.name ?? "",
    category: item.category ?? "standard",
    isActive: Boolean(item.isActive ?? item.is_active ?? 1),
    carriageCount: item.carriageCount ?? item.carriage_count ?? null
  };
}

function normalizeCarriage(item) {
  if (!item) return null;
  return {
    id: item.id,
    trainId: item.trainId ?? item.train_id ?? "",
    trainName: item.trainName ?? "",
    trainCode: item.trainCode ?? "",
    number: item.number ?? item.carriageNumber ?? "",
    type: item.type ?? item.carriageType ?? "",
    classCode: item.classCode ?? item.class_code ?? "",
    seatCapacity: item.seatCapacity ?? item.seat_capacity ?? item.seatCount ?? item.seat_count ?? 50,
    isActive: Boolean(item.isActive ?? item.is_active ?? 1),
    seatsCount: item.seatsCount ?? item.seats_count ?? null
  };
}

function normalizeSeat(item) {
  if (!item) return null;
  return {
    id: item.id,
    carriageId: item.carriageId ?? item.carriage_id ?? "",
    carriageNumber: item.carriageNumber ?? "",
    trainId: item.trainId ?? "",
    trainCode: item.trainCode ?? "",
    number: item.number ?? item.seatNumber ?? "",
    seatType: item.seatType ?? item.seat_type ?? "standard",
    classType: item.classType ?? item.class_type ?? item.classCode ?? "standard",
    isActive: Boolean(item.isActive ?? item.is_active ?? 1)
  };
}

function normalizeUser(item) {
  if (!item) return null;
  return {
    id: item.id,
    login: item.login ?? item.username ?? "",
    email: item.email ?? "",
    fullName: item.fullName ?? item.full_name ?? "",
    role: item.role ?? "passenger",
    isActive: Boolean(item.isActive ?? item.is_active ?? 1)
  };
}

function normalizeLog(item) {
  if (!item) return null;
  return {
    id: item.id,
    actorUserId: item.actorUserId ?? item.actor_user_id ?? null,
    actorLogin: item.actorLogin ?? item.actor_login ?? "",
    actorFullName: item.actorFullName ?? item.actor_full_name ?? "",
    entityType: item.entityType ?? item.entity_type ?? "",
    entityId: item.entityId ?? item.entity_id ?? null,
    action: item.action ?? "",
    resultStatus: item.resultStatus ?? item.result_status ?? "",
    ipAddress: item.ipAddress ?? item.ip_address ?? "",
    details: item.details ?? null,
    createdAt: item.createdAt ?? item.created_at ?? ""
  };
}

function buildOptions(items, getLabel) {
  return items.map((item) => ({
    value: String(item.id),
    label: getLabel(item)
  }));
}

function resolveErrorMessage(error, fallback) {
  return error instanceof ApiError ? error.message : fallback;
}

function EntityList({ items, emptyText, renderItem }) {
  if (!items.length) {
    return (
      <div className={styles.stateCard}>
        <p>{emptyText}</p>
      </div>
    );
  }

  return <div className={styles.entityList}>{items.map(renderItem)}</div>;
}

function StationsSection({ stations, state, setState, onReload }) {
  const [form, setForm] = useState(EMPTY_STATION_FORM);
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setForm(EMPTY_STATION_FORM);
    setEditingId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, isSaving: true, error: "", success: "" }));

    try {
      const path = editingId ? `/admin/stations/${editingId}` : "/admin/stations";
      const method = editingId ? "PATCH" : "POST";
      await apiRequest(path, {
        method,
        body: {
          ...form,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          city: form.city.trim(),
          address: form.address.trim() || null
        }
      });
      setState((current) => ({
        ...current,
        isSaving: false,
        success: editingId ? "Станцію оновлено." : "Станцію створено."
      }));
      resetForm();
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: resolveErrorMessage(error, "Не вдалося зберегти станцію.")
      }));
    }
  };

  const removeStation = async (stationId) => {
    setState((current) => ({ ...current, isDeletingId: stationId, error: "", success: "" }));

    try {
      await apiRequest(`/admin/stations/${stationId}`, { method: "DELETE" });
      setState((current) => ({
        ...current,
        isDeletingId: null,
        success: `Станцію #${stationId} видалено.`
      }));
      if (editingId === stationId) {
        resetForm();
      }
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isDeletingId: null,
        error: resolveErrorMessage(error, "Не вдалося видалити станцію.")
      }));
    }
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}>
        <div>
          <h3>Станції</h3>
          <p>Керуйте назвами станцій, містом, адресою та активністю, що використовуються в пошуку та побудові маршрутів.</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onReload} disabled={state.isLoading}>
          {state.isLoading ? "Оновлення..." : "Оновити"}
        </button>
      </div>

      {state.success ? <p className={styles.success}>{state.success}</p> : null}
      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      <div className={styles.workspaceGrid}>
        <div className={styles.panel}>
          {state.isLoading ? (
            <div className={styles.stateCard}>
              <p>Завантаження станцій...</p>
            </div>
          ) : (
            <EntityList
              items={stations}
              emptyText="Ще немає станцій."
              renderItem={(station) => (
                <article key={station.id} className={styles.entityCard}>
                  <div>
                    <h4>{station.name}</h4>
                    <p>
                      {station.code} · {station.city || "—"}
                      {station.address ? `, ${station.address}` : ""}
                    </p>
                    {station.isActive ? null : <p>Неактивна</p>}
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        setEditingId(station.id);
                        setForm({
                          name: station.name,
                          code: station.code,
                          city: station.city,
                          address: station.address,
                          isActive: station.isActive
                        });
                      }}
                    >
                      Редагувати
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => removeStation(station.id)}
                      disabled={state.isDeletingId === station.id}
                    >
                      {state.isDeletingId === station.id ? "Видалення..." : "Видалити"}
                    </button>
                  </div>
                </article>
              )}
            />
          )}
        </div>

        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.formHeader}>
            <h4>{editingId ? "Редагувати станцію" : "Створити станцію"}</h4>
            {editingId ? (
              <button type="button" className={styles.textButton} onClick={resetForm}>
                Скинути
              </button>
            ) : null}
          </div>

          <label className={styles.field}>
            <span>Назва</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Київ-Пасажирський"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Код</span>
            <input
              type="text"
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              placeholder="KYI"
              maxLength={10}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Місто</span>
            <input
              type="text"
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              placeholder="Київ"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Адреса</span>
            <input
              type="text"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Вулиця..."
            />
          </label>

          <label className={styles.field} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span>Активна</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
          </label>

          <button type="submit" className={styles.primaryButton} disabled={state.isSaving}>
            {state.isSaving ? "Збереження..." : editingId ? "Оновити станцію" : "Створити станцію"}
          </button>
        </form>
      </div>
    </section>
  );
}

function RoutesSection({ routes, stations, state, setState, onReload }) {
  const [form, setForm] = useState(EMPTY_ROUTE_FORM);
  const [editingId, setEditingId] = useState(null);

  const stationOptions = useMemo(
    () => buildOptions(stations, (station) => `${station.name} (${station.code})`),
    [stations]
  );

  const resetForm = () => {
    setForm(EMPTY_ROUTE_FORM);
    setEditingId(null);
  };

  useEffect(() => {
    if (!editingId && form.fromStationId && form.toStationId && form.stops.length === 0) {
      setForm((current) => ({
        ...current,
        stops: [
          {
            stationId: Number(form.fromStationId),
            stopOrder: 1,
            arrivalOffsetMinutes: null,
            departureOffsetMinutes: 0,
            stopDurationMinutes: 0,
            distanceFromOriginKm: 0
          },
          {
            stationId: Number(form.toStationId),
            stopOrder: 2,
            arrivalOffsetMinutes: 60,
            departureOffsetMinutes: null,
            stopDurationMinutes: 0,
            distanceFromOriginKm: 100
          }
        ]
      }));
    }
  }, [editingId, form.fromStationId, form.toStationId, form.stops.length]);

  const submit = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, isSaving: true, error: "", success: "" }));

    try {
      const path = editingId ? `/admin/routes/${editingId}` : "/admin/routes";
      const method = editingId ? "PATCH" : "POST";
      const body = {
        ...form,
        fromStationId: Number(form.fromStationId),
        toStationId: Number(form.toStationId),
        isActive: form.isActive
      };

      if (editingId || form.stops.length > 0) {
        body.stops = form.stops.map((stop) => ({
          stationId: Number(stop.stationId),
          stopOrder: Number(stop.stopOrder),
          arrivalOffsetMinutes: stop.arrivalOffsetMinutes === "" || stop.arrivalOffsetMinutes == null
            ? null
            : Number(stop.arrivalOffsetMinutes),
          departureOffsetMinutes: stop.departureOffsetMinutes === "" || stop.departureOffsetMinutes == null
            ? null
            : Number(stop.departureOffsetMinutes),
          stopDurationMinutes: Number(stop.stopDurationMinutes) || 0,
          distanceFromOriginKm: stop.distanceFromOriginKm === "" || stop.distanceFromOriginKm == null
            ? null
            : Number(stop.distanceFromOriginKm)
        }));
      }

      await apiRequest(path, { method, body });
      setState((current) => ({
        ...current,
        isSaving: false,
        success: editingId ? "Маршрут оновлено." : "Маршрут створено."
      }));
      resetForm();
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: resolveErrorMessage(error, "Не вдалося зберегти маршрут.")
      }));
    }
  };

  const removeRoute = async (routeId) => {
    setState((current) => ({ ...current, isDeletingId: routeId, error: "", success: "" }));

    try {
      await apiRequest(`/admin/routes/${routeId}`, { method: "DELETE" });
      setState((current) => ({
        ...current,
        isDeletingId: null,
        success: `Маршрут #${routeId} видалено.`
      }));
      if (editingId === routeId) {
        resetForm();
      }
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isDeletingId: null,
        error: resolveErrorMessage(error, "Не вдалося видалити маршрут.")
      }));
    }
  };

  const updateStop = (index, field, value) => {
    setForm((current) => {
      const nextStops = [...current.stops];
      nextStops[index] = { ...nextStops[index], [field]: value };
      return { ...current, stops: nextStops };
    });
  };

  const addStop = () => {
    setForm((current) => {
      const maxOrder = current.stops.reduce((max, stop) => Math.max(max, Number(stop.stopOrder) || 0), 0);
      return {
        ...current,
        stops: [
          ...current.stops,
          {
            stationId: "",
            stopOrder: maxOrder + 1,
            arrivalOffsetMinutes: "",
            departureOffsetMinutes: "",
            stopDurationMinutes: 0,
            distanceFromOriginKm: ""
          }
        ]
      };
    });
  };

  const removeStop = (index) => {
    setForm((current) => ({
      ...current,
      stops: current.stops.filter((_, i) => i !== index)
    }));
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}>
        <div>
          <h3>Маршрути</h3>
          <p>Пов'яжіть станції відправлення та прибуття, керуйте активністю та редагуйте проміжні зупинки.</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onReload} disabled={state.isLoading}>
          {state.isLoading ? "Оновлення..." : "Оновити"}
        </button>
      </div>

      {state.success ? <p className={styles.success}>{state.success}</p> : null}
      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      <div className={styles.workspaceGrid}>
        <div className={styles.panel}>
          {state.isLoading ? (
            <div className={styles.stateCard}>
              <p>Завантаження маршрутів...</p>
            </div>
          ) : (
            <EntityList
              items={routes}
              emptyText="Ще не створено маршрутів."
              renderItem={(route) => (
                <article key={route.id} className={styles.entityCard}>
                  <div>
                    <h4>{route.code || `Маршрут #${route.id}`}</h4>
                    <p>
                      {route.fromStationName || "Невідомо"} → {route.toStationName || "Невідомо"}
                    </p>
                    {route.name ? <p>{route.name}</p> : null}
                    <p>Зупинок: {route.stops.length}{route.isActive ? "" : " · Неактивний"}</p>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        setEditingId(route.id);
                        setForm({
                          code: route.code,
                          name: route.name,
                          fromStationId: route.fromStationId ? String(route.fromStationId) : "",
                          toStationId: route.toStationId ? String(route.toStationId) : "",
                          isActive: route.isActive,
                          stops: Array.isArray(route.stops) ? route.stops : []
                        });
                      }}
                    >
                      Редагувати
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => removeRoute(route.id)}
                      disabled={state.isDeletingId === route.id}
                    >
                      {state.isDeletingId === route.id ? "Видалення..." : "Видалити"}
                    </button>
                  </div>
                </article>
              )}
            />
          )}
        </div>

        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.formHeader}>
            <h4>{editingId ? "Редагувати маршрут" : "Створити маршрут"}</h4>
            {editingId ? (
              <button type="button" className={styles.textButton} onClick={resetForm}>
                Скинути
              </button>
            ) : null}
          </div>

          <label className={styles.field}>
            <span>Код маршруту</span>
            <input
              type="text"
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              placeholder="IC-701"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Назва</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Київ — Львів"
            />
          </label>

          <label className={styles.field}>
            <span>Станція відправлення</span>
            <select
              value={form.fromStationId}
              onChange={(event) => setForm((current) => ({ ...current, fromStationId: event.target.value }))}
              required
            >
              <option value="">Оберіть станцію</option>
              {stationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Станція прибуття</span>
            <select
              value={form.toStationId}
              onChange={(event) => setForm((current) => ({ ...current, toStationId: event.target.value }))}
              required
            >
              <option value="">Оберіть станцію</option>
              {stationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span>Активний</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
          </label>

          <div>
            <div className={styles.subSectionHeader}>
              <h4>Зупинки ({form.stops.length})</h4>
              <button type="button" className={styles.textButton} onClick={addStop}>
                Додати зупинку
              </button>
            </div>

            {form.stops.length === 0 ? (
              <p className={styles.stateCard}>Зупинки будуть згенеровані автоматично (відправлення → прибуття).</p>
            ) : (
              <div className={styles.entityList}>
                {form.stops.map((stop, index) => (
                  <div key={index} className={styles.entityCard}>
                    <div style={{ display: "grid", gap: "var(--space-3)" }}>
                      <label className={styles.field}>
                        <span>Станція · Порядок</span>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-3)" }}>
                          <select
                            value={stop.stationId}
                            onChange={(event) => updateStop(index, "stationId", event.target.value)}
                            required
                          >
                            <option value="">Оберіть станцію</option>
                            {stationOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={stop.stopOrder}
                            onChange={(event) => updateStop(index, "stopOrder", event.target.value)}
                            required
                          />
                        </div>
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-3)" }}>
                        <label className={styles.field}>
                          <span>Прибуття (хв)</span>
                          <input
                            type="number"
                            min={0}
                            value={stop.arrivalOffsetMinutes ?? ""}
                            onChange={(event) => updateStop(index, "arrivalOffsetMinutes", event.target.value)}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Відправлення (хв)</span>
                          <input
                            type="number"
                            min={0}
                            value={stop.departureOffsetMinutes ?? ""}
                            onChange={(event) => updateStop(index, "departureOffsetMinutes", event.target.value)}
                          />
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-3)" }}>
                        <label className={styles.field}>
                          <span>Стоянка (хв)</span>
                          <input
                            type="number"
                            min={0}
                            value={stop.stopDurationMinutes}
                            onChange={(event) => updateStop(index, "stopDurationMinutes", event.target.value)}
                            required
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Відстань (км)</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={stop.distanceFromOriginKm ?? ""}
                            onChange={(event) => updateStop(index, "distanceFromOriginKm", event.target.value)}
                          />
                        </label>
                      </div>
                    </div>

                    {form.stops.length > 2 ? (
                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          onClick={() => removeStop(index)}
                        >
                          Видалити зупинку
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className={styles.primaryButton} disabled={state.isSaving}>
            {state.isSaving ? "Збереження..." : editingId ? "Оновити маршрут" : "Створити маршрут"}
          </button>
        </form>
      </div>
    </section>
  );
}

function TripsSection({ trips, routes, trains, state, setState, onReload }) {
  const [form, setForm] = useState(EMPTY_TRIP_FORM);
  const [editingId, setEditingId] = useState(null);

  const routeOptions = useMemo(
    () => buildOptions(routes, (route) => `${route.code || route.id} - ${route.fromStationName} → ${route.toStationName}`),
    [routes]
  );
  const trainOptions = useMemo(
    () => buildOptions(trains, (train) => `${train.code || train.id} - ${train.name}`),
    [trains]
  );

  const resetForm = () => {
    setForm(EMPTY_TRIP_FORM);
    setEditingId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, isSaving: true, error: "", success: "" }));

    const departure = new Date(form.departureAt);
    const arrival = new Date(form.arrivalAt);
    if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime()) || arrival <= departure) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: "Дата прибуття має бути пізніше дати відправлення."
      }));
      return;
    }

    if (form.saleStartAt && form.saleEndAt) {
      const saleStart = new Date(form.saleStartAt);
      const saleEnd = new Date(form.saleEndAt);
      if (saleEnd < saleStart) {
        setState((current) => ({
          ...current,
          isSaving: false,
          error: "Кінець продажу має бути не раніше початку продажу."
        }));
        return;
      }
    }

    try {
      const path = editingId ? `/admin/trips/${editingId}` : "/admin/trips";
      const method = editingId ? "PATCH" : "POST";
      await apiRequest(path, {
        method,
        body: {
          routeId: Number(form.routeId),
          trainId: Number(form.trainId),
          tripCode: form.tripCode.trim().toUpperCase(),
          departureAt: form.departureAt,
          arrivalAt: form.arrivalAt,
          basePrice: Number(form.basePrice),
          status: form.status,
          saleStartAt: form.saleStartAt || null,
          saleEndAt: form.saleEndAt || null
        }
      });
      setState((current) => ({
        ...current,
        isSaving: false,
        success: editingId ? "Рейс оновлено." : "Рейс створено."
      }));
      resetForm();
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: resolveErrorMessage(error, "Не вдалося зберегти рейс.")
      }));
    }
  };

  const removeTrip = async (tripId) => {
    setState((current) => ({ ...current, isDeletingId: tripId, error: "", success: "" }));

    try {
      await apiRequest(`/admin/trips/${tripId}`, { method: "DELETE" });
      setState((current) => ({
        ...current,
        isDeletingId: null,
        success: `Рейс #${tripId} видалено.`
      }));
      if (editingId === tripId) {
        resetForm();
      }
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isDeletingId: null,
        error: resolveErrorMessage(error, "Не вдалося видалити рейс.")
      }));
    }
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}>
        <div>
          <h3>Рейси та ціноутворення</h3>
          <p>Плануйте відправлення, призначайте поїзд, встановіть код рейсу, статус, вікно продажу та базову ціну квитка.</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onReload} disabled={state.isLoading}>
          {state.isLoading ? "Оновлення..." : "Оновити"}
        </button>
      </div>

      {state.success ? <p className={styles.success}>{state.success}</p> : null}
      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      <div className={styles.workspaceGrid}>
        <div className={styles.panel}>
          {state.isLoading ? (
            <div className={styles.stateCard}>
              <p>Завантаження рейсів...</p>
            </div>
          ) : (
            <EntityList
              items={trips}
              emptyText="Ще не заплановано рейсів."
              renderItem={(trip) => (
                <article key={trip.id} className={styles.entityCard}>
                  <div>
                    <h4>{trip.tripCode || trip.routeCode || `Рейс #${trip.id}`}</h4>
                    <p>
                      {trip.departureStation || "Невідомо"} → {trip.arrivalStation || "Невідомо"}
                    </p>
                    <p>
                      {formatDateTime(trip.departureAt)} — {formatDateTime(trip.arrivalAt)}
                    </p>
                    <p>
                      {trip.trainName || "Поїзд не вказано"} — {formatCurrency(trip.basePrice)} · {trip.status}
                    </p>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        setEditingId(trip.id);
                        setForm({
                          routeId: trip.routeId ? String(trip.routeId) : "",
                          trainId: trip.trainId ? String(trip.trainId) : "",
                          tripCode: trip.tripCode,
                          departureAt: toInputDateTime(trip.departureAt),
                          arrivalAt: toInputDateTime(trip.arrivalAt),
                          basePrice: trip.basePrice != null ? String(trip.basePrice) : "",
                          status: trip.status,
                          saleStartAt: toInputDateTime(trip.saleStartAt),
                          saleEndAt: toInputDateTime(trip.saleEndAt)
                        });
                      }}
                    >
                      Редагувати
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => removeTrip(trip.id)}
                      disabled={state.isDeletingId === trip.id}
                    >
                      {state.isDeletingId === trip.id ? "Видалення..." : "Видалити"}
                    </button>
                  </div>
                </article>
              )}
            />
          )}
        </div>

        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.formHeader}>
            <h4>{editingId ? "Редагувати рейс" : "Створити рейс"}</h4>
            {editingId ? (
              <button type="button" className={styles.textButton} onClick={resetForm}>
                Скинути
              </button>
            ) : null}
          </div>

          <label className={styles.field}>
            <span>Маршрут</span>
            <select
              value={form.routeId}
              onChange={(event) => setForm((current) => ({ ...current, routeId: event.target.value }))}
              required
            >
              <option value="">Оберіть маршрут</option>
              {routeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Поїзд</span>
            <select
              value={form.trainId}
              onChange={(event) => setForm((current) => ({ ...current, trainId: event.target.value }))}
              required
            >
              <option value="">Оберіть поїзд</option>
              {trainOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Код рейсу</span>
            <input
              type="text"
              value={form.tripCode}
              onChange={(event) => setForm((current) => ({ ...current, tripCode: event.target.value.toUpperCase() }))}
              placeholder="IC-701-01"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Відправлення</span>
            <input
              type="datetime-local"
              value={form.departureAt}
              onChange={(event) => setForm((current) => ({ ...current, departureAt: event.target.value }))}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Прибуття</span>
            <input
              type="datetime-local"
              value={form.arrivalAt}
              onChange={(event) => setForm((current) => ({ ...current, arrivalAt: event.target.value }))}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Базова ціна</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.basePrice}
              onChange={(event) => setForm((current) => ({ ...current, basePrice: event.target.value }))}
              placeholder="650,00"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Статус</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              required
            >
              <option value="scheduled">Заплановано</option>
              <option value="cancelled">Скасовано</option>
              <option value="completed">Завершено</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Початок продажу</span>
            <input
              type="datetime-local"
              value={form.saleStartAt}
              onChange={(event) => setForm((current) => ({ ...current, saleStartAt: event.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span>Кінець продажу</span>
            <input
              type="datetime-local"
              value={form.saleEndAt}
              onChange={(event) => setForm((current) => ({ ...current, saleEndAt: event.target.value }))}
            />
          </label>

          <button type="submit" className={styles.primaryButton} disabled={state.isSaving}>
            {state.isSaving ? "Збереження..." : editingId ? "Оновити рейс" : "Створити рейс"}
          </button>
        </form>
      </div>
    </section>
  );
}

function FleetSection({
  trains,
  carriages,
  seats,
  trainState,
  carriageState,
  seatState,
  setTrainState,
  setCarriageState,
  setSeatState,
  onReloadTrains,
  onReloadCarriages,
  onReloadSeats
}) {
  const [trainForm, setTrainForm] = useState(EMPTY_TRAIN_FORM);
  const [carriageForm, setCarriageForm] = useState(EMPTY_CARRIAGE_FORM);
  const [seatForm, setSeatForm] = useState(EMPTY_SEAT_FORM);
  const [editingTrainId, setEditingTrainId] = useState(null);
  const [editingCarriageId, setEditingCarriageId] = useState(null);
  const [editingSeatId, setEditingSeatId] = useState(null);

  const trainOptions = useMemo(
    () => buildOptions(trains, (train) => `${train.code || train.id} - ${train.name}`),
    [trains]
  );
  const carriageOptions = useMemo(
    () =>
      buildOptions(
        carriages,
        (carriage) => `${carriage.trainCode || carriage.trainId || "Поїзд"} / вагон ${carriage.number}`
      ),
    [carriages]
  );

  const saveEntity = async ({ path, method, body, setEntityState, reload, successMessage, errorMessage }) => {
    setEntityState((current) => ({ ...current, isSaving: true, error: "", success: "" }));

    try {
      await apiRequest(path, { method, body });
      setEntityState((current) => ({ ...current, isSaving: false, success: successMessage }));
      await reload();
      return true;
    } catch (error) {
      setEntityState((current) => ({
        ...current,
        isSaving: false,
        error: resolveErrorMessage(error, errorMessage)
      }));
      return false;
    }
  };

  const deleteEntity = async ({ id, path, setEntityState, reload, successMessage, errorMessage, onReset }) => {
    setEntityState((current) => ({ ...current, isDeletingId: id, error: "", success: "" }));

    try {
      await apiRequest(path, { method: "DELETE" });
      setEntityState((current) => ({ ...current, isDeletingId: null, success: successMessage }));
      onReset();
      await reload();
    } catch (error) {
      setEntityState((current) => ({
        ...current,
        isDeletingId: null,
        error: resolveErrorMessage(error, errorMessage)
      }));
    }
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}>
        <div>
          <h3>Поїзди, вагони, місця</h3>
          <p>Керуйте ієрархією рухомого складу, категоріями, класами, місткістю та активністю.</p>
        </div>
      </div>

      <div className={styles.fleetGrid}>
        <div className={styles.formCard}>
          <div className={styles.subSectionHeader}>
            <div>
              <h4>Поїзди</h4>
              <p>Базові записи поїздів для планування.</p>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={onReloadTrains} disabled={trainState.isLoading}>
              {trainState.isLoading ? "Оновлення..." : "Оновити"}
            </button>
          </div>

          {trainState.success ? <p className={styles.success}>{trainState.success}</p> : null}
          {trainState.error ? <p className={styles.error}>{trainState.error}</p> : null}

          <EntityList
            items={trains}
            emptyText={trainState.isLoading ? "Завантаження поїздів..." : "Ще не створено поїздів."}
            renderItem={(train) => (
              <article key={train.id} className={styles.entityCard}>
                <div>
                  <h4>{train.name}</h4>
                  <p>{train.code} · {train.category}{train.isActive ? "" : " · Неактивний"}</p>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setEditingTrainId(train.id);
                      setTrainForm({
                        name: train.name,
                        code: train.code,
                        category: train.category,
                        isActive: train.isActive
                      });
                    }}
                  >
                    Редагувати
                  </button>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={trainState.isDeletingId === train.id}
                    onClick={() =>
                      deleteEntity({
                        id: train.id,
                        path: `/admin/trains/${train.id}`,
                        setEntityState: setTrainState,
                        reload: onReloadTrains,
                        successMessage: `Поїзд #${train.id} видалено.`,
                        errorMessage: "Не вдалося видалити поїзд.",
                        onReset: () => {
                          if (editingTrainId === train.id) {
                            setEditingTrainId(null);
                            setTrainForm(EMPTY_TRAIN_FORM);
                          }
                        }
                      })
                    }
                  >
                    {trainState.isDeletingId === train.id ? "Видалення..." : "Видалити"}
                  </button>
                </div>
              </article>
            )}
          />

          <form
            className={styles.inlineForm}
            onSubmit={(event) => {
              event.preventDefault();
              void saveEntity({
                path: editingTrainId ? `/admin/trains/${editingTrainId}` : "/admin/trains",
                method: editingTrainId ? "PATCH" : "POST",
                body: {
                  name: trainForm.name,
                  code: trainForm.code,
                  category: trainForm.category,
                  isActive: trainForm.isActive
                },
                setEntityState: setTrainState,
                reload: onReloadTrains,
                successMessage: editingTrainId ? "Поїзд оновлено." : "Поїзд створено.",
                errorMessage: "Не вдалося зберегти поїзд."
              }).then((saved) => {
                if (saved) {
                  setEditingTrainId(null);
                  setTrainForm(EMPTY_TRAIN_FORM);
                }
              });
            }}
          >
            <label className={styles.field}>
              <span>Назва поїзда</span>
              <input
                type="text"
                value={trainForm.name}
                onChange={(event) => setTrainForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Код</span>
              <input
                type="text"
                value={trainForm.code}
                onChange={(event) => setTrainForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Категорія</span>
              <input
                type="text"
                value={trainForm.category}
                onChange={(event) => setTrainForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="intercity / night / regional"
                required
              />
            </label>
            <label className={styles.field} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span>Активний</span>
              <input
                type="checkbox"
                checked={trainForm.isActive}
                onChange={(event) => setTrainForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
            </label>
            <button type="submit" className={styles.primaryButton} disabled={trainState.isSaving}>
              {trainState.isSaving ? "Збереження..." : editingTrainId ? "Оновити поїзд" : "Створити поїзд"}
            </button>
          </form>
        </div>

        <div className={styles.formCard}>
          <div className={styles.subSectionHeader}>
            <div>
              <h4>Вагони</h4>
              <p>Прив'язуйте вагони до поїздів, вказуйте тип, клас та місткість.</p>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={onReloadCarriages} disabled={carriageState.isLoading}>
              {carriageState.isLoading ? "Оновлення..." : "Оновити"}
            </button>
          </div>

          {carriageState.success ? <p className={styles.success}>{carriageState.success}</p> : null}
          {carriageState.error ? <p className={styles.error}>{carriageState.error}</p> : null}

          <EntityList
            items={carriages}
            emptyText={carriageState.isLoading ? "Завантаження вагонів..." : "Ще не створено вагонів."}
            renderItem={(carriage) => (
              <article key={carriage.id} className={styles.entityCard}>
                <div>
                  <h4>Вагон {carriage.number}</h4>
                  <p>
                    {carriage.trainName || carriage.trainCode || "Поїзд"} — {carriage.type || "тип не вказано"} · {carriage.classCode}
                  </p>
                  <p>Місткість: {carriage.seatCapacity}{carriage.isActive ? "" : " · Неактивний"}</p>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setEditingCarriageId(carriage.id);
                      setCarriageForm({
                        trainId: carriage.trainId ? String(carriage.trainId) : "",
                        number: carriage.number,
                        type: carriage.type,
                        classCode: carriage.classCode,
                        seatCapacity: carriage.seatCapacity ? String(carriage.seatCapacity) : "",
                        isActive: carriage.isActive
                      });
                    }}
                  >
                    Редагувати
                  </button>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={carriageState.isDeletingId === carriage.id}
                    onClick={() =>
                      deleteEntity({
                        id: carriage.id,
                        path: `/admin/carriages/${carriage.id}`,
                        setEntityState: setCarriageState,
                        reload: onReloadCarriages,
                        successMessage: `Вагон #${carriage.id} видалено.`,
                        errorMessage: "Не вдалося видалити вагон.",
                        onReset: () => {
                          if (editingCarriageId === carriage.id) {
                            setEditingCarriageId(null);
                            setCarriageForm(EMPTY_CARRIAGE_FORM);
                          }
                        }
                      })
                    }
                  >
                    {carriageState.isDeletingId === carriage.id ? "Видалення..." : "Видалити"}
                  </button>
                </div>
              </article>
            )}
          />

          <form
            className={styles.inlineForm}
            onSubmit={(event) => {
              event.preventDefault();
              void saveEntity({
                path: editingCarriageId ? `/admin/carriages/${editingCarriageId}` : "/admin/carriages",
                method: editingCarriageId ? "PATCH" : "POST",
                body: {
                  trainId: Number(carriageForm.trainId),
                  number: carriageForm.number,
                  type: carriageForm.type,
                  classCode: carriageForm.classCode,
                  seatCapacity: Number(carriageForm.seatCapacity),
                  isActive: carriageForm.isActive
                },
                setEntityState: setCarriageState,
                reload: onReloadCarriages,
                successMessage: editingCarriageId ? "Вагон оновлено." : "Вагон створено.",
                errorMessage: "Не вдалося зберегти вагон."
              }).then((saved) => {
                if (saved) {
                  setEditingCarriageId(null);
                  setCarriageForm(EMPTY_CARRIAGE_FORM);
                }
              });
            }}
          >
            <label className={styles.field}>
              <span>Поїзд</span>
              <select
                value={carriageForm.trainId}
                onChange={(event) => setCarriageForm((current) => ({ ...current, trainId: event.target.value }))}
                required
              >
                <option value="">Оберіть поїзд</option>
                {trainOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Номер</span>
              <input
                type="text"
                value={carriageForm.number}
                onChange={(event) => setCarriageForm((current) => ({ ...current, number: event.target.value }))}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Тип</span>
              <input
                type="text"
                value={carriageForm.type}
                onChange={(event) => setCarriageForm((current) => ({ ...current, type: event.target.value }))}
                placeholder="купе"
                required
              />
            </label>
            <label className={styles.field}>
              <span>Клас</span>
              <input
                type="text"
                value={carriageForm.classCode}
                onChange={(event) => setCarriageForm((current) => ({ ...current, classCode: event.target.value }))}
                placeholder="standard / first / second"
                required
              />
            </label>
            <label className={styles.field}>
              <span>Місткість місць</span>
              <input
                type="number"
                min={1}
                value={carriageForm.seatCapacity}
                onChange={(event) => setCarriageForm((current) => ({ ...current, seatCapacity: event.target.value }))}
                required
              />
            </label>
            <label className={styles.field} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span>Активний</span>
              <input
                type="checkbox"
                checked={carriageForm.isActive}
                onChange={(event) => setCarriageForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
            </label>
            <button type="submit" className={styles.primaryButton} disabled={carriageState.isSaving}>
              {carriageState.isSaving ? "Збереження..." : editingCarriageId ? "Оновити вагон" : "Створити вагон"}
            </button>
          </form>
        </div>

        <div className={styles.formCard}>
          <div className={styles.subSectionHeader}>
            <div>
              <h4>Місця</h4>
              <p>Заповнюйте вагон номерами місць, типом місця та класом.</p>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={onReloadSeats} disabled={seatState.isLoading}>
              {seatState.isLoading ? "Оновлення..." : "Оновити"}
            </button>
          </div>

          {seatState.success ? <p className={styles.success}>{seatState.success}</p> : null}
          {seatState.error ? <p className={styles.error}>{seatState.error}</p> : null}

          <EntityList
            items={seats}
            emptyText={seatState.isLoading ? "Завантаження місць..." : "Ще не створено місць."}
            renderItem={(seat) => (
              <article key={seat.id} className={styles.entityCard}>
                <div>
                  <h4>Місце {seat.number}</h4>
                  <p>
                    {seat.trainCode || "Поїзд"} / вагон {seat.carriageNumber || seat.carriageId}
                  </p>
                  <p>{seat.seatType} · {seat.classType}{seat.isActive ? "" : " · Неактивне"}</p>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setEditingSeatId(seat.id);
                      setSeatForm({
                        carriageId: seat.carriageId ? String(seat.carriageId) : "",
                        number: seat.number,
                        seatType: seat.seatType,
                        classType: seat.classType,
                        isActive: seat.isActive
                      });
                    }}
                  >
                    Редагувати
                  </button>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={seatState.isDeletingId === seat.id}
                    onClick={() =>
                      deleteEntity({
                        id: seat.id,
                        path: `/admin/seats/${seat.id}`,
                        setEntityState: setSeatState,
                        reload: onReloadSeats,
                        successMessage: `Місце #${seat.id} видалено.`,
                        errorMessage: "Не вдалося видалити місце.",
                        onReset: () => {
                          if (editingSeatId === seat.id) {
                            setEditingSeatId(null);
                            setSeatForm(EMPTY_SEAT_FORM);
                          }
                        }
                      })
                    }
                  >
                    {seatState.isDeletingId === seat.id ? "Видалення..." : "Видалити"}
                  </button>
                </div>
              </article>
            )}
          />

          <form
            className={styles.inlineForm}
            onSubmit={(event) => {
              event.preventDefault();
              void saveEntity({
                path: editingSeatId ? `/admin/seats/${editingSeatId}` : "/admin/seats",
                method: editingSeatId ? "PATCH" : "POST",
                body: {
                  carriageId: Number(seatForm.carriageId),
                  number: seatForm.number,
                  seatType: seatForm.seatType,
                  classType: seatForm.classType,
                  isActive: seatForm.isActive
                },
                setEntityState: setSeatState,
                reload: onReloadSeats,
                successMessage: editingSeatId ? "Місце оновлено." : "Місце створено.",
                errorMessage: "Не вдалося зберегти місце."
              }).then((saved) => {
                if (saved) {
                  setEditingSeatId(null);
                  setSeatForm(EMPTY_SEAT_FORM);
                }
              });
            }}
          >
            <label className={styles.field}>
              <span>Вагон</span>
              <select
                value={seatForm.carriageId}
                onChange={(event) => setSeatForm((current) => ({ ...current, carriageId: event.target.value }))}
                required
              >
                <option value="">Оберіть вагон</option>
                {carriageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Номер місця</span>
              <input
                type="text"
                value={seatForm.number}
                onChange={(event) => setSeatForm((current) => ({ ...current, number: event.target.value }))}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Тип місця</span>
              <input
                type="text"
                value={seatForm.seatType}
                onChange={(event) => setSeatForm((current) => ({ ...current, seatType: event.target.value }))}
                placeholder="window / aisle / standard"
                required
              />
            </label>
            <label className={styles.field}>
              <span>Тип класу</span>
              <input
                type="text"
                value={seatForm.classType}
                onChange={(event) => setSeatForm((current) => ({ ...current, classType: event.target.value }))}
                placeholder="перший клас"
                required
              />
            </label>
            <label className={styles.field} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span>Активне</span>
              <input
                type="checkbox"
                checked={seatForm.isActive}
                onChange={(event) => setSeatForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
            </label>
            <button type="submit" className={styles.primaryButton} disabled={seatState.isSaving}>
              {seatState.isSaving ? "Збереження..." : editingSeatId ? "Оновити місце" : "Створити місце"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function UsersSection({ users, roles, state, setState, onReload }) {
  const [form, setForm] = useState(EMPTY_USER_FORM);

  const resetForm = () => {
    setForm(EMPTY_USER_FORM);
  };

  const submit = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, isSaving: true, error: "", success: "" }));

    try {
      await apiRequest("/admin/users", {
        method: "POST",
        body: {
          username: form.username.trim(),
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          password: form.password,
          role: form.role
        }
      });
      setState((current) => ({
        ...current,
        isSaving: false,
        success: "Користувача створено."
      }));
      resetForm();
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: resolveErrorMessage(error, "Не вдалося створити користувача.")
      }));
    }
  };

  const updateRole = async (userId, role) => {
    setState((current) => ({ ...current, isUpdatingId: userId, error: "", success: "" }));

    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: { role }
      });
      setState((current) => ({
        ...current,
        isUpdatingId: null,
        success: `Роль користувача #${userId} оновлено.`
      }));
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isUpdatingId: null,
        error: resolveErrorMessage(error, "Не вдалося оновити роль.")
      }));
    }
  };

  const toggleStatus = async (userId, isActive) => {
    setState((current) => ({ ...current, isUpdatingId: userId, error: "", success: "" }));

    try {
      await apiRequest(`/admin/users/${userId}/status`, {
        method: "PATCH",
        body: { isActive }
      });
      setState((current) => ({
        ...current,
        isUpdatingId: null,
        success: `Статус користувача #${userId} оновлено.`
      }));
      await onReload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isUpdatingId: null,
        error: resolveErrorMessage(error, "Не вдалося оновити статус.")
      }));
    }
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}>
        <div>
          <h3>Користувачі та ролі</h3>
          <p>Створюйте касирів та адміністраторів, змінюйте ролі та блокуйте облікові записи.</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onReload} disabled={state.isLoading}>
          {state.isLoading ? "Оновлення..." : "Оновити"}
        </button>
      </div>

      {state.success ? <p className={styles.success}>{state.success}</p> : null}
      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      <div className={styles.workspaceGrid}>
        <div className={styles.panel}>
          {state.isLoading ? (
            <div className={styles.stateCard}>
              <p>Завантаження користувачів...</p>
            </div>
          ) : (
            <EntityList
              items={users}
              emptyText="Користувачів не знайдено."
              renderItem={(user) => (
                <article key={user.id} className={styles.entityCard}>
                  <div>
                    <h4>{user.fullName || user.login}</h4>
                    <p>{user.login} · {user.email}</p>
                    <p>{user.isActive ? "Активний" : "Заблокований"}</p>
                  </div>
                  <div className={styles.cardActions}>
                    <select
                      value={user.role}
                      onChange={(event) => updateRole(user.id, event.target.value)}
                      disabled={state.isUpdatingId === user.id}
                    >
                      {roles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.name} ({role.code})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={user.isActive ? styles.dangerButton : styles.secondaryButton}
                      onClick={() => toggleStatus(user.id, !user.isActive)}
                      disabled={state.isUpdatingId === user.id}
                    >
                      {user.isActive ? "Заблокувати" : "Розблокувати"}
                    </button>
                  </div>
                </article>
              )}
            />
          )}
        </div>

        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.formHeader}>
            <h4>Створити користувача</h4>
          </div>

          <label className={styles.field}>
            <span>Логін</span>
            <input
              type="text"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Повне ім'я</span>
            <input
              type="text"
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Телефон</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span>Пароль</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              minLength={6}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Роль</span>
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              required
            >
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name} ({role.code})
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className={styles.primaryButton} disabled={state.isSaving}>
            {state.isSaving ? "Збереження..." : "Створити користувача"}
          </button>
        </form>
      </div>
    </section>
  );
}

function LogsSection({ logs, state, setState, filters, setFilters, pagination, setPagination, onReload }) {
  const resultStatusOptions = [
    { value: "", label: "Будь-який" },
    { value: "success", label: "Успіх" },
    { value: "failure", label: "Невдача" }
  ];

  const applyFilters = (event) => {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    void onReload();
  };

  const resetFilters = () => {
    setFilters({
      actorLoginSearch: "",
      entityType: "",
      action: "",
      resultStatus: "",
      dateFrom: "",
      dateTo: ""
    });
    setPagination((current) => ({ ...current, page: 1 }));
    void onReload();
  };

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}>
        <div>
          <h3>Журнал операцій</h3>
          <p>Переглядайте записи про дії користувачів, бронювання, платежі та зміни в адміністративній панелі.</p>
        </div>
      </div>

      {state.success ? <p className={styles.success}>{state.success}</p> : null}
      {state.error ? <p className={styles.error}>{state.error}</p> : null}

      <form className={styles.formCard} onSubmit={applyFilters}>
        <div className={styles.formHeader}>
          <h4>Фільтри</h4>
        </div>

        <div className={styles.workspaceGrid}>
          <label className={styles.field}>
            <span>Актор (логін або ім'я)</span>
            <input
              type="text"
              value={filters.actorLoginSearch}
              onChange={(event) => setFilters((current) => ({ ...current, actorLoginSearch: event.target.value }))}
              placeholder="admin"
            />
          </label>

          <label className={styles.field}>
            <span>Тип сутності</span>
            <input
              type="text"
              value={filters.entityType}
              onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))}
              placeholder="booking"
            />
          </label>

          <label className={styles.field}>
            <span>Дія</span>
            <input
              type="text"
              value={filters.action}
              onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
              placeholder="booking.create"
            />
          </label>

          <label className={styles.field}>
            <span>Результат</span>
            <select
              value={filters.resultStatus}
              onChange={(event) => setFilters((current) => ({ ...current, resultStatus: event.target.value }))}
            >
              {resultStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>З</span>
            <input
              type="datetime-local"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span>По</span>
            <input
              type="datetime-local"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
            />
          </label>
        </div>

        <div className={styles.cardActions}>
          <button type="submit" className={styles.primaryButton} disabled={state.isLoading}>
            {state.isLoading ? "Завантаження..." : "Застосувати"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={resetFilters}>
            Скинути
          </button>
        </div>
      </form>

      <div className={styles.panel}>
        {state.isLoading ? (
          <div className={styles.stateCard}>
            <p>Завантаження журналу...</p>
          </div>
        ) : (
          <>
            <EntityList
              items={logs}
              emptyText="Записів не знайдено."
              renderItem={(log) => (
                <article key={log.id} className={styles.entityCard}>
                  <div>
                    <h4>{log.action}</h4>
                    <p>
                      {log.actorLogin || log.actorFullName || "Система"} · {log.entityType}
                      {log.entityId ? ` #${log.entityId}` : ""} · {log.resultStatus}
                    </p>
                    <p>{formatDate(log.createdAt)} · {log.ipAddress}</p>
                    {log.details ? <p>{JSON.stringify(log.details)}</p> : null}
                  </div>
                </article>
              )}
            />

            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={pagination.page <= 1}
                onClick={() => {
                  setPagination((current) => ({ ...current, page: current.page - 1 }));
                  void onReload();
                }}
              >
                ← Назад
              </button>
              <span>
                Сторінка {pagination.page} з {pagination.totalPages} · {pagination.totalItems} записів
              </span>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => {
                  setPagination((current) => ({ ...current, page: current.page + 1 }));
                  void onReload();
                }}
              >
                Вперед →
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function createResourceState() {
  return {
    isLoading: true,
    isSaving: false,
    isDeletingId: null,
    isUpdatingId: null,
    error: "",
    success: ""
  };
}

export function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("stations");

  const [stations, setStations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [trains, setTrains] = useState([]);
  const [carriages, setCarriages] = useState([]);
  const [seats, setSeats] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [logs, setLogs] = useState([]);

  const [stationState, setStationState] = useState(createResourceState);
  const [routeState, setRouteState] = useState(createResourceState);
  const [tripState, setTripState] = useState(createResourceState);
  const [trainState, setTrainState] = useState(createResourceState);
  const [carriageState, setCarriageState] = useState(createResourceState);
  const [seatState, setSeatState] = useState(createResourceState);
  const [userState, setUserState] = useState(createResourceState);
  const [logState, setLogState] = useState(createResourceState);

  const [logFilters, setLogFilters] = useState({
    actorLoginSearch: "",
    entityType: "",
    action: "",
    resultStatus: "",
    dateFrom: "",
    dateTo: ""
  });
  const [logPagination, setLogPagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1
  });

  const displayName = useMemo(
    () => user?.fullName ?? user?.name ?? user?.login ?? user?.email ?? "адміністратор",
    [user]
  );

  const loadStations = async () => {
    setStationState((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const payload = await apiRequest("/admin/stations");
      setStations(extractItems(payload).map(normalizeStation));
      setStationState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setStationState((current) => ({
        ...current,
        isLoading: false,
        error: resolveErrorMessage(error, "Не вдалося завантажити станції.")
      }));
    }
  };

  const loadRoutes = async () => {
    setRouteState((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const payload = await apiRequest("/admin/routes");
      setRoutes(extractItems(payload).map(normalizeRoute));
      setRouteState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setRouteState((current) => ({
        ...current,
        isLoading: false,
        error: resolveErrorMessage(error, "Не вдалося завантажити маршрути.")
      }));
    }
  };

  const loadTrips = async () => {
    setTripState((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const payload = await apiRequest("/admin/trips");
      setTrips(extractItems(payload).map(normalizeTrip));
      setTripState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setTripState((current) => ({
        ...current,
        isLoading: false,
        error: resolveErrorMessage(error, "Не вдалося завантажити рейси.")
      }));
    }
  };

  const loadTrains = async () => {
    setTrainState((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const payload = await apiRequest("/admin/trains");
      setTrains(extractItems(payload).map(normalizeTrain));
      setTrainState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setTrainState((current) => ({
        ...current,
        isLoading: false,
        error: resolveErrorMessage(error, "Не вдалося завантажити поїзди.")
      }));
    }
  };

  const loadCarriages = async () => {
    setCarriageState((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const payload = await apiRequest("/admin/carriages");
      setCarriages(extractItems(payload).map(normalizeCarriage));
      setCarriageState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setCarriageState((current) => ({
        ...current,
        isLoading: false,
        error: resolveErrorMessage(error, "Не вдалося завантажити вагони.")
      }));
    }
  };

  const loadSeats = async () => {
    setSeatState((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const payload = await apiRequest("/admin/seats");
      setSeats(extractItems(payload).map(normalizeSeat));
      setSeatState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setSeatState((current) => ({
        ...current,
        isLoading: false,
        error: resolveErrorMessage(error, "Не вдалося завантажити місця.")
      }));
    }
  };

  const loadRoles = async () => {
    try {
      const payload = await apiRequest("/admin/roles");
      setRoles(extractItems(payload));
    } catch (error) {
      setRoles([
        { code: "passenger", name: "Пасажир" },
        { code: "cashier", name: "Касир" },
        { code: "admin", name: "Адміністратор" }
      ]);
    }
  };

  const loadUsers = async () => {
    setUserState((current) => ({ ...current, isLoading: true, error: "" }));

    try {
      const payload = await apiRequest("/admin/users");
      setUsers(extractItems(payload).map(normalizeUser));
      setUserState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setUserState((current) => ({
        ...current,
        isLoading: false,
        error: resolveErrorMessage(error, "Не вдалося завантажити користувачів.")
      }));
    }
  };

  const loadLogs = async () => {
    setLogState((current) => ({ ...current, isLoading: true, error: "" }));

    const params = new URLSearchParams();
    params.set("page", String(logPagination.page));
    params.set("pageSize", String(logPagination.pageSize));
    if (logFilters.actorLoginSearch) params.set("actorLoginSearch", logFilters.actorLoginSearch);
    if (logFilters.entityType) params.set("entityType", logFilters.entityType);
    if (logFilters.action) params.set("action", logFilters.action);
    if (logFilters.resultStatus) params.set("resultStatus", logFilters.resultStatus);
    if (logFilters.dateFrom) params.set("dateFrom", logFilters.dateFrom);
    if (logFilters.dateTo) params.set("dateTo", logFilters.dateTo);

    try {
      const payload = await apiRequest(`/admin/operation-logs?${params.toString()}`);
      setLogs(extractItems(payload).map(normalizeLog));
      setLogPagination((current) => ({
        ...current,
        totalItems: payload?.pagination?.totalItems ?? 0,
        totalPages: payload?.pagination?.totalPages ?? 1
      }));
      setLogState((current) => ({ ...current, isLoading: false }));
    } catch (error) {
      setLogState((current) => ({
        ...current,
        isLoading: false,
        error: resolveErrorMessage(error, "Не вдалося завантажити журнал операцій.")
      }));
    }
  };

  useEffect(() => {
    void Promise.all([
      loadStations(),
      loadRoutes(),
      loadTrips(),
      loadTrains(),
      loadCarriages(),
      loadSeats(),
      loadRoles()
    ]);
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      void loadUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "logs") {
      void loadLogs();
    }
  }, [activeTab, logPagination.page]);

  const totals = useMemo(
    () => [
      { label: "Станції", value: stations.length },
      { label: "Маршрути", value: routes.length },
      { label: "Рейси", value: trips.length },
      { label: "Одиниць рухомого складу", value: trains.length + carriages.length + seats.length }
    ],
    [stations.length, routes.length, trips.length, trains.length, carriages.length, seats.length]
  );

  return (
    <PageSection
      title="Адміністративна панель"
      description={`Адміністративна зона для ${displayName}. Використовуйте її для керування довідковими даними, рейсами, рухомим складом, користувачами та журналом операцій.`}
    >
      <div className={styles.dashboardIntro}>
        <div className={styles.summaryGrid}>
          {totals.map((item) => (
            <article key={item.label} className={styles.summaryCard}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <div className={styles.tabRow}>
          {TAB_DEFINITIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTab ? styles.activeTab : styles.tab}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "stations" ? (
        <StationsSection
          stations={stations}
          state={stationState}
          setState={setStationState}
          onReload={loadStations}
        />
      ) : null}

      {activeTab === "routes" ? (
        <RoutesSection
          routes={routes}
          stations={stations}
          state={routeState}
          setState={setRouteState}
          onReload={loadRoutes}
        />
      ) : null}

      {activeTab === "trips" ? (
        <TripsSection
          trips={trips}
          routes={routes}
          trains={trains}
          state={tripState}
          setState={setTripState}
          onReload={loadTrips}
        />
      ) : null}

      {activeTab === "fleet" ? (
        <FleetSection
          trains={trains}
          carriages={carriages}
          seats={seats}
          trainState={trainState}
          carriageState={carriageState}
          seatState={seatState}
          setTrainState={setTrainState}
          setCarriageState={setCarriageState}
          setSeatState={setSeatState}
          onReloadTrains={loadTrains}
          onReloadCarriages={loadCarriages}
          onReloadSeats={loadSeats}
        />
      ) : null}

      {activeTab === "users" ? (
        <UsersSection
          users={users}
          roles={roles}
          state={userState}
          setState={setUserState}
          onReload={loadUsers}
        />
      ) : null}

      {activeTab === "logs" ? (
        <LogsSection
          logs={logs}
          state={logState}
          setState={setLogState}
          filters={logFilters}
          setFilters={setLogFilters}
          pagination={logPagination}
          setPagination={setLogPagination}
          onReload={loadLogs}
        />
      ) : null}
    </PageSection>
  );
}
