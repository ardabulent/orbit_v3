import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, BookOpen, ChevronRight, Plus, Users } from "lucide-react";

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "blue" | "violet" | "rose";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  /**
   * Değerin altındaki açıklama satırı — **opsiyonel ve bilinçli olarak öyle.**
   *
   * Eskiden zorunluydu ve bunun bir bedeli oldu: `StudentDetail` gerçek bir
   * öğrencinin gerçek puanını `detail="TYT Deneme 06"` sabitiyle çizmişti,
   * çünkü kart bir alt metin İSTİYORDU ve elde doğrusu yoktu. Zorunlu bir
   * alan, doldurulamadığında uydurulur (**K-03**).
   *
   * Verilmezse satır hiç çizilmez.
   */
  detail?: string;
  icon: typeof Users;
  tone?: "blue" | "green" | "amber" | "violet" | "rose";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <section className="rounded-2xl border border-slate-200/85 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,.035)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold text-slate-500">{label}</p>
        <span
          className={`grid h-8 w-8 place-items-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 font-display text-[24px] font-extrabold tracking-[-.055em] text-slate-900">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-[10px] font-medium text-slate-400">{detail}</p>
      ) : null}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  actionKind = "create",
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
  actionKind?: "create" | "navigate";
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-blue-600">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-[26px] font-extrabold tracking-[-.05em] text-slate-950 sm:text-[31px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-slate-500">
          {description}
        </p>
      </div>
      {action && onAction ? (
        <button
          onClick={onAction}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[12px] font-bold text-white shadow-[0_8px_16px_rgba(15,23,42,.12)] transition hover:bg-slate-800 active:scale-[.98]"
        >
          {actionKind === "navigate" ? (
            <ArrowRight className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {action}
        </button>
      ) : null}
    </div>
  );
}

export function ActionLine({
  title,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  detail: string;
  icon: typeof BookOpen;
  tone: "blue" | "amber" | "violet" | "green" | "rose";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <span
        className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold text-slate-700">{title}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300" />
    </div>
  );
}

export function MessageListItem({
  name,
  detail,
  time,
  selected = false,
}: {
  name: string;
  detail: string;
  time: string;
  selected?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full text-[10px] font-extrabold ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
      >
        {name
          .split(" ")
          .map(word => word[0])
          .join("")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between gap-2">
          <strong className="truncate text-[11px] text-slate-800">
            {name}
          </strong>
          <small className="text-[9px] text-slate-400">{time}</small>
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">
          {detail}
        </span>
      </span>
    </button>
  );
}

/**
 * Çubuk grafik kartı. Varsayılan ölçek yüzdedir (0–100); ortalama net gibi
 * yüzde olmayan bir değer için `scaleMax` verilir ve `valueLabels` çubuğun
 * üstüne okunacak sayıyı yazar.
 */
export function ReportCard({
  title,
  subtitle,
  values,
  labels,
  color,
  scaleMax = 100,
  valueLabels,
}: {
  title: string;
  subtitle: string;
  values: (number | undefined)[];
  labels: string[];
  color: string;
  scaleMax?: number;
  valueLabels?: string[];
}) {
  const veriYok =
    values.length === 0 || values.every(value => value === undefined);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
      <h2 className="font-display text-[16px] font-extrabold text-slate-900">
        {title}
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
      {veriYok ? (
        <div className="mt-4">
          <EmptyState
            title="Rapor verisi henüz yok"
            description="Görüntülenecek analitik veri bulunmuyor."
          />
        </div>
      ) : (
        <div
          className={`mt-6 flex h-36 items-end justify-between ${values.length > 6 ? "gap-1" : "gap-3"}`}
        >
          {values.map((value, index) => (
            <div
              key={labels[index] ?? index}
              className="flex h-full flex-1 flex-col justify-end items-stretch"
            >
              {value === undefined ? (
                <span
                  data-testid="report-bar-unmeasured"
                  aria-label="Ölçülemedi"
                  className="w-full border-b border-dashed border-slate-300"
                />
              ) : value === 0 ? (
                <span
                  data-testid="report-bar-zero"
                  aria-label="%0"
                  className={`h-[2px] w-full rounded-sm ${color}`}
                />
              ) : (
                <>
                  {valueLabels?.[index] ? (
                    <span className="mb-1 text-center text-[10px] font-extrabold text-slate-700">
                      {valueLabels[index]}
                    </span>
                  ) : null}
                  <span
                    data-testid="report-bar-measured"
                    style={{
                      height: `${(Math.min(Math.max(value, 0), scaleMax) / scaleMax) * 100}%`,
                    }}
                    className={`w-full rounded-t-md ${color}`}
                  />
                </>
              )}
              <span className="mt-2 text-center text-[9px] font-bold text-slate-400 truncate">
                {labels[index]}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center">
      <p className="text-[12px] font-extrabold text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[11px] leading-5 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Yükleniyor…"
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,.025)]",
        className
      )}
    >
      <span className="sr-only">Yükleniyor…</span>
      <div className="space-y-4">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`th-${c}`} className="h-4 flex-1 bg-slate-100" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="flex items-center gap-4 py-2">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={`td-${r}-${c}`}
                className="h-4 flex-1 bg-slate-100"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Yükleniyor…"
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,.025)]",
        className
      )}
    >
      <span className="sr-only">Yükleniyor…</span>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48 max-w-full bg-slate-100" />
          <Skeleton className="h-3.5 w-32 max-w-full bg-slate-100" />
        </div>
        <Skeleton className="h-6 w-20 shrink-0 rounded-full bg-slate-100" />
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-full bg-slate-100" />
        <Skeleton className="h-4 w-3/4 bg-slate-100" />
      </div>
    </div>
  );
}

/**
 * Hata durumu — tek görünüm, tek yer (v1.3-02b).
 *
 * Öncesinde iki ayrı kurgu vardı: üç ekran `EmptyState` kullanıyordu, üç ekran
 * kendi pembe kutusunu çiziyordu. Aynı olgunun iki biçimde tutulması, birinin
 * eskimesi demekti (**K-06**).
 *
 * ⚠️ **`message` içine "sayfayı yenileyin" gibi bir yönerge yazma.** `onRetry`
 * verildiğinde o işi düğme yapıyor; metin de aynı şeyi söylerse kullanıcıya iki
 * farklı yol gösterilmiş olur ve biri gereksizdir. `message` yalnızca **sebebi**
 * taşır — kullanıcının okuyup karar vereceği şey odur.
 */
export function ErrorState({
  title = "Veriler görüntülenemedi",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 px-6 py-8 text-center",
        className
      )}
    >
      <p className="text-[12px] font-extrabold text-rose-900">{title}</p>
      {message ? (
        <p className="mt-1.5 max-w-md text-[11px] leading-5 text-rose-700">
          {message}
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,.08)] transition hover:bg-slate-800 active:scale-[.98]"
        >
          Tekrar dene
        </button>
      ) : null}
    </div>
  );
}
