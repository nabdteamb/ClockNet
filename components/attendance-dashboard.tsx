"use client";

import { useEffect, useState, useTransition } from "react";

import { buildDeviceFingerprint } from "@/lib/device-fingerprint";

type ApiResponse = {
  ok: boolean;
  status: "checked_in" | "checked_out";
  message: string;
  currentSession: {
    checkInAt: string;
    checkOutAt: string | null;
  } | null;
};

export function AttendanceDashboard() {
  const [fingerprint, setFingerprint] = useState("");
  const [status, setStatus] = useState<"checked_in" | "checked_out">("checked_out");
  const [message, setMessage] = useState("جاري تجهيز الجهاز...");
  const [currentSession, setCurrentSession] = useState<ApiResponse["currentSession"]>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const deviceFingerprint = buildDeviceFingerprint();
    setFingerprint(deviceFingerprint);

    void loadStatus(deviceFingerprint);
  }, []);

  async function loadStatus(deviceFingerprint: string) {
    const response = await fetch("/api/attendance/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fingerprint: deviceFingerprint }),
      cache: "no-store"
    });

    const data = (await response.json()) as ApiResponse | { message?: string };
    if (!response.ok || !("status" in data)) {
      setMessage(data.message ?? "غير قادر على تحميل الحالة الحالية.");
      return;
    }

    setStatus(data.status);
    setMessage(data.message);
    setCurrentSession(data.currentSession);
  }

  function submit(action: "check-in" | "check-out") {
    startTransition(async () => {
      const response = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fingerprint })
      });

      const data = (await response.json()) as ApiResponse | { message?: string };
      if (!response.ok || !("status" in data)) {
        setMessage(data.message ?? "فشل الطلب.");
        return;
      }

      setStatus(data.status);
      setMessage(data.message);
      setCurrentSession(data.currentSession);
    });
  }

  const isCheckedIn = status === "checked_in";

  return (
    <main className="shell">
      <section className="panel">
        <div className="eyebrow">كلوك نت</div>
        <h1>لوحة متابعة الحضور</h1>
        <p className="lede">تسجيل الحضور مقفل على هذا الجهاز وشبكة الشركة.</p>

        <div className={`status-card ${isCheckedIn ? "active" : "idle"}`}>
          <span className="status-label">الحالة الحالية</span>
          <strong>{isCheckedIn ? "تم تسجيل الحضور" : "تم تسجيل الانصراف"}</strong>
          <span className="status-meta">
            {currentSession?.checkInAt
              ? `آخر تسجيل حضور ${new Date(currentSession.checkInAt).toLocaleString("ar-EG")}`
              : "لا توجد جلسة نشطة"}
          </span>
        </div>

        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={() => submit("check-in")}
            disabled={isPending || isCheckedIn || !fingerprint}
          >
            تسجيل الحضور
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => submit("check-out")}
            disabled={isPending || !isCheckedIn || !fingerprint}
          >
            تسجيل الانصراف
          </button>
        </div>

        <p className="message">{message}</p>
      </section>
    </main>
  );
}
