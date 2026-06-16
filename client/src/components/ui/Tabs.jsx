import styles from "./Tabs.module.css";

export function Tabs({ tabs, activeTab, onChange, className = "" }) {
  return (
    <div className={`${styles.tabs} ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
