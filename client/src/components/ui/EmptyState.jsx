import { AlertCircle } from "lucide-react";
import styles from "./EmptyState.module.css";

export function EmptyState({ icon: Icon = AlertCircle, title, description, action, className = "" }) {
  return (
    <div className={`${styles.emptyState} ${className}`}>
      <div className={styles.iconWrap}>
        <Icon className={styles.icon} aria-hidden="true" />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
