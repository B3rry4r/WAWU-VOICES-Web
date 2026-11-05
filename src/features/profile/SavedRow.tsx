"use client";
import Link from "next/link";
import { Icon } from "@/components/vx";
import type { components } from "@/lib/api/types";

/** A saved question: its words and the way back to it. */
export function QuestionRow({ q }: { q: components["schemas"]["Question"] }) {
  return (
    <Link href={`/q/${q.id}`} className="pf-qrow">
      <Icon name="bookmark" size={20} />
      <span className="pf-qrow__txt">
        {q.category?.name ? <span className="vx-eyebrow pf-eyebrow">{q.category.name}</span> : null}
        <b>{q.text}</b>
      </span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}
