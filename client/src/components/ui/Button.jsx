import styles from "./Button.module.css";

const variantClass = {
  primary: styles.primary,
  secondary: styles.secondary,
  accent: styles.accent,
  outline: styles.outline,
  ghost: styles.ghost,
  danger: styles.danger
};

const sizeClass = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  isLoading = false,
  disabled = false,
  fullWidth = false,
  className = "",
  onClick,
  ...rest
}) {
  const classes = [
    styles.button,
    variantClass[variant] || styles.primary,
    sizeClass[size] || styles.md,
    fullWidth ? styles.fullWidth : "",
    className
  ]
    .join(" ")
    .trim();

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...rest}
    >
      {isLoading ? (
        <span className={styles.spinnerWrap}>
          <span className={styles.spinner} aria-hidden="true" />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
