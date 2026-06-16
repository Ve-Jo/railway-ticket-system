import styles from "./PageHeader.module.css";

export function PageHeader({ title, description, children, className = "" }) {
  return (
    <div className={`${styles.header} ${className}`}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </div>
  );
}
