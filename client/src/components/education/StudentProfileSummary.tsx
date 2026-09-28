import { CircleAlert } from "lucide-react";
import {
  useStudentOverdueInstallments,
  useStudentOverview,
  useStudentUpcomingHomework,
} from "@/education/educationQueries";
import { formatTrDate } from "@/education/trDate";
import { StudentStats } from "./dashboards/StudentOverviewSections";
import { CardSkeleton, ErrorState } from "./shared";
import type { Role } from "./types";

/**
 * Öğrenci profilinin veri bölümü.
 *
 * Sayılar öğrencinin ve velinin Genel Bakış'ıyla **aynı fonksiyondan** gelir
 * (`student_overview_counts`, `student_upcoming_homework`). Yönetici profilde
 * ne görüyorsa veli de çocuğu için onu görür; iki ayrı hesap yok (K-06).
 * Yetki RLS'ten: öğretmen yalnız okuttuğu öğrencinin sayılarını alır.
 *
 * "Takip özeti" (veli, ödev tamamlama oranı, ödeme durumu) profilde ayrıca
 * duruyor; o satırlar liste satırından gelen gerçek veri (v1.4-15).
 */
export function StudentProfileSummary({
  studentId,
  role,
}: {
  studentId: string;
  role?: Role;
}) {
  const overviewQuery = useStudentOverview({ studentId });
  const homeworkQuery = useStudentUpcomingHomework({ studentId });
  // Ödeme yalnız yöneticiye (ve veliye) açık; öğretmende sorgu atılmaz.
  const overdueQuery = useStudentOverdueInstallments({
    studentId,
    enabled: role === "admin",
  });

  const alerts: string[] = [];
  if (overviewQuery.data?.homeworkMissed) {
    alerts.push(
      `${overviewQuery.data.homeworkMissed} ödev getirilmedi olarak işaretli`
    );
  }
  if (typeof overdueQuery.data === "number" && overdueQuery.data > 0) {
    alerts.push(`${overdueQuery.data} taksitin vadesi geçti`);
  }

  return (
    <>
      {overviewQuery.isPending ? (
        <CardSkeleton className="mt-6" />
      ) : overviewQuery.isError || !overviewQuery.data ? (
        <ErrorState
          className="mt-6"
          message="Öğrencinin özeti alınamadı."
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : (
        <StudentStats
          overview={overviewQuery.data}
          className="mt-6 grid grid-cols-2 gap-3"
        />
      )}

      {alerts.length > 0 ? (
        <section className="mt-4 space-y-2">
          {alerts.map(alert => (
            <p
              key={alert}
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
            >
              <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-[12px] font-bold text-amber-900">
                {alert}
              </span>
            </p>
          ))}
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-slate-200 p-4">
        <h3 className="text-[12px] font-extrabold text-slate-800">
          Yaklaşan ödevler
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-400">Önümüzdeki 7 gün</p>
        {homeworkQuery.isError ? (
          <p className="mt-2 text-[11px] text-rose-700">Ödevler alınamadı.</p>
        ) : homeworkQuery.data && homeworkQuery.data.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {homeworkQuery.data.map(item => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-slate-800">
                    {item.title}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {[item.subject, item.className].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-bold text-slate-600">
                  {formatTrDate(item.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        ) : homeworkQuery.data ? (
          <p className="mt-2 text-[11px] text-slate-400">
            Önümüzdeki 7 günde teslim edilecek ödev yok.
          </p>
        ) : null}
      </section>
    </>
  );
}
