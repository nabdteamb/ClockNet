// app/admin/layout.tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";
import AdminNav from "@/components/admin/admin-nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  return (
    <div className={isLoginPage ? "" : styles.adminContainer}>
      {!isLoginPage && <AdminNav />}
      <main className={isLoginPage ? "" : styles.mainContent}>{children}</main>
    </div>
  );
}