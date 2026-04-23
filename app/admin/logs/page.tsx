"use client";

import { useEffect, useState } from "react";
import styles from "./logs.module.css";

interface AuditLog {
  id: string;
  device: { deviceId: string } | null;
  eventType: string;
  severity: string;
  description: string;
  ip: string;
  attemptCount: number;
  isBlocked: boolean;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Summary {
  critical: number;
  warning: number;
  info: number;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ severity: "" });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const url = new URL("/api/admin/audit-logs", window.location.origin);
        url.searchParams.set("page", String(currentPage));
        url.searchParams.set("pageSize", "20");
        if (filters.severity) url.searchParams.set("severity", filters.severity);

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch logs");
        const data = await res.json();
        setLogs(data.logs);
        setPagination(data.pagination);
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [currentPage, filters]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "#ef4444";
      case "WARNING":
        return "#f59e0b";
      case "INFO":
        return "#3b82f6";
      default:
        return "#94a3b8";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "🔴";
      case "WARNING":
        return "🟡";
      case "INFO":
        return "🔵";
      default:
        return "⚪";
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Logs</h1>
          <p className={styles.subtitle}>Security and system events</p>
        </div>
        {pagination && (
          <div className={styles.count}>
            {pagination.total} events
          </div>
        )}
      </header>

      {summary && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Critical</span>
            <span className={styles.summaryValue} style={{ color: "#ef4444" }}>
              {summary.critical}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Warning</span>
            <span className={styles.summaryValue} style={{ color: "#f59e0b" }}>
              {summary.warning}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Info</span>
            <span className={styles.summaryValue} style={{ color: "#3b82f6" }}>
              {summary.info}
            </span>
          </div>
        </div>
      )}

      <div className={styles.filterBar}>
        <select
          value={filters.severity}
          onChange={(e) => {
            setFilters({ ...filters, severity: e.target.value });
            setCurrentPage(1);
          }}
          className={styles.select}
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
      </div>

      {loading && <div className={styles.loading}>Loading logs...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && logs.length > 0 && (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Event Type</th>
                  <th>Description</th>
                  <th>Device</th>
                  <th>IP</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div
                        className={styles.severity}
                        style={{ color: getSeverityColor(log.severity) }}
                      >
                        {getSeverityIcon(log.severity)} {log.severity}
                      </div>
                    </td>
                    <td>
                      <code className={styles.code}>{log.eventType}</code>
                    </td>
                    <td>{log.description}</td>
                    <td>
                      {log.device ? (
                        <code className={styles.code}>{log.device.deviceId}</code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <code className={styles.code}>{log.ip}</code>
                    </td>
                    <td className={styles.time}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      {log.isBlocked ? (
                        <div className={styles.blocked}>🚫 Blocked</div>
                      ) : (
                        <div className={styles.logged}>✓ Logged</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={styles.paginationButton}
              >
                ← Previous
              </button>
              <div className={styles.pageInfo}>
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={currentPage === pagination.totalPages}
                className={styles.paginationButton}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className={styles.empty}>No audit logs found</div>
      )}
    </div>
  );
}
