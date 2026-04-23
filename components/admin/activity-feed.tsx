"use client";

import { useEffect, useState } from "react";
import styles from "./activity-feed.module.css";

interface AttendanceSession {
  id: string;
  deviceId: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
}

export default function ActivityFeed() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/admin/attendance?pageSize=10&status=ACTIVE");
        if (res.ok) {
          const data = await res.json();
          setSessions(data.records);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.feed}>
        <div className={styles.loading}>Loading activity...</div>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className={styles.feed}>
        <div className={styles.empty}>No active sessions</div>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      {sessions.map((session) => (
        <div key={session.id} className={styles.item}>
          <div className={styles.indicator}></div>
          <div className={styles.content}>
            <div className={styles.device}>{session.deviceId}</div>
            <div className={styles.time}>
              Checked in at{" "}
              {new Date(session.checkInTime).toLocaleTimeString()}
            </div>
          </div>
          <div className={styles.status}>Active</div>
        </div>
      ))}
    </div>
  );
}
