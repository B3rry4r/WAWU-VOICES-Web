"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Bell } from "./Bell";
import { MessagesIcon } from "./Messages";
import { GuestEntry } from "./GuestEntry";

function Field() {
  const router = useRouter();
  const q = useSearchParams().get("q") ?? "";
  return (
    <form
      role="search"
      className="sh-search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        if (v.length >= 2) router.push(`/search?q=${encodeURIComponent(v)}`);
      }}
    >
      <Search size={20} aria-hidden="true" />
      <label className="vx-sr" htmlFor="desk-search">Search VOICES</label>
      <input id="desk-search" key={q} type="search" name="q" minLength={2} defaultValue={q} placeholder="Search questions, voices and handles" enterKeyHint="search" />
    </form>
  );
}

/** The search field in the desktop top row (Home, Discover, Category and Search boards at 1440). */
export function DeskSearch() {
  return (
    <div className="sh-desk sh-deskbar">
      <Suspense fallback={<div className="sh-search"><Search size={20} aria-hidden="true" /></div>}>
        <Field />
      </Suspense>
      <GuestEntry />
      <MessagesIcon />
      <Bell />
    </div>
  );
}
