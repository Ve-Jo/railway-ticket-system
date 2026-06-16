import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PageSection } from "../components/PageSection.jsx";
import { PlaceholderForm } from "../components/PlaceholderForm.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export function RegisterPage() {
  const { register, isAuthenticated, isLoading, clearError } = useAuth();
  const [values, setValues] = useState({
    name: "",
    email: "",
    login: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    clearError();
    setError("");
    setSuccess("");
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await register(values);
      setSuccess("Реєстрація виконана. Якщо сервер одразу створює сесію, кабінет уже доступний.");
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageSection className="authPage" title="Реєстрація" description="Створіть обліковий запис пасажира, щоб бронювати та оплачувати квитки.">
      <PlaceholderForm
        fields={[
          {
            name: "name",
            label: "Ім'я",
            autoComplete: "name"
          },
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email"
          },
          {
            name: "login",
            label: "Логін",
            autoComplete: "username"
          },
          {
            name: "password",
            label: "Пароль",
            type: "password",
            autoComplete: "new-password"
          }
        ]}
        values={values}
        onChange={handleChange}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
        success={success}
        actionLabel={isSubmitting ? "Створюємо…" : "Створити обліковий запис"}
      />
      <p>
        Вже є обліковий запис? <Link to="/login">Перейти до входу</Link>.
      </p>
    </PageSection>
  );
}
