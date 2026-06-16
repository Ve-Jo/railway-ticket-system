import styles from "./Alert.module.css";

const variantMap = {
  success: styles.success,
  error: styles.error,
  warning: styles.warning,
  info: styles.info
};

const iconMap = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ"
};

export function Alert({ variant = "info", title, children, className = "" }) {
  const variantClass = variantMap[variant] || styles.info;
  return (
    <div className={`${styles.alert} ${variantClass} ${className}`} role="alert">
      <span className={styles.icon} aria-hidden="true">
        {iconMap[variant] || "ℹ"}
      </span>
      <div className={styles.body}>
        {title ? <span className={styles.title}>{title}</span> : null}
        {children ? <span className={styles.text}>{children}</span> : null}
      </div>
    </div>
  );
}
