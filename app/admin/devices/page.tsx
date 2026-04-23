"use client";

import { useEffect, useState } from "react";
import styles from "./devices.module.css";

interface Device {
  id: string;
  deviceId: string;
  createdAt: string;
  lastSeen: string;
  totalCheckIns: number;
  totalLogs: number;
  suspiciousEvents: number;
  currentStatus: string;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/devices?page=${currentPage}&pageSize=20`);
        if (!res.ok) throw new Error("Failed to fetch devices");
        const data = await res.json();
        setDevices(data.devices);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load devices");
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, [currentPage]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "checked-in":
        return "✓";
      case "checked-out":
        return "✗";
      default:
        return "?";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "checked-in":
        return "#22c55e";
      case "checked-out":
        return "#94a3b8";
      default:
        return "#64748b";
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Devices</h1>
          <p className={styles.subtitle}>Manage all registered devices</p>
        </div>
        {pagination && (
          <div className={styles.count}>
            {pagination.total} devices
          </div>
        )}
      </header>

      {loading && <div className={styles.loading}>Loading devices...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && devices.length > 0 && (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Status</th>
                  <th>Check-ins</th>
                  <th>Last Check-in</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <div className={styles.deviceId}>{device.deviceId}</div>
                      <div className={styles.deviceMeta}>
                        Registered: {new Date(device.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div
                        className={styles.statusBadge}
                        style={{ color: getStatusColor(device.currentStatus) }}
                      >
                        {getStatusIcon(device.currentStatus)} {device.currentStatus}
                      </div>
                    </td>
                    <td className={styles.number}>{device.totalCheckIns}</td>
                    <td>
                      {device.lastCheckIn
                        ? new Date(device.lastCheckIn).toLocaleString()
                        : "Never"}
                    </td>
                    <td>
                      {device.suspiciousEvents > 0 ? (
                        <div className={styles.warning}>
                          ⚠ {device.suspiciousEvents}
                        </div>
                      ) : (
                        <div className={styles.safe}>✓ Safe</div>
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
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
                className={styles.paginationButton}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && devices.length === 0 && (
        <div className={styles.empty}>No devices registered yet</div>
      )}
    </div>
  );
}
