"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ActivityFeed from "@/components/admin/activity-feed";
import StatCard from "@/components/admin/stat-card";

import styles from "./dashboard.module.css";

interface DashboardStats {
  stats: {
    totalEmployees: number;
    assignedDevices: number;
    activeNow: number;
    todayCheckIns: number;
    recentCriticalEvents: number;
  };
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
        if (!res.ok) {
          throw new Error("Failed to fetch stats");
        }

        const json = (await res.json()) as DashboardStats;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>لوحة تحكم الحضور</h1>
        <div className={styles.loading}>جاري تحميل لوحة التحكم...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>لوحة تحكم الحضور</h1>
        <div className={styles.error}>{error || "فشل في تحميل لوحة التحكم"}</div>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerIntro}>
          <h1 className={styles.title}>لوحة تحكم الحضور</h1>
          <p className={styles.subtitle}>
            عرض حي لتواجد الموظفين، الأجهزة المرتبطة، ونشاط الحضور.
          </p>
        </div>

        <div className={styles.headerSide}>
          <div className={styles.headerActions}>
            <Link href="/admin/devices" className={styles.primaryAction}>
              موظف
            </Link>
          </div>
        </div>
      </header>

      <section className={styles.statsGrid}>
        <StatCard title="إجمالي الموظفين" value={stats.totalEmployees} icon="EMP" />
        <StatCard title="الأجهزة المسندة" value={stats.assignedDevices} icon="DEV" />
        <StatCard
          title="نشط الآن"
          value={stats.activeNow}
          icon="NOW"
          highlight={stats.activeNow > 0}
        />
        <StatCard
          title="أحداث حرجة"
          value={stats.recentCriticalEvents}
          icon="SEC"
          warning={stats.recentCriticalEvents > 0}
        />
      </section>

      <section className={styles.activitySection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>الحضور الحالي</h2>
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot}></span>
            مباشر
          </div>
        </div>
        <ActivityFeed />
      </section>
    </div>
  );
}
