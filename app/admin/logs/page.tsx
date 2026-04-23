"use client";

import { useDeferredValue, useEffect, useState } from "react";

import styles from "./logs.module.css";

interface AttendanceRegistryRecord {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  isActive: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  duration: number | null;
  attendanceStatus: "ABSENT" | "ACTIVE" | "CLOSED";
  attendedToday: boolean;
}

interface RegistrySummary {
  totalEmployees: number;
  checkedInToday: number;
  activeNow: number;
  absentToday: number;
  shownRecords: number;
}

interface RegistryResponse {
  records: AttendanceRegistryRecord[];
  summary: RegistrySummary;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "لم يحضر اليوم";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(duration: number | null, attendanceStatus: AttendanceRegistryRecord["attendanceStatus"]) {
  if (attendanceStatus === "ABSENT") {
    return "لم يحضر";
  }

  if (!duration) {
    return "0 س 0 د";
  }

  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours} س ${minutes} د`;
}

function getStatusLabel(status: AttendanceRegistryRecord["attendanceStatus"]) {
  switch (status) {
    case "ACTIVE":
      return "داخل الدوام";
    case "CLOSED":
      return "حضر ثم انصرف";
    default:
      return "لم يحضر";
  }
}

function getStatusClass(status: AttendanceRegistryRecord["attendanceStatus"]) {
  switch (status) {
    case "ACTIVE":
      return styles.active;
    case "CLOSED":
      return styles.closed;
    default:
      return styles.absent;
  }
}

export default function AttendanceLogsPage() {
  const [records, setRecords] = useState<AttendanceRegistryRecord[]>([]);
  const [summary, setSummary] = useState<RegistrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = new URL("/api/admin/attendance/registry", window.location.origin);
        if (status) {
          url.searchParams.set("status", status);
        }

        if (deferredSearch.trim()) {
          url.searchParams.set("search", deferredSearch.trim());
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("تعذر جلب سجل الموظفين");
        }

        const data = (await res.json()) as RegistryResponse;
        setRecords(data.records);
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر تحميل السجلات");
      } finally {
        setLoading(false);
      }
    };

    void fetchRecords();
  }, [deferredSearch, status]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>السجلات</h1>
          <p className={styles.subtitle}>
            صف واحد لكل موظف. إذا سجل الموظف حضورًا ثم انصرف ثم سجل حضورًا مرة أخرى، يتم عرض
            آخر دخول جديد فقط مع توضيح من حضر اليوم ومن لم يحضر.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handlePrint}
            className={styles.printButton}
            disabled={loading || records.length === 0}
          >
            طباعة
          </button>
        </div>
      </header>

      {summary && (
        <section className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>إجمالي الموظفين</span>
            <strong className={styles.summaryValue}>
              {summary.totalEmployees.toLocaleString("en-US")}
            </strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>حضر اليوم</span>
            <strong className={styles.summaryValue}>
              {summary.checkedInToday.toLocaleString("en-US")}
            </strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>داخل الدوام الآن</span>
            <strong className={styles.summaryValue}>
              {summary.activeNow.toLocaleString("en-US")}
            </strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>لم يحضر</span>
            <strong className={styles.summaryValue}>
              {summary.absentToday.toLocaleString("en-US")}
            </strong>
          </div>
        </section>
      )}

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث باسم الموظف أو كود الموظف أو القسم"
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={styles.select}
        >
          <option value="">كل الموظفين</option>
          <option value="ACTIVE">داخل الدوام</option>
          <option value="CLOSED">حضر ثم انصرف</option>
          <option value="ABSENT">لم يحضر</option>
        </select>
      </div>

      {loading && <div className={styles.loading}>جاري تحميل سجل الموظفين...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && records.length > 0 && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الموظف</th>
                <th>القسم</th>
                <th>وقت الحضور</th>
                <th>وقت الانصراف</th>
                <th>المدة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div className={styles.primaryCell}>{record.employeeName}</div>
                    <div className={styles.secondaryCell}>{record.employeeCode}</div>
                  </td>
                  <td>{record.department || "غير محدد"}</td>
                  <td className={styles.dateCell}>{formatDateTime(record.checkInTime)}</td>
                  <td className={styles.dateCell}>
                    {record.attendanceStatus === "ABSENT"
                      ? "لم يحضر اليوم"
                      : record.attendanceStatus === "ACTIVE"
                        ? "لم يسجل انصراف بعد"
                        : formatDateTime(record.checkOutTime)}
                  </td>
                  <td className={styles.duration}>
                    {formatDuration(record.duration, record.attendanceStatus)}
                  </td>
                  <td>
                    <div className={`${styles.statusBadge} ${getStatusClass(record.attendanceStatus)}`}>
                      {getStatusLabel(record.attendanceStatus)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className={styles.empty}>لا توجد نتائج مطابقة للفلاتر الحالية.</div>
      )}
    </div>
  );
}
