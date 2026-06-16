import styles from "./StatusBadge.module.css";

const variantMap = {
  reserved: styles.reserved,
  paid: styles.paid,
  active: styles.active,
  refunded: styles.refunded,
  cancelled: styles.cancelled,
  expired: styles.expired,
  available: styles.available,
  occupied: styles.occupied,
  pending: styles.pending,
  confirmed: styles.confirmed,
  success: styles.success,
  error: styles.error,
  warning: styles.warning,
  info: styles.info
};

export function StatusBadge({ status, children, className = "" }) {
  const variant = variantMap[status?.toLowerCase()] || styles.default;
  return (
    <span className={`${styles.badge} ${variant} ${className}`}>
      {children || status}
    </span>
  );
}
