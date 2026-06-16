import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, apiRequest } from "../api/apiClient.js";
import { Field } from "./ui/Field.jsx";
import { Select } from "./ui/Select.jsx";
import { Input } from "./ui/Input.jsx";
import { Button } from "./ui/Button.jsx";
import { Alert } from "./ui/Alert.jsx";
import { Search } from "lucide-react";
import styles from "./SearchForm.module.css";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function SearchForm({ initialValues = {}, variant = "page" }) {
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [stationsError, setStationsError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState({
    fromStationId: initialValues.fromStationId ?? "",
    toStationId: initialValues.toStationId ?? "",
    date: initialValues.date ?? getToday()
  });

  useEffect(() => {
    let isMounted = true;

    async function loadStations() {
      setIsLoadingStations(true);
      setStationsError("");

      try {
        const response = await apiRequest("/stations");
        if (!isMounted) return;
        setStations(response?.items ?? []);
      } catch (error) {
        if (!isMounted) return;
        setStationsError(error instanceof ApiError ? error.message : "Не вдалося завантажити станції.");
      } finally {
        if (isMounted) setIsLoadingStations(false);
      }
    }

    loadStations();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
    setFormError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formValues.fromStationId || !formValues.toStationId || !formValues.date) {
      setFormError("Заповніть станцію відправлення, станцію прибуття та дату.");
      return;
    }

    if (formValues.fromStationId === formValues.toStationId) {
      setFormError("Станції відправлення та прибуття мають відрізнятися.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    const params = new URLSearchParams({
      fromStationId: formValues.fromStationId,
      toStationId: formValues.toStationId,
      date: formValues.date
    });

    navigate(`/search/results?${params.toString()}`);
  };

  const stationOptions = (
    <>
      <option value="">Оберіть станцію</option>
      {stations.map((station) => (
        <option key={station.id} value={String(station.id)}>
          {station.name} ({station.code})
        </option>
      ))}
    </>
  );

  return (
    <form className={`${styles.form} ${styles[variant]}`} onSubmit={handleSubmit}>
      <div className={styles.fields}>
        <Field label="Звідки" required>
          <Select
            name="fromStationId"
            value={formValues.fromStationId}
            onChange={handleChange}
            disabled={isLoadingStations}
            required
          >
            {stationOptions}
          </Select>
        </Field>

        <Field label="Куди" required>
          <Select
            name="toStationId"
            value={formValues.toStationId}
            onChange={handleChange}
            disabled={isLoadingStations}
            required
          >
            {stationOptions}
          </Select>
        </Field>

        <Field label="Дата поїздки" required>
          <Input
            type="date"
            name="date"
            value={formValues.date}
            min={getToday()}
            onChange={handleChange}
            required
          />
        </Field>
      </div>

      {stationsError ? <Alert variant="error">{stationsError}</Alert> : null}
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <div className={styles.actions}>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          isLoading={isLoadingStations || isSubmitting}
          className={styles.submit}
        >
          <Search size={18} />
          Знайти рейси
        </Button>
        {isLoadingStations ? <span className={styles.note}>Завантаження станцій…</span> : null}
      </div>
    </form>
  );
}
