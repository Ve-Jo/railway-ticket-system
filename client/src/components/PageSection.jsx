import styles from "./PageSection.module.css";

export function PageSection({ title, description, children, className = "" }) {
  return (
    <section className={`${styles.section} ${className}`}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
