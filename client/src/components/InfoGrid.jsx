import styles from "./InfoGrid.module.css";

export function InfoGrid({ items }) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <article key={item.title} className={styles.card}>
          {item.icon ? (
            <span className={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
          ) : null}
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}
