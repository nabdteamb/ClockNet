"use client";

import { useEffect, useState } from "react";

import styles from "./activity-feed.module.css";

interface AttendanceSession {
  id: string;
  employeeName: string;
  employeeCode: string;
  deviceId: string;
  checkInTime: string;
  status: string;
}

export default function ActivityFeed() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/admin/attendance?pageSize=8&status=ACTIVE");
        if (res.ok) {
          const data = (await res.json()) as { records: AttendanceSession[] };
          setSessions(data.records);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.feed}>
        <div className={styles.loading}>جاري تحميل النشاط المباشر...</div>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className={styles.feed}>
        <div className={styles.empty}>لا توجد جلسات حضور نشطة حالياً.</div>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      {sessions.map((session) => (
        <div key={session.id} className={styles.item}>
          <div className={styles.indicator}></div>
          <div className={styles.content}>
            <div className={styles.device}>{session.employeeName}</div>
            <div className={styles.meta}>
              <span>{session.employeeCode}</span>
              <span>{new Date(session.checkInTime).toLocaleTimeString("en-US")}</span>
            </div>
          </div>
          <div className={styles.status}>في الموقع</div>
        </div>
      ))}
    </div>
  );
}
