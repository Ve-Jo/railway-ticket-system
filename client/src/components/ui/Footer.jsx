import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.inner}>
          <span className={styles.brand}>Railway Tickets</span>
          <p className={styles.copy}>© {new Date().getFullYear()} Бронирование железнодорожных билетов</p>
        </div>
      </div>
    </footer>
  );
}
