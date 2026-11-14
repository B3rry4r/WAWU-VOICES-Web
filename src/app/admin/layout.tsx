import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminFrame } from "@/features/admin/AdminFrame";

// Every /admin page, the sign-in page included, stays out of search results. The address is also disallowed in robots.txt and is not in the sitemap.
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
