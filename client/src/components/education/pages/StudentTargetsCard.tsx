import { Target } from "lucide-react";
import { useStudentTargets } from "@/education/queries/trackingQueries";

const formatNet = (value: number) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/**
 * Öğrenci ve velinin gördüğü hedef net (4.10b). Hedefi yönetici ya da
 * öğretmen belirler; burada yalnız okunur. Hedef yoksa kart hiç görünmez.
 * Okunamazsa sessizce gizlenmez, kısa bir uyarı gösterilir.
 */
export function StudentTargetsCard({ studentId }: { studentId: string }) {
  const query = useStudentTargets(studentId);

  if (query.isPending) return null;
  if (query.isError) {
    return (
      <p role="alert" className="text-[12px] text-rose-600">
        Hedefler alınamadı: {query.error.message}
      </p>
    );
  }
  if (query.data.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold text-slate-800">
        <Target className="h-4 w-4 text-blue-600" aria-hidden />
        Hedef net
      </h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {query.data.map(target => (
          <span
            key={target.subjectId ?? "toplam"}
            className="rounded-lg bg-blue-50 px-3 py-1.5 text-[12px] text-blue-900"
          >
            <span className="font-bold">
              {target.subjectId ? target.subjectName : "Toplam"}
            </span>{" "}
            {formatNet(target.targetNet)} net
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Hedefi öğretmen ya da kurum belirler.
      </p>
    </section>
  );
}
