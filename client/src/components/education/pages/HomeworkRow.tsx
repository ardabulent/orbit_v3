import type { ReactNode } from "react";
import { NotebookPen } from "lucide-react";
import { Badge } from "../shared";
import type { Homework } from "../types";

/**
 * Ödev listesinin satırı (2026-09-29): kart ızgarası yerine taranabilir
 * liste. Sağ taraf role göre dışarıdan verilir (öğretmende oran ve
 * eylemler, öğrencide kendi durumu).
 */
export function HomeworkRow({
  homework,
  showClass,
  aside,
}: {
  homework: Homework;
  showClass: boolean;
  aside: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 sm:grid">
        <NotebookPen className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-bold text-slate-800">
            {homework.title}
          </span>
          {homework.subject ? (
            <Badge tone="slate">{homework.subject}</Badge>
          ) : null}
        </p>
        {homework.description ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
            {homework.description}
          </p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-slate-500">
          {[
            `Son teslim: ${homework.dueDate}`,
            showClass ? homework.classGroup : null,
            homework.assignedBy,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div>
    </li>
  );
}

export function HomeworkGroup({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-extrabold text-slate-800">
        {title}
        {count > 0 ? (
          <span className="ml-1.5 font-semibold text-slate-400">{count}</span>
        ) : null}
      </h3>
      {count === 0 ? (
        <p className="text-[11px] text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {children}
        </ul>
      )}
    </section>
  );
}
