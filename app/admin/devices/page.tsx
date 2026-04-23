"use client";

import { FormEvent, useDeferredValue, useEffect, useState } from "react";

import styles from "./devices.module.css";

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  allowedIp: string | null;
  isActive: boolean;
  createdAt: string;
  assignedDeviceId: string | null;
  lastKnownIp: string | null;
  lastSeenAt: string | null;
  totalSessions: number;
  currentStatus: "active" | "offline" | "ready" | "pending";
  lastCheckIn: string | null;
  lastCheckOut: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface SummaryInfo {
  totalEmployees: number;
  activeEmployees: number;
  assignedDevices: number;
  unassignedDevices: number;
}

const initialForm = {
  employeeCode: "",
  fullName: "",
  department: "",
};

export default function DevicesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [additionalDepartments, setAdditionalDepartments] = useState<string[]>([]);
  const [showNewDeptInput, setShowNewDeptInput] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [summary, setSummary] = useState<SummaryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = new URL("/api/admin/devices", window.location.origin);
        url.searchParams.set("page", String(currentPage));
        url.searchParams.set("pageSize", "12");

        if (deferredSearch.trim()) {
          url.searchParams.set("search", deferredSearch.trim());
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("تعذر جلب الموظفين");
        }

        const data = (await res.json()) as {
          employees: Employee[];
          pagination: PaginationInfo;
          summary: SummaryInfo;
        };

        setEmployees(data.employees);
        setPagination(data.pagination);
        setSummary(data.summary);

        const depts = Array.from(
          new Set(data.employees.map((e) => e.department).filter(Boolean))
        ) as string[];
        setDepartments(depts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر تحميل الموظفين");
      } finally {
        setLoading(false);
      }
    };

    void fetchEmployees();
  }, [currentPage, deferredSearch]);

  const refreshList = async (page = currentPage) => {
    const url = new URL("/api/admin/devices", window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", "12");

    if (deferredSearch.trim()) {
      url.searchParams.set("search", deferredSearch.trim());
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("تعذر تحديث بيانات الموظفين");
    }

    const data = (await res.json()) as {
      employees: Employee[];
      pagination: PaginationInfo;
      summary: SummaryInfo;
    };

    setEmployees(data.employees);
    setPagination(data.pagination);
    setSummary(data.summary);

    const depts = Array.from(
      new Set(data.employees.map((e) => e.department).filter(Boolean))
    ) as string[];
    setDepartments(depts);
  };

  const confirmNewDepartment = () => {
    const newDept = form.department.trim();
    if (newDept && !departments.includes(newDept) && !additionalDepartments.includes(newDept)) {
      setAdditionalDepartments((prev) => [...prev, newDept]);
    }
    setShowNewDeptInput(false);
  };

  const submitEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(data.message || "تعذر إضافة الموظف");
      }

      setForm(initialForm);
      setShowNewDeptInput(false);
      setCurrentPage(1);
      await refreshList(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إضافة الموظف");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusLabel = (status: Employee["currentStatus"]) => {
    switch (status) {
      case "active":
        return "متواجد";
      case "offline":
        return "انصرف";
      case "ready":
        return "مربوط";
      default:
        return "بانتظار جهاز";
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>إدارة الموظفين</h1>
          <p className={styles.subtitle}>
            أضف الموظفين، واربط لكل موظف جهازًا موثوقًا، وتابع آخر نشاط مسجل لهم.
          </p>
        </div>
      </header>

      {summary && (
        <section className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>الموظفون</span>
            <strong className={styles.summaryValue}>
              {summary.totalEmployees.toLocaleString("en-US")}
            </strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>النشطون</span>
            <strong className={styles.summaryValue}>
              {summary.activeEmployees.toLocaleString("en-US")}
            </strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>الأجهزة المربوطة</span>
            <strong className={styles.summaryValue}>
              {summary.assignedDevices.toLocaleString("en-US")}
            </strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>الأجهزة غير المربوطة</span>
            <strong className={styles.summaryValue}>
              {summary.unassignedDevices.toLocaleString("en-US")}
            </strong>
          </div>
        </section>
      )}

      <section className={styles.createSection}>
        <div className={styles.sectionHeading}>
          <h2>إضافة موظف</h2>
          <p>أنشئ الموظف أولًا، ثم يستخدم كوده في شاشة الحضور لربط الجهاز الحالي به.</p>
        </div>

        <form className={styles.formGrid} onSubmit={submitEmployee}>
          <label className={styles.field}>
            <span>كود الموظف</span>
            <input
              value={form.employeeCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, employeeCode: event.target.value }))
              }
              placeholder="EMP001"
              required
            />
          </label>

          <label className={styles.field}>
            <span>الاسم الكامل</span>
            <input
              value={form.fullName}
              onChange={(event) =>
                setForm((current) => ({ ...current, fullName: event.target.value }))
              }
              placeholder="اسم الموظف"
              required
            />
          </label>

          <div className={styles.field}>
            <span>القسم</span>
            {!showNewDeptInput ? (
              <select
                value={form.department}
                onChange={(event) => {
                  if (event.target.value === "ADD_NEW") {
                    setShowNewDeptInput(true);
                    setForm((current) => ({ ...current, department: "" }));
                  } else {
                    setForm((current) => ({ ...current, department: event.target.value }));
                  }
                }}
                className={styles.select}
                required
              >
                <option value="">اختر القسم</option>
                {Array.from(new Set([...departments, ...additionalDepartments])).map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
                <option value="ADD_NEW">+ أضف قسماً جديداً...</option>
              </select>
            ) : (
              <div className={styles.newDeptRow}>
                <input
                  autoFocus
                  className={styles.newDeptInput}
                  value={form.department}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, department: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      confirmNewDepartment();
                    }
                  }}
                  placeholder="اسم القسم الجديد"
                  required
                />
                <button
                  type="button"
                  className={styles.confirmNewDept}
                  onClick={confirmNewDepartment}
                  disabled={!form.department.trim()}
                >
                  إضافة
                </button>
                <button
                  type="button"
                  className={styles.cancelNewDept}
                  onClick={() => {
                    setShowNewDeptInput(false);
                    setForm((current) => ({ ...current, department: "" }));
                  }}
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button type="submit" disabled={submitting}>
              {submitting ? "جاري الحفظ..." : "إضافة الموظف"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.tableSection}>
        <div className={styles.toolbar}>
          <div>
            <h2>سجل الموظفين</h2>
            <p>ابحث بالاسم أو كود الموظف أو القسم.</p>
          </div>
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="ابحث عن موظف"
          />
        </div>

        {loading && <div className={styles.loading}>جاري تحميل الموظفين...</div>}
        {error && <div className={styles.error}>{error}</div>}

        {!loading && !error && employees.length > 0 && (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>القسم</th>
                    <th>الحالة</th>
                    <th>آخر حضور</th>
                    <th>آخر انصراف</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <div className={styles.primaryCell}>{employee.fullName}</div>
                        <div className={styles.secondaryCell}>{employee.employeeCode}</div>
                      </td>
                      <td>{employee.department || "غير محدد"}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[employee.currentStatus]}`}>
                          {getStatusLabel(employee.currentStatus)}
                        </span>
                      </td>
                      <td>
                        {employee.lastCheckIn
                          ? new Date(employee.lastCheckIn).toLocaleString("en-US")
                          : "لا توجد سجلات"}
                      </td>
                      <td>
                        {employee.lastCheckOut
                          ? new Date(employee.lastCheckOut).toLocaleString("en-US")
                          : "لا توجد سجلات"}
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
                  الصفحة {pagination.page.toLocaleString("en-US")} من{" "}
                  {pagination.totalPages.toLocaleString("en-US")}
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

        {!loading && !error && employees.length === 0 && (
          <div className={styles.empty}>لا يوجد موظفون مطابقون لنتيجة البحث.</div>
        )}
      </section>
    </div>
  );
}
