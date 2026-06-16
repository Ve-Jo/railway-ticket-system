import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Home } from "lucide-react";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Home}
      title="Сторінку не знайдено"
      description="Маршрут відсутній або ще не реалізовано. Поверніться на головну сторінку."
      action={
        <Link to="/">
          <Button variant="primary">На головну</Button>
        </Link>
      }
    />
  );
}
