import { lazy, Suspense, useState } from "react";
import { isDemoMode } from "@/auth/runtime";
import type { Criterion } from "@/education/tracking/trackingMetrics";
import { formatTrWeekLabel, getOrbitToday } from "@/education/trDate";
import type {
  AttentionStudent,
  AttendanceWeek,
  ClassComparisonRow,
  ExamAverage,
  HomeworkWeek,
  ReportRange,
} from "@/education/reportService";
import {
  demoReportActions,
  demoReportAttendanceValues,
  demoReportExamLabels,
  demoReportExamValues,
  demoReportHomeworkLabels,
  demoReportHomeworkValues,
} from "../demoData";
import {
  ActionLine,
  CardSkeleton,
  ErrorState,
  PageHeader,
  ReportCard,
} from "../shared";
import type { Role } from "../types";
import { AttentionList } from "./AttentionList";
import { ClassComparisonTable } from "./ClassComparisonTable";
import { ReportsToolbar } from "./ReportsToolbar";

// Takip ayrı parça: Genel bakışı açan kullanıcı Takip kodunu indirmez.
const TrackingTab = lazy(() =>
  import("./tracking/TrackingTab").then(m => ({ default: m.TrackingTab }))
);

export type ReportsPageProps = {
  role: Role;
  isDemo?: boolean;
  attendanceWeeks?: AttendanceWeek[] | null;
  examAverages?: ExamAverage[] | null;
  homeworkWeeks?: HomeworkWeek[] | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  /** Süzgeç: verilmezse (demo) çubuk gösterilmez. */
  range?: ReportRange;
  onRangeChange?: (range: ReportRange) => void;
  classes?: { id: string; name: string }[];
  comparison?: {
    rows: ClassComparisonRow[] | undefined;
    isLoading: boolean;
    error: Error | null;
  };
  attention?: {
    rows: AttentionStudent[] | undefined;
    isLoading: boolean;
    error: Error | null;
  };
  onOpenStudent?: (studentId: string) => void;
  /** Takip sekmesindeki öğrenci arama listesi (görünür öğrenciler). */
  students?: { id: string; name: string; group: string | null }[];
};

type ReportsView = "overview" | "tracking";

const formatNet = (value: number) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

// Deneme adları çoğu zaman aynı başlar ("TYT Deneme 1/2"); kısaltılınca
// ayırt edilemiyor. Çubuğun altına sınavın tarihi yazılır.
const examLabel = (exam: ExamAverage) => formatTrWeekLabel(exam.examDate);

/**
 * Derleme anında belli olan demo bayrağı (2026-10-17, Hız 2). Ayrıntı ve
 * gerekçe: `educationData.ts`'teki aynı adlı sabit. Kapı:
 * `scripts/check-demo-leak.mjs`.
 */
const DEMO_BUILD =
  typeof __ORBIT_DEMO_MODE__ === "boolean" ? __ORBIT_DEMO_MODE__ : isDemoMode;

