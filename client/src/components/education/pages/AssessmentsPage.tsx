import { useState } from "react";
import { isDemoMode } from "@/auth/runtime";
import type { ExamListItem } from "@/education/examNetService";
import type { LatestExamDetail } from "@/education/examService";
import { getOrbitToday } from "@/education/trDate";
import { CardSkeleton, ErrorState, PageHeader } from "../shared";
import { ExamDetailView, type ExamDetailViewProps } from "./ExamDetailView";
import { ExamFormDialog } from "./ExamFormDialog";
import { ExamList } from "./ExamList";
import { StudentExamsView } from "./StudentExamsView";

export type AssessmentsPageProps = ExamDetailViewProps & {
  /**
   * Yönetici/öğretmen için sınav listesi (C-07). `isLoading`, `error` ve
   * `onRetry` bu rollerde listenin durumudur.
   */
  exams?: ExamListItem[];
  examsTruncated?: boolean;
};

function toDetail(exam: ExamListItem): LatestExamDetail {
  return {
    id: exam.id,
    name: exam.name,
    examDate: exam.examDate,
    maxScore: exam.maxScore,
    classId: exam.classId ?? undefined,
    className: exam.className,
    participantCount: exam.resultCount,
    netPenalty: exam.netPenalty,
  };
}

/**
 * Sınavlar (karar 2026-09-28, C-07).
 *
 * Yönetici ve öğretmen: yaklaşan/geçmiş sınav listesi (sınıf süzgeçli);
 * sınava tıklayınca detay — tek puanlı sınavda puan tablosu, netli sınavda
 * ders ders doğru/yanlış. "Yeni sınav" yalnız sayfa başlığında; eskiden bir
 * sınavın düğmeleri arasında durup o sınava aitmiş gibi görünüyordu.
 *
 * Öğrenci ve veli: yaklaşan sınavlar ve sonuçlar (`StudentExamsView`).
 * Demo: son sınavın görünümü.
 */
export function AssessmentsPage(props: AssessmentsPageProps) {
  const {
    role,
    exams = [],
    examsTruncated = false,
    isLoading = false,
    error = null,
    onRetry,
    isDemo = isDemoMode,
    organizationId = "",
    classes = [],
    onSaved,
  } = props;
  const activeDemo = isDemoMode && isDemo;
  const isStaff = role === "admin" || role === "teacher";
  const [selected, setSelected] = useState<LatestExamDetail | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [classFilter, setClassFilter] = useState("");

  if (activeDemo) return <ExamDetailView {...props} />;
  // Öğrenci ve veli: kendi sınavları, netleri ve sınıf ortalaması.
  if (!isStaff) return <StudentExamsView role={role} />;

  const today = getOrbitToday();
  const shown = classFilter
    ? exams.filter(exam => exam.classId === classFilter)
    : exams;

  return (
    <>
      <PageHeader
        eyebrow="Ölçme ve değerlendirme"
        title="Sınavlar ve başarı"
        description="Yaklaşan ve geçmiş sınavlar; sonuçlar ders ders net ya da tek puan olarak girilir."
        action="Yeni sınav"
        onAction={() => setCreateOpen(true)}
      />

      {selected ? (
        <ExamDetailView
          {...props}
          key={selected.id}
          exam={selected}
          embedded
          onBack={() => setSelected(null)}
        />
      ) : isLoading ? (
        <CardSkeleton className="mt-6" />
      ) : error ? (
        <ErrorState
          className="mt-6"
          title="Sınav bilgileri görüntülenemedi"
          message={
            error.message || "Sınav bilgileri yüklenirken bir hata oluştu."
          }
          onRetry={onRetry}
        />
      ) : (
        <div className="mt-6">
          {classes.length > 1 ? (
            <label className="mb-4 flex items-center gap-2 text-[11px] font-bold text-slate-500">
              Sınıf
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-800"
              >
                <option value="">Tümü</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {examsTruncated ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              Liste üst sınıra ulaştı; en eski sınavlar gösterilmiyor.
            </p>
          ) : null}
          <ExamList
            rows={shown}
            today={today}
            onOpen={exam => setSelected(toDetail(exam))}
            classStudentCounts={
              new Map((classes ?? []).map(c => [c.id, c.studentCount]))
            }
          />
        </div>
      )}

      <ExamFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={organizationId}
        classes={classes}
        onDone={exam => {
          void onSaved?.();
          setSelected(exam);
        }}
      />
    </>
  );
}
