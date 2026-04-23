"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Building2,
  Clock,
  Fingerprint,
  Globe,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
  User
} from "lucide-react";
import { buildDeviceFingerprint } from "@/lib/device-fingerprint";

type ApiResponse = {
  ok: boolean;
  status: "checked_in" | "checked_out";
  message: string;
  requiresEmployeeCode: boolean;
  networkValid: boolean;
  employee: {
    employeeCode: string;
    fullName: string;
    department: string | null;
  } | null;
  currentSession: {
    checkInAt: string;
    checkOutAt: string | null;
  } | null;
};

export function AttendanceDashboard() {
  const [fingerprint, setFingerprint] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [status, setStatus] = useState<"checked_in" | "checked_out">("checked_out");
  const [message, setMessage] = useState("جاري تجهيز الجهاز...");
  const [networkValid, setNetworkValid] = useState(false);
  const [requiresEmployeeCode, setRequiresEmployeeCode] = useState(false);
  const [employee, setEmployee] = useState<ApiResponse["employee"]>(null);
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fingerprint: deviceFingerprint }),
      cache: "no-store",
    });

    const data = (await response.json()) as ApiResponse | { message?: string };
    if (!response.ok || !("status" in data)) {
      setMessage(data.message ?? "غير قادر على تحميل الحالة الحالية.");
      return;
    }

    setStatus(data.status);
    setMessage(data.message);
    setCurrentSession(data.currentSession);
    setEmployee(data.employee);
    setRequiresEmployeeCode(data.requiresEmployeeCode);
    setNetworkValid(data.networkValid);
    setEmployeeCode((current) => current || data.employee?.employeeCode || "");
  }

  function submit(action: "check-in" | "check-out") {
    startTransition(async () => {
      const response = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fingerprint, employeeCode }),
      });

      const data = (await response.json()) as ApiResponse | { message?: string };
      if (!response.ok || !("status" in data)) {
        setMessage(data.message ?? "فشل الطلب.");
        return;
      }

      setStatus(data.status);
      setMessage(data.message);
      setCurrentSession(data.currentSession);
      setEmployee(data.employee);
      setRequiresEmployeeCode(data.requiresEmployeeCode);
      setNetworkValid(data.networkValid);
      setEmployeeCode(data.employee?.employeeCode ?? employeeCode);
    });
  }

  const isCheckedIn = status === "checked_in";
  const latestAttendanceTime = currentSession?.checkOutAt ?? currentSession?.checkInAt ?? null;

  function formatTimestamp(value: string | null) {
    if (!value) {
      return "--:-- / -- / ----";
    }

    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  return (
    <main className="shell">
      <div className="attendance-container">
        <div className="attendance-header">
          <h1 className="attendance-title">تسجيل الحضور</h1>
          <p className="attendance-subtitle">سجّل حضورك بسهولة وسرعة.</p>
        </div>

        <section className="panel attendance-card">
          <div className="card-top-header">
            <div className={`status-chip-v2 ${isCheckedIn ? "is-active" : ""}`}>
              <div className="pulse-dot"></div>
              <div className="chip-content">
                <span>الحالة الحالية</span>
                <strong>{isCheckedIn ? "داخل الدوام" : "خارج الدوام"}</strong>
              </div>
            </div>

            <div className="portal-badge">
              بوابة الحضور والانصراف
            </div>
          </div>

          <div className="card-center-icon">
            <div className="avatar-circle">
              <User size={32} strokeWidth={2} />
            </div>
            <h2>{isCheckedIn ? "تسجيل الانصراف" : "تسجيل الحضور"}</h2>
            <p>أدخل كود الموظف ثم اضغط على {isCheckedIn ? "تسجيل الانصراف" : "تسجيل الحضور"}.</p>
          </div>

          <div className="attendance-form-v2">
            <label className="field-v2">
              <span>كود الموظف</span>
              <div className="input-wrapper">
                <Fingerprint className="input-icon" size={20} />
                <input
                  type="text"
                  value={employeeCode}
                  onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())}
                  placeholder="أدخل كود الموظف"
                  disabled={isPending}
                />
              </div>
            </label>

            <button
              type="button"
              className={`submit-btn ${isCheckedIn ? "is-out" : "is-in"}`}
              onClick={() => submit(isCheckedIn ? "check-out" : "check-in")}
              disabled={isPending || !fingerprint}
            >
              <span>{isPending ? "جارٍ التنفيذ..." : isCheckedIn ? "تسجيل الانصراف" : "تسجيل الحضور"}</span>
              {isCheckedIn ? (
                <LogOut size={20} strokeWidth={2.5} />
              ) : (
                <LogIn size={20} strokeWidth={2.5} />
              )}
            </button>
          </div>

          <div className="card-footer-v2">
            <ShieldCheck size={18} className="lock-icon" />
            <span>جهاز معتمد ومتصل بالشبكة الداخلية للشركة.</span>
          </div>
        </section>

        {message && (
          <p className={`footer-message ${networkValid ? "is-good" : "is-warning"}`}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
