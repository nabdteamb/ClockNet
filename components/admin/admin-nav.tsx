"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./admin-nav.module.css";

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className={styles.nav}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>◆</div>
          <div className={styles.logoText}>
            <div className={styles.logoBrand}>ClockNet</div>
            <div className={styles.logoSub}>Admin</div>
          </div>
        </div>
      </div>

      <ul className={styles.menu}>
        <li>
          <Link
            href="/admin/dashboard"
            className={`${styles.menuItem} ${isActive("/admin/dashboard") ? styles.active : ""}`}
          >
            <span className={styles.icon}>📊</span>
            <span className={styles.label}>Dashboard</span>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/devices"
            className={`${styles.menuItem} ${isActive("/admin/devices") ? styles.active : ""}`}
          >
            <span className={styles.icon}>📱</span>
            <span className={styles.label}>Devices</span>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/attendance"
            className={`${styles.menuItem} ${isActive("/admin/attendance") ? styles.active : ""}`}
          >
            <span className={styles.icon}>✓</span>
            <span className={styles.label}>Attendance</span>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/logs"
            className={`${styles.menuItem} ${isActive("/admin/logs") ? styles.active : ""}`}
          >
            <span className={styles.icon}>🔐</span>
            <span className={styles.label}>Audit Logs</span>
          </Link>
        </li>
      </ul>

      <div className={styles.footer}>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={styles.logoutButton}
        >
          <span className={styles.icon}>→</span>
          <span className={styles.label}>{isLoggingOut ? "..." : "Logout"}</span>
        </button>
      </div>
    </nav>
  );
}
