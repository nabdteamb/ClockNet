"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "فشل تسجيل الدخول");
      }

      router.push("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer} dir="rtl">
      <div className={styles.loginPanel}>
        <h1 className={styles.title}>مدير كلوك نت</h1>
        <p className={styles.subtitle}>نظام إدارة الحضور</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@clocknet.local"
              className={styles.input}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            كلوك نت v1.0 • لوحة تحكم المدير
          </p>
        </div>
      </div>
    </div>
  );
}
