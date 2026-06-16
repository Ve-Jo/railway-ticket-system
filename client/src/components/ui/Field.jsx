import styles from "./Field.module.css";

export function Field({ label, children, error, required = false, className = "" }) {
  return (
    <label className={`${styles.field} ${className}`}>
      <span className={styles.label}>
        {label}
        {required ? <span className={styles.required}>*</span> : null}
      </span>
      {children}
      {error ? <span className={styles.error}>{error}</span> : null}
    </label>
  );
}
