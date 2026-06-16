import { useEffect, useRef, useState } from "react";
import { LogIn, ShieldCheck, TrainFront, User, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { Footer } from "./layout/Footer.jsx";
import { Button } from "./ui/Button.jsx";
import styles from "./AppShell.module.css";

const ROLE_LABELS = {
  passenger: "Пасажир",
  cashier: "Касир",
  admin: "Адміністратор"
};

const DEMO_PASSWORD = "demo12345";

const DEMO_ACCOUNTS = [
  { role: "passenger", label: "Пасажир", login: "passenger_demo", route: "/dashboard" },
  { role: "cashier", label: "Касир", login: "cashier_demo", route: "/cashier" },
  { role: "admin", label: "Адміністратор", login: "admin_demo", route: "/admin" }
];

export function AppShell() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, role, user, login, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const [authActionPending, setAuthActionPending] = useState("");
  const authMenuRef = useRef(null);

  const links = [
    { to: "/", label: "Головна" },
    { to: "/search", label: "Пошук рейсів" },
    ...(isAuthenticated ? [{ to: "/dashboard", label: "Кабінет" }] : []),
    ...(["cashier", "admin"].includes(role) ? [{ to: "/cashier", label: "Касир" }] : []),
    ...(role === "admin" ? [{ to: "/admin", label: "Адмін" }] : [])
  ];

  useEffect(() => {
    if (!authMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (authMenuRef.current && !authMenuRef.current.contains(event.target)) {
        setAuthMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setAuthMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [authMenuOpen]);

  const closeMenus = () => {
    setMenuOpen(false);
    setAuthMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    closeMenus();
  };

  const handleAuthNavigate = (to) => {
    navigate(to);
    closeMenus();
  };

  const handleDemoLogin = async (account) => {
    setAuthActionPending(account.role);

    try {
      const sessionUser = await login({
        login: account.login,
        password: DEMO_PASSWORD
      });

      const destination =
        sessionUser?.role === "admin"
          ? "/admin"
          : sessionUser?.role === "cashier"
            ? "/cashier"
            : account.route;

      navigate(destination);
      closeMenus();
    } catch (_error) {
      navigate("/login", {
        state: {
          demoLogin: account.login
        }
      });
      closeMenus();
    } finally {
      setAuthActionPending("");
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.inner}>
            <NavLink to="/" className={styles.brand}>
              <span className={styles.brandIcon}>
                <TrainFront size={22} />
              </span>
              <div className={styles.brandText}>
                <span className={styles.brandTitle}>Укрзалізниця</span>
                <span className={styles.brandSubtitle}>Бронювання квитків</span>
              </div>
            </NavLink>

            <button
              type="button"
              className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
              aria-label={menuOpen ? "Закрити меню" : "Відкрити меню"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>

            <div className={`${styles.actions} ${menuOpen ? styles.actionsOpen : ""}`}>
              <nav className={styles.nav}>
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                    }
                    onClick={closeMenus}
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
              <div className={styles.session}>
                {isLoading ? (
                  <span className={styles.sessionHint}>Перевірка сесії…</span>
                ) : isAuthenticated ? (
                  <div className={styles.sessionBox}>
                    <span className={styles.sessionName}>
                      {user?.fullName || user?.name || user?.login || user?.email || "Користувач"}
                    </span>
                    <span className={styles.sessionRole}>{ROLE_LABELS[role] ?? role}</span>
                    <Button variant="outline" size="sm" onClick={handleLogout}>
                      Вийти
                    </Button>
                  </div>
                ) : (
                  <div className={styles.authMenu} ref={authMenuRef}>
                    <Button
                      variant="outline"
                      size="sm"
                      className={styles.authToggle}
                      aria-haspopup="menu"
                      aria-expanded={authMenuOpen}
                      onClick={() => setAuthMenuOpen((open) => !open)}
                    >
                      Авторизація
                    </Button>

                    {authMenuOpen ? (
                      <div className={styles.authDropdown} role="menu" aria-label="Авторизація">
                        <div className={styles.authSection}>
                          <p className={styles.authSectionTitle}>Обліковий запис</p>
                          <button
                            type="button"
                            className={styles.authAction}
                            onClick={() => handleAuthNavigate("/login")}
                          >
                            <span className={styles.authActionLabel}>
                              <LogIn size={16} />
                              Вхід
                            </span>
                          </button>
                          <button
                            type="button"
                            className={styles.authAction}
                            onClick={() => handleAuthNavigate("/register")}
                          >
                            <span className={styles.authActionLabel}>
                              <User size={16} />
                              Реєстрація
                            </span>
                          </button>
                        </div>

                        <div className={styles.authDivider} />

                        <div className={styles.authSection}>
                          <p className={styles.authSectionTitle}>Демо авторизація</p>
                          {DEMO_ACCOUNTS.map((account) => (
                            <button
                              key={account.role}
                              type="button"
                              className={styles.authAction}
                              onClick={() => handleDemoLogin(account)}
                              disabled={Boolean(authActionPending)}
                            >
                              <span className={styles.authActionLabel}>
                                {account.role === "admin" ? (
                                  <ShieldCheck size={16} />
                                ) : account.role === "cashier" ? (
                                  <Users size={16} />
                                ) : (
                                  <User size={16} />
                                )}
                                {account.label}
                              </span>
                              <span className={styles.authActionMeta}>
                                {authActionPending === account.role ? "Вхід…" : "demo"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}
