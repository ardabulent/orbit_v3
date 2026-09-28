import { ChevronRight } from "lucide-react";
import type { ExamListItem } from "@/education/examNetService";
import { formatTrDate } from "@/education/trDate";
import { Badge, EmptyState } from "../shared";
import { splitExams } from "./examSections";

/** Türkçe ondalık: 28,5 — 28.5 değil. */
function formatNumber(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/**
 * Sınavlar listesi (karar 2026-09-28, C-07): yaklaşan (en yakın önce) ve
 * geçmiş (en yeni önce). Satıra tıklamak sınav detayını açar.
 */
export function ExamList({
  rows,
  today,
  onOpen,
}: {
  rows: ExamListItem[];
  today: string;
  onOpen: (exam: ExamListItem) => void;
}) {
  if (rows.length === 0)
    return (
      <EmptyState
        title="Henüz sınav kaydı yok"
        description="Sayfa başlığındaki 'Yeni sınav' ile ilk sınavı ekleyin."
      />
    );

  const { upcoming, past } = splitExams(rows, today);
  return (
    <div className="space-y-6">
      <ExamGroup
        title="Yaklaşan"
        empty="Planlanmış sınav yok."
        rows={upcoming}
        onOpen={onOpen}
      />
      <ExamGroup
        title="Geçmiş"
        empty="Geçmiş sınav yok."
        rows={past}
        onOpen={onOpen}
      />
    </div>
  );
}

function ExamGroup({
  title,
  empty,
  rows,
  onOpen,
}: {
  title: string;
  empty: string;
  rows: ExamListItem[];
  onOpen: (exam: ExamListItem) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-extrabold text-slate-800">
        {title}
        {rows.length > 0 ? (
          <span className="ml-1.5 font-semibold text-slate-400">
            {rows.length}
          </span>
        ) : null}
      </h3>
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {rows.map(exam => (
            <li key={exam.id}>
              <button
                type="button"
                onClick={() => onOpen(exam)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-slate-800">
                    {exam.name}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {[
                      formatTrDate(exam.examDate),
                      exam.className ?? "Kurum geneli",
                      exam.subjectName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {exam.netPenalty ? (
                    <Badge tone="violet">
                      Net · {exam.netPenalty === 3 ? "LGS" : "YKS"}
                    </Badge>
                  ) : null}
                  {exam.resultCount ? (
                    <Badge tone="slate">{exam.resultCount} sonuç</Badge>
                  ) : null}
                  {exam.average !== null ? (
                    <Badge tone="blue">
                      Ort. {formatNumber(exam.average)}
                      {exam.netPenalty ? " net" : ""}
                    </Badge>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
