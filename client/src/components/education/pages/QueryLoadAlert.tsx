import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Bir pencerenin ihtiyaç duyduğu liste okunamadığında gösterilir
 * (2026-10-11, tarama turu).
 *
 * Önceden okunamayan liste boş liste gibi çiziliyordu: "Yeni öğrenci"de veli
 * listesi alınamazsa ekran "veli yok" diyor, aynı veli ikinci kez açılabiliyordu.
 * Bu uyarı görünürken çağıran pencere kaydı da engeller.
 */
export function QueryLoadAlert({
  what,
  onRetry,
}: {
  /** Okunamayan şeyin adı, ör. "Veli listesi". */
  what: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1">
        <strong>{what} alınamadı.</strong> Liste okunamadığı için boş
        görünebilir; kaydetmeden önce tekrar deneyin.
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 font-bold text-amber-900 underline-offset-2 hover:underline"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Tekrar dene
        </button>
      ) : null}
    </div>
  );
}
