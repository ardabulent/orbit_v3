import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useStudentExams, useStudents } from "@/education/educationQueries";
import type { StudentExam } from "@/education/studentExamService";
import { formatTrDate, getOrbitToday } from "@/education/trDate";
import { ChildPicker } from "../dashboards/ChildPicker";
import {
  Badge,
  CardSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
} from "../shared";
import type { Role } from "../types";

/** Türkçe ondalık: 28,5 — 28.5 değil. */
function formatNumber(value: number): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/**
 * Öğrenci ve velinin Sınavlar sekmesi (karar 2026-09-28): yaklaşan
 * sınavlar ve sonuçlar — kendi puanı/neti, sınıf ortalaması, netli sınavda
 * ders ders doğru/yanlış/net. Başka öğrencinin puanı hiçbir yerde yok;
 * ortalama üç sonuçtan azsa gösterilmez.
 */
export function StudentExamsView({ role }: { role: Role }) {
  const studentsQuery = useStudents();
  const children = studentsQuery.data?.rows ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const student =
    children.find(c => c.id === selectedId) ?? children[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Ölçme ve değerlendirme"
        title="Akademik gelişim"
        description={
          role === "parent"
            ? "Çocuğunuzun yaklaşan sınavları ve sonuçları, sınıf ortalamasıyla birlikte."
            : "Yaklaşan sınavların ve sonuçların, sınıf ortalamasıyla birlikte."
        }
      />
      {studentsQuery.isPending ? (
        <CardSkeleton className="mt-6" />
      ) : studentsQuery.isError ? (
        <ErrorState
          className="mt-6"
          message="Öğrenci bilgileri alınamadı."
          onRetry={() => void studentsQuery.refetch()}
        />
      ) : !student ? (
        <div className="mt-6">
          <EmptyState
            title="Hesabınıza bağlı bir öğrenci yok"
            description="Kurum yöneticisi hesabınızı öğrenci kaydına bağladığında sınavlar burada görünür."
          />
        </div>
      ) : (
        <>
          {role === "parent" && children.length > 1 ? (
            <ChildPicker
              childrenList={children}
              selectedId={student.id}
              onSelect={setSelectedId}
            />
          ) : null}
          <StudentExamsBody key={student.id} studentId={student.id} />
        </>
      )}
    </>
  );
}

function StudentExamsBody({ studentId }: { studentId: string }) {
  const today = getOrbitToday();
  const query = useStudentExams({ studentId, today });

  if (query.isPending) return <CardSkeleton className="mt-6" />;
  if (query.isError)
    return (
      <ErrorState
        className="mt-6"
        title="Sınav bilgileri görüntülenemedi"
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );

  const { upcoming, results } = query.data;
  return (
    <div className="mt-6 space-y-6">
      <section>
        <h2 className="mb-2 text-[13px] font-extrabold text-slate-800">
          Yaklaşan sınavlar
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-[12px] text-slate-400">Planlanmış sınav yok.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {upcoming.map(exam => (
              <li key={exam.id} className="flex items-center gap-3 px-4 py-3">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-slate-800">
                    {exam.name}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {formatTrDate(exam.examDate)}
                    {exam.examDate === today ? " · Bugün" : ""}
                  </span>
                </span>
                {exam.netPenalty ? (
                  <Badge tone="violet">
                    {exam.netPenalty === 3 ? "LGS" : "YKS"} denemesi
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-extrabold text-slate-800">
          Sonuçlar
        </h2>
        {results.length === 0 ? (
          <EmptyState
            title="Henüz sınav sonucu yok"
            description="Öğretmen sonuçları girdikçe burada görünür."
          />
        ) : (
          <div className="space-y-4">
            {results.map(exam => (
              <ExamResultCard key={exam.id} exam={exam} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ExamResultCard({ exam }: { exam: StudentExam }) {
  const unit = exam.netPenalty ? "net" : "puan";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[16px] font-extrabold tracking-[-.03em] text-slate-900">
            {exam.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {formatTrDate(exam.examDate)}
            {exam.className ? ` · ${exam.className}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[24px] font-extrabold tracking-[-.04em] text-slate-900">
            {exam.score !== null ? formatNumber(exam.score) : "—"}
            <span className="ml-1 text-[12px] font-semibold tracking-normal text-slate-500">
              {exam.maxScore && !exam.netPenalty
                ? `/ ${formatNumber(exam.maxScore)}`
                : unit}
            </span>
          </p>
          <p className="text-[11px] text-slate-500">
            {exam.classAverage !== null
              ? `Sınıf ortalaması ${formatNumber(exam.classAverage)} ${unit}`
              : "Sınıf ortalaması 3 sonuçtan sonra görünür"}
          </p>
        </div>
      </div>

      {exam.sections.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                <th className="py-2 pr-3">Ders</th>
                <th className="px-2 py-2 text-center">Doğru</th>
                <th className="px-2 py-2 text-center">Yanlış</th>
                <th className="px-2 py-2 text-center">Boş</th>
                <th className="px-2 py-2 text-right">Net</th>
                <th className="py-2 pl-2 text-right">Sınıf ort.</th>
              </tr>
            </thead>
            <tbody>
              {exam.sections.map(section => (
                <tr
                  key={section.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-2 pr-3 font-semibold text-slate-800">
                    {section.name}
                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                      {section.questionCount} soru
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {section.correct ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {section.wrong ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {section.correct !== null && section.wrong !== null
                      ? section.questionCount - section.correct - section.wrong
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-bold text-slate-900">
                    {section.net !== null ? formatNumber(section.net) : "—"}
                  </td>
                  <td className="py-2 pl-2 text-right text-slate-500">
                    {section.classAverage !== null
                      ? formatNumber(section.classAverage)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
