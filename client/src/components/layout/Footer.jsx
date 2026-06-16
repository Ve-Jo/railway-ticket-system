import { TrainFront } from "lucide-react";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.inner}>
          <div className={styles.brand}>
            <span className={styles.brandIcon} aria-hidden="true">
              <TrainFront size={18} />
            </span>
            <span className={styles.brandTitle}>Укрзалізниця</span>
          </div>
          <p className={styles.copy}>
            © {new Date().getFullYear()} Бронювання залізничних квитків
          </p>
        </div>
      </div>
    </footer>
  );
}
