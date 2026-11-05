import type { ReactNode } from "react";
import { AdminFrame } from "@/features/admin/AdminFrame";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
