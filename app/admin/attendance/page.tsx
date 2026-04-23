"use client";

import { useDeferredValue, useEffect, useState } from "react";

import styles from "./attendance.module.css";

interface AttendanceRecord {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  deviceId: string;
  checkInTime: string;
  checkOutTime: string | null;
  duration: number | null;
  checkInIp: string;
  checkOutIp: string | null;
  status: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface SummaryInfo {
  totalRecords: number;
  activeNow: number;
  checkedInToday: number;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [summary, setSummary] = useState<SummaryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [status, setStatus] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = new URL("/api/admin/attendance", window.location.origin);
        url.searchParams.set("page", String(currentPage));
        url.searchParams.set("pageSize", "20");

        if (status) {
          url.searchParams.set("status", status);
        }

        if (deferredSearch.trim()) {
          url.searchParams.set("search", deferredSearch.trim());
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("Failed to fetch records");
        }

        const data = (await res.json()) as {
          records: AttendanceRecord[];
          pagination: PaginationInfo;
          summary: SummaryInfo;
        };

        setRecords(data.records);
        setPagination(data.pagination);
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load records");
      } finally {
        setLoading(false);
      }
    };

    void fetchRecords();
  }, [currentPage, status, deferredSearch]);

  const formatDuration = (ms: number | null) => {
    if (!ms) {
      return "جلسة مفتوحة";
    }

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}س ${minutes}د`;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>سجلات الحضور</h1>
          <p className={styles.subtitle}>
            عرض منظم لمن سجل الحضور، وقت وصولهم، ووقت مغادرتهم.
          </p>
        </div>
        {pagination && <div className={styles.count}>{pagination.total.toLocaleString("en-US")} سجلات</div>}
      </header>

      {summary && (
        <section className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>إجمالي السجلات</span>
            <strong className={styles.summaryValue}>{summary.totalRecords.toLocaleString("en-US")}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>نشط الآن</span>
            <strong className={styles.summaryValue}>{summary.activeNow.toLocaleString("en-US")}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>سجلوا اليوم</span>
            <strong className={styles.summaryValue}>{summary.checkedInToday.toLocaleString("en-US")}</strong>
          </div>
        </section>
      )}

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
          placeholder="بحث بالموظف، الكود، الجهاز، أو عنوان IP"
        />

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setCurrentPage(1);
          }}
          className={styles.select}
        >
          <option value="">جميع الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="CLOSED">مغلق</option>
        </select>
      </div>

      {loading && <div className={styles.loading}>جاري تحميل السجلات...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && records.length > 0 && (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>القسم</th>
                  <th>تسجيل الحضور</th>
                  <th>تسجيل الانصراف</th>
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
                    <td>{new Date(record.checkInTime).toLocaleString("en-US")}</td>
                    <td>
                      {record.checkOutTime
                        ? new Date(record.checkOutTime).toLocaleString("en-US")
                        : "لا يزال في الموقع"}
                    </td>
                    <td className={styles.duration}>{formatDuration(record.duration)}</td>
                    <td>
                      <div
                        className={`${styles.statusBadge} ${record.status === "ACTIVE" ? styles.active : styles.closed
                          }`}
                      >
                        {record.status === "ACTIVE" ? "في الموقع" : "مغلق"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className={styles.paginationButton}
              >
                السابق
              </button>
              <div className={styles.pageInfo}>
                صفحة {pagination.page.toLocaleString("en-US")} من {pagination.totalPages.toLocaleString("en-US")}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))
                }
                disabled={currentPage === pagination.totalPages}
                className={styles.paginationButton}
              >
                التالي
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && records.length === 0 && (
        <div className={styles.empty}>لا توجد سجلات حضور.</div>
      )}
    </div>
  );
}
