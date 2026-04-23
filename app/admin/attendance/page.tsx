"use client";

import { useEffect, useState } from "react";
import styles from "./attendance.module.css";

interface AttendanceRecord {
  id: string;
  deviceId: string;
  checkInTime: string;
  checkOutTime: string | null;
  duration: number | null;
  checkInIp: string;
  checkOutIp: string | null;
  status: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ status: "ACTIVE" });

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const url = new URL("/api/admin/attendance", window.location.origin);
        url.searchParams.set("page", String(currentPage));
        url.searchParams.set("pageSize", "20");
        if (filters.status) url.searchParams.set("status", filters.status);

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch records");
        const data = await res.json();
        setRecords(data.records);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load records");
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [currentPage, filters]);

  const formatDuration = (ms: number | null) => {
    if (!ms) return "—";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Attendance Records</h1>
          <p className={styles.subtitle}>View all check-ins and check-outs</p>
        </div>
        {pagination && (
          <div className={styles.count}>
            {pagination.total} records
          </div>
        )}
      </header>

      <div className={styles.filterBar}>
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters({ ...filters, status: e.target.value });
            setCurrentPage(1);
          }}
          className={styles.select}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {loading && <div className={styles.loading}>Loading records...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && records.length > 0 && (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Check-in Time</th>
                  <th>Check-out Time</th>
                  <th>Duration</th>
                  <th>IP</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className={styles.device}>{record.deviceId}</div>
                    </td>
                    <td>
                      {new Date(record.checkInTime).toLocaleString()}
                    </td>
                    <td>
                      {record.checkOutTime
                        ? new Date(record.checkOutTime).toLocaleString()
                        : "—"}
                    </td>
                    <td className={styles.duration}>
                      {formatDuration(record.duration)}
                    </td>
                    <td>
                      <code className={styles.ip}>{record.checkInIp}</code>
                    </td>
                    <td>
                      <div
                        className={`${styles.statusBadge} ${
                          record.status === "ACTIVE" ? styles.active : styles.closed
                        }`}
                      >
                        {record.status}
                      </div>
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

      {!loading && !error && records.length === 0 && (
        <div className={styles.empty}>No attendance records found</div>
      )}
    </div>
  );
}
