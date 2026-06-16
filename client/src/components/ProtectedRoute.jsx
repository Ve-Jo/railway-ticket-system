import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { PageSection } from "./PageSection.jsx";

export function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <PageSection
        title="Перевірка сесії"
        description="Завантажуємо дані поточного користувача перед відкриттям закритого розділу."
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return (
      <PageSection
        title="Немає доступу"
        description="Поточна роль не має доступу до цього розділу. Використовуйте обліковий запис із відповідними правами."
      />
    );
  }

  return <Outlet />;
}
