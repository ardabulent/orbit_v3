import { ChevronRight } from "lucide-react";
import type { ExamListItem } from "@/education/examNetService";
import { formatTrDate } from "@/education/trDate";
import { Badge, EmptyState } from "../shared";
import {
  examResultStatus,
  splitExams,
  type ExamResultStatus,
} from "./examSections";

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
  classStudentCounts = new Map(),
}: {
  rows: ExamListItem[];
  today: string;
  onOpen: (exam: ExamListItem) => void;
  /** Sınıf kimliği → öğrenci sayısı; "2/4" ilerlemesinin paydası. */
  classStudentCounts?: Map<string, number>;
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
        today={today}
        classStudentCounts={classStudentCounts}
      />
      <ExamGroup
        title="Geçmiş"
        empty="Geçmiş sınav yok."
        rows={past}
        onOpen={onOpen}
        today={today}
        classStudentCounts={classStudentCounts}
      />
    </div>
  );
}

function ExamGroup({
  title,
  empty,
  rows,
  onOpen,
  today,
  classStudentCounts,
}: {
  title: string;
  empty: string;
  rows: ExamListItem[];
  onOpen: (exam: ExamListItem) => void;
  today: string;
  classStudentCounts: Map<string, number>;
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
                  <ResultStatusBadge
                    status={examResultStatus(
                      exam,
                      today,
                      exam.classId
                        ? (classStudentCounts.get(exam.classId) ?? null)
                        : null
                    )}
                  />
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

function ResultStatusBadge({ status }: { status: ExamResultStatus }) {
  if (status.kind === "planned")
    return <Badge tone="slate">Planlandı · sonuç sınav günü girilir</Badge>;
  if (status.kind === "complete")
    return (
      <Badge tone="green">
        Sonuçlar tamam · {status.entered}/{status.expected}
      </Badge>
    );
  // Beklenen sayı bilinmiyor ama sonuç girilmiş (ör. kurum geneli sınav):
  // eksik olup olmadığı bilinmediği için uyarı rengi değil, nötr sayı.
  if (status.expected === null && status.entered > 0)
    return <Badge tone="slate">{status.entered} sonuç girildi</Badge>;
  return (
    <Badge tone="amber">
      Sonuç gir
      {status.expected !== null
        ? ` · ${status.entered}/${status.expected}`
        : ""}
    </Badge>
  );
}
