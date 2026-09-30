import { useState } from "react";
import { EXAM_TEMPLATES } from "@/education/examNetService";
import { EmptyState } from "../shared";

/**
 * Dersi olmayan bir net denemede sonuç alanının boş durumu (2026-09-30).
 *
 * Önceden yalnız "Sınavı düzenleyip ders ekleyin" yazıyordu; sonuç girişine
 * giden yol çıkmaz sokaktı ve kullanıcı sekmeyi "yalnız sınav duyurusu
 * giriliyor" diye okudu. Artık sınavın ceza kuralına uyan şablonlar tek
 * tıkla eklenir, ardından sonuç tablosu açılır.
 */
export function ExamSectionsQuickStart({
  netPenalty,
  canEdit,
  onApply,
}: {
  netPenalty: number;
  canEdit: boolean;
  onApply: (
    sections: { name: string; questionCount: number }[]
  ) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const templates = EXAM_TEMPLATES.filter(t => t.penalty === netPenalty);

  if (!canEdit)
    return (
      <EmptyState
        title="Bu denemenin dersleri henüz girilmedi"
        description="Dersler girildiğinde sonuçlar burada görünecek."
      />
    );

  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
      <p className="text-[13px] font-extrabold text-slate-800">
        Sonuç girmek için önce denemenin derslerini seçin
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Hazır şablonlardan birine tıklayın; dersler ve soru sayıları eklenir,
        sonuç tablosu açılır. Farklı bir düzen için sınavı düzenleyip dersleri
        elle girebilirsiniz.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {templates.map(template => (
          <button
            key={template.label}
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(template.label);
              setError(null);
              try {
                await onApply(template.sections);
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Dersler eklenemedi."
                );
              } finally {
                setBusy(null);
              }
            }}
            className="rounded-lg border border-blue-200 bg-white px-3 py-2 hover:bg-blue-50 disabled:opacity-50"
          >
            <span className="block text-[12px] font-bold text-blue-700">
              {busy === template.label ? "Ekleniyor…" : template.label}
            </span>
            <span className="block text-[10px] text-slate-500">
              {template.sections.map(s => s.name).join(" · ")}
            </span>
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[12px] font-bold text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
