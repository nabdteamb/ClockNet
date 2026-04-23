"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import StatCard from "@/components/admin/stat-card";
import ActivityFeed from "@/components/admin/activity-feed";

interface DashboardStats {
  stats: {
    totalDevices: number;
    activeUsers: number;
    todayCheckIns: number;
    activeSessions: number;
    recentCriticalEvents: number;
  };
  peakHours: Array<{ hour: number; count: number }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/dashboard/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.error}>{error || "Failed to load dashboard"}</div>
      </div>
    );
  }

  const { stats, peakHours } = data;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Real-time Attendance Monitoring</p>
        </div>
        <div className={styles.timestamp}>
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </header>

      {/* Stats Cards */}
      <section className={styles.statsGrid}>
        <StatCard
          title="Total Devices"
          value={stats.totalDevices}
          icon="📱"
          trend={null}
        />
        <StatCard
          title="Currently Active"
          value={stats.activeUsers}
          icon="✓"
          trend={null}
          highlight={stats.activeUsers > 0}
        />
        <StatCard
          title="Check-ins Today"
          value={stats.todayCheckIns}
          icon="📊"
          trend={null}
        />
        <StatCard
          title="Critical Events"
          value={stats.recentCriticalEvents}
          icon="🚨"
          warning={stats.recentCriticalEvents > 0}
        />
      </section>

      {/* Activity Feed */}
      <section className={styles.activitySection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Live Activity</h2>
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot}></span>
            Live
          </div>
        </div>
        <ActivityFeed />
      </section>

      {/* Peak Hours Chart */}
      {peakHours.length > 0 && (
        <section className={styles.chartSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Check-in Distribution by Hour</h2>
          </div>
          <div className={styles.chart}>
            {peakHours.map((hour) => (
              <div key={hour.hour} className={styles.chartBar}>
                <div className={styles.barContainer}>
                  <div
                    className={styles.bar}
                    style={{
                      height: `${(hour.count / Math.max(...peakHours.map((h) => h.count), 1)) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className={styles.barLabel}>{hour.hour}:00</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
