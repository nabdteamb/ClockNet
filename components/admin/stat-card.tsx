import styles from "./stat-card.module.css";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  trend?: number | null;
  highlight?: boolean;
  warning?: boolean;
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  highlight,
  warning,
}: StatCardProps) {
  const displayValue = typeof value === "number" ? value.toLocaleString("en-US") : value;

  return (
    <div
      className={`${styles.card} ${highlight ? styles.highlight : ""} ${warning ? styles.warning : ""
        }`}
    >
      <div className={styles.header}>
        <div className={styles.icon}>{icon}</div>
        <div className={styles.title}>{title}</div>
      </div>
      <div className={styles.value}>{displayValue}</div>
      {trend !== null && trend !== undefined && (
        <div className={`${styles.trend} ${trend >= 0 ? styles.positive : styles.negative}`}>
          {trend >= 0 ? "ارتفاع" : "انخفاض"} {Math.abs(trend).toLocaleString("en-US")}%
        </div>
      )}
    </div>
  );
}
