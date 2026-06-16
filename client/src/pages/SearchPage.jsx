import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { SearchForm } from "../components/SearchForm.jsx";
import styles from "./SearchPage.module.css";

export function SearchPage() {
  const [searchParams] = useSearchParams();

  const initialValues = {
    fromStationId: searchParams.get("fromStationId") ?? "",
    toStationId: searchParams.get("toStationId") ?? "",
    date: searchParams.get("date") ?? ""
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Пошук рейсів"
        description="Оберіть станцію відправлення, станцію прибуття та дату поїздки."
      />
      <SearchForm variant="page" initialValues={initialValues} />
    </div>
  );
}
