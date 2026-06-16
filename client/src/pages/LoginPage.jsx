import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { PageSection } from "../components/PageSection.jsx";
import { PlaceholderForm } from "../components/PlaceholderForm.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { login, isAuthenticated, isLoading, clearError } = useAuth();
  const [values, setValues] = useState({
    login: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const destination = location.state?.from?.pathname ?? "/dashboard";

  if (!isLoading && isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  const handleChange = (event) => {
    clearError();
    setError("");
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const sessionUser = await login(values);
      const roleRoute =
        sessionUser?.role === "admin"
          ? "/admin"
          : sessionUser?.role === "cashier"
            ? "/cashier"
            : "/dashboard";

      navigate(location.state?.from?.pathname ?? roleRoute, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageSection
      className="authPage"
      title="Вхід"
      description="Увійдіть в обліковий запис, щоб шукати рейси та керувати квитками."
    >
      <div className={styles.layout}>
        <div className={styles.formBlock}>
          <PlaceholderForm
            fields={[
              {
                name: "login",
                label: "Логін",
                autoComplete: "username"
              },
              {
                name: "password",
                label: "Пароль",
                type: "password",
                autoComplete: "current-password"
              }
            ]}
            values={values}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            error={error}
            actionLabel={
              isSubmitting
                ? "Входимо..."
                : "Увійти"
            }
          />
          <p className={styles.registerPrompt}>
            Немає облікового запису? <Link to="/register">Перейти до реєстрації</Link>
            .
          </p>
        </div>
      </div>
    </PageSection>
  );
}