export function ReportsPage({
  role,
  isDemo = isDemoMode,
  attendanceWeeks,
  examAverages,
  homeworkWeeks,
  isLoading = false,
  error = null,
  onRetry,
  range,
  onRangeChange,
  classes = [],
  comparison,
  attention,
  onOpenStudent,
  students = [],
}: ReportsPageProps) {
  const isTeacher = role === "teacher";
  const activeDemo = DEMO_BUILD && isDemo;
  const [view, setView] = useState<ReportsView>("overview");
  const [trackingCriterion, setTrackingCriterion] = useState<
    Criterion | undefined
  >(undefined);

  // Hafta aralığı alt başlığı: her iki haftalık fonksiyon (devam ve ödev)
  // aynı 4 takvim haftasını ölçer (v1.4-16 · #278 / K-06).
  const referenceWeeks = attendanceWeeks ?? homeworkWeeks;
  const weekSubtitle =
    !activeDemo && referenceWeeks && referenceWeeks.length > 0
      ? `${formatTrWeekLabel(referenceWeeks[0].weekStart)} – ${formatTrWeekLabel(
          referenceWeeks[referenceWeeks.length - 1].weekStart
        )} haftaları`
      : `Son ${range?.weeks ?? 4} takvim haftası`;

  const allLabel = isTeacher ? "Bütün sınıflarım" : "Bütün kurum";
  const scopeLabel = range?.classId
    ? (classes.find(c => c.id === range.classId)?.name ?? "Seçili sınıf")
    : isTeacher
      ? "Sınıflarınızın ortalaması"
      : "Kurum ortalaması";

  // 1. Devam görünümü
  const attendanceValues: (number | undefined)[] = activeDemo
    ? demoReportAttendanceValues
    : attendanceWeeks
      ? attendanceWeeks.map(w => w.attendancePercent)
      : [];
  const attendanceLabels: string[] = activeDemo
    ? ["1. hf", "2. hf", "3. hf", "Bu hf"]
    : attendanceWeeks
      ? attendanceWeeks.map(w => formatTrWeekLabel(w.weekStart))
      : [];

  // 2. Deneme gelişimi (2026-09-29): net denemeler ortalama netle, puanlı
  //    sınavlar ayrı kartta yüzdeyle — ikisi aynı grafikte karışmaz.
  const netExams = (examAverages ?? []).filter(e => e.isNet);
  const scoredExams = (examAverages ?? []).filter(e => !e.isNet);
  const examValues: (number | undefined)[] = activeDemo
    ? demoReportExamValues
    : netExams.map(e => e.averageNet);
  const examLabels: string[] = activeDemo
    ? demoReportExamLabels
    : netExams.map(examLabel);
  const netMax = Math.max(...netExams.map(e => e.averageNet ?? 0), 1);
  const examSubtitle = activeDemo
    ? scopeLabel
    : `Son ${range?.weeks ?? 4} deneme · ortalama net · ${scopeLabel}`;

  // 3. Ödev tamamlama
  const homeworkValues: (number | undefined)[] = activeDemo
    ? demoReportHomeworkValues
    : homeworkWeeks
      ? homeworkWeeks.map(w => w.completionPercent)
      : [];
  const homeworkLabels: string[] = activeDemo
    ? demoReportHomeworkLabels
    : homeworkWeeks
      ? homeworkWeeks.map(w => formatTrWeekLabel(w.weekStart))
      : [];

  const actions = activeDemo ? demoReportActions : [];

  return (
    <>
      <PageHeader
        eyebrow={isTeacher ? "Akademik içgörüler" : "Kurum içgörüleri"}
        title={isTeacher ? "Sınıf raporları" : "Kurum raporları"}
        description={
          isTeacher
            ? "Sınıflarınızın devam, deneme ve ödev tamamlama görünümünü izleyin."
            : "Akademik, devam ve operasyon görünümünü karar vermeyi kolaylaştıracak şekilde izleyin."
        }
      />
      <div
        role="tablist"
        aria-label="Rapor görünümü"
        className="mt-4 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1"
      >
        {(
          [
            ["overview", "Genel bakış"],
            ["tracking", "Takip"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => {
              setView(value);
              if (value === "overview") setTrackingCriterion(undefined);
            }}
            className={`rounded-lg px-4 py-1.5 text-[12px] font-bold transition ${
              view === value
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "tracking" ? (
        <Suspense
          fallback={
            <div className="mt-6">
              <CardSkeleton />
            </div>
          }
        >
          <TrackingTab
            role={role}
            isDemo={isDemo}
            classes={classes}
            students={students}
            onOpenStudent={onOpenStudent}
            initialCriterion={trackingCriterion}
          />
        </Suspense>
      ) : (
        <>
          {!activeDemo && range && onRangeChange ? (
            <ReportsToolbar
              classes={classes}
              range={range}
              onRangeChange={onRangeChange}
              allLabel={allLabel}
            />
          ) : null}
          {error ? (
            <ErrorState
              className="mt-6"
              title="Raporlar görüntülenemedi"
              message={
                error.message || "Rapor verileri yüklenirken bir hata oluştu."
              }
              onRetry={onRetry}
            />
          ) : isLoading ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <ReportCard
                title="Devam görünümü"
                subtitle={weekSubtitle}
                values={attendanceValues}
                labels={attendanceLabels}
                color="bg-emerald-500"
              />
              <ReportCard
                title="Deneme gelişimi"
                subtitle={examSubtitle}
                values={examValues}
                labels={examLabels}
                color="bg-violet-500"
                {...(activeDemo
                  ? {}
                  : {
                      scaleMax: netMax * 1.15,
                      valueLabels: netExams.map(e =>
                        e.averageNet !== undefined
                          ? formatNet(e.averageNet)
                          : ""
                      ),
                    })}
              />
              <ReportCard
                title="Ödev tamamlama"
                subtitle={weekSubtitle}
                values={homeworkValues}
                labels={homeworkLabels}
                color="bg-blue-500"
              />
              {scoredExams.length > 0 ? (
                <ReportCard
                  title="Puanlı sınavlar"
                  subtitle={`Son ${range?.weeks ?? 4} sınav · başarı yüzdesi · ${scopeLabel}`}
                  values={scoredExams.map(e => e.averagePercent)}
                  labels={scoredExams.map(examLabel)}
                  valueLabels={scoredExams.map(e =>
                    e.averagePercent !== undefined
                      ? `%${formatNet(e.averagePercent)}`
                      : ""
                  )}
                  color="bg-amber-500"
                />
              ) : null}
            </div>
          )}
          {!activeDemo && range && attention && onOpenStudent && !error ? (
            <AttentionList
              rows={attention.rows}
              isLoading={attention.isLoading}
              error={attention.error}
              weeks={range.weeks}
              onOpenStudent={onOpenStudent}
              onOpenTracking={() => {
                setTrackingCriterion("overall");
                setView("tracking");
              }}
            />
          ) : null}
          {!activeDemo && range && onRangeChange && comparison && !error ? (
            <ClassComparisonTable
              rows={comparison.rows}
              isLoading={comparison.isLoading}
              error={comparison.error}
              weeks={range.weeks}
              selectedClassId={range.classId}
              onSelectClass={classId => onRangeChange({ ...range, classId })}
              today={getOrbitToday()}
            />
          ) : null}
          {actions.length > 0 ? (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
              <h2 className="font-display text-[17px] font-extrabold text-slate-900">
                Raporu aksiyona dönüştür
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Raporlar yalnızca izleme için değil, eğitim ekibinin bir sonraki
                adımını netleştirmek için kullanılmalıdır.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {actions.map(action => (
                  <ActionLine
                    key={action.title}
                    title={action.title}
                    detail={action.detail}
                    icon={action.icon}
                    tone={action.tone}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
