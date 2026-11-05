import type { ReactNode } from "react";
import { AdminFrame } from "@/features/admin/AdminFrame";

export const metadata = { title: "Admin" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
