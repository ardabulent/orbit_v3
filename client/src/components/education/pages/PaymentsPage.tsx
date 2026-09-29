import * as React from "react";
import { toast } from "sonner";
import { isDemoMode } from "@/auth/runtime";
import {
  DEFAULT_PAYMENT_LIMIT,
  type Installment,
} from "@/education/paymentService";
import { getOrbitToday } from "@/education/trDate";
import {
  paymentOverviewStats as demoPaymentOverviewStats,
  paymentRows as demoPaymentRows,
  type OverviewStat,
} from "../educationData";
import { filterPaymentsForRole } from "../scopeFilters";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  StatCard,
  TableSkeleton,
} from "../shared";
import type { PaymentRow, Role } from "../types";
import { AdminPaymentsTable } from "./AdminPaymentsTable";
import { ParentPaymentCards } from "./ParentPaymentCards";

export type PaymentsPageProps = {
  role: Role;
  paymentRows?: PaymentRow[];
  overviewStats?: OverviewStat[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  truncated?: boolean;
  limit?: number;
  isDemo?: boolean;
  onAddPlan?: () => void;
  onSelectPlan?: (plan: PaymentRow) => void;
  /** Veli görünümü: planların taksitleri (tek sorguda, yukarıdan). */
  installments?: Map<string, Installment[]>;
  installmentsError?: boolean;
};

export function PaymentsPage({
  role,
  paymentRows: propPaymentRows,
  overviewStats: propOverviewStats,
  isLoading = false,
  error = null,
  onRetry,
  truncated = false,
  limit = DEFAULT_PAYMENT_LIMIT,
  isDemo = isDemoMode,
  onAddPlan,
  onSelectPlan,
  installments,
  installmentsError = false,
}: PaymentsPageProps) {
  // Güvenlik kapısı (K-06): isDemo prop'u üretimde (isDemoMode === false) demoyu AÇAMAZ.
  // Prop yalnızca test ortamında veya demo modunda demoyu KAPATMAK (isDemo={false}) için kullanılabilir.
  const activeDemo = isDemoMode && isDemo;

  const visible = activeDemo
    ? filterPaymentsForRole(demoPaymentRows, role, true)
    : filterPaymentsForRole(propPaymentRows ?? [], role, false);

  const stats = activeDemo
    ? demoPaymentOverviewStats
    : (propOverviewStats ?? []);

  return (
    <>
      <PageHeader
        eyebrow={role === "parent" ? "Veli ödeme alanı" : "Kayıt operasyonu"}
        title={role === "parent" ? "Kayıt ve ödeme planı" : "Kayıt ve ödemeler"}
        description={
          role === "parent"
            ? "Kayıt paketleri ve yaklaşan taksit detaylarını takip edin."
            : "Kayıt paketleri, taksit planları ve takip gerektiren ödemeler."
        }
        action={
          role === "admin"
            ? activeDemo
              ? "Yeni kayıt"
              : onAddPlan
                ? "Yeni plan"
                : undefined
            : undefined
        }
        onAction={
          role === "admin"
            ? activeDemo
              ? () =>
                  toast.info("Yeni kayıt", {
                    description:
                      "Demo MVP’de kayıt paketleri ve taksit planı yerel veri ile sonraki iterasyonda oluşturulabilir.",
                  })
              : onAddPlan
            : undefined
        }
      />

      {role === "admin" && stats.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {stats.map(stat => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              detail={stat.detail}
              icon={stat.icon}
              tone={stat.tone}
            />
          ))}
        </div>
      ) : null}

      {truncated ? (
        <div
          data-testid="payments-truncated-banner"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[11px] font-semibold text-amber-800"
        >
          Liste üst sınıra ({limit} kayıt) ulaştı. Kalan kayıtları görmek için
          filtreleri kullanın.
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} className="mt-6" />
      ) : error ? (
        <ErrorState
          className="mt-6"
          title="Ödeme bilgileri görüntülenemedi"
          message={
            error.message || "Ödeme bilgileri yüklenirken bir hata oluştu."
          }
          onRetry={onRetry}
        />
      ) : !activeDemo && role === "parent" ? (
        // 2026-09-29: veli her planı kart olarak, bütün taksitleriyle görür.
        <ParentPaymentCards
          rows={visible}
          installments={installments ?? new Map()}
          installmentsError={installmentsError}
          today={getOrbitToday()}
        />
      ) : !activeDemo ? (
        // 2026-09-29: süzgeç, arama, ödenen/kalan ilerlemesi.
        <AdminPaymentsTable
          rows={visible}
          today={getOrbitToday()}
          onSelectPlan={onSelectPlan}
        />
      ) : (
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,.025)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">
                  <th className="px-5 py-3.5">Öğrenci</th>
                  <th className="px-5 py-3.5">Kayıt paketi</th>
                  <th className="px-5 py-3.5">Sonraki taksit</th>
                  <th className="px-5 py-3.5">Tutar</th>
                  <th className="px-5 py-3.5">Durum</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr key="empty-payments">
                    <td colSpan={6} className="p-4">
                      <EmptyState title="Gösterilecek ödeme kaydı yok" />
                    </td>
                  </tr>
                ) : null}
                {visible.map((item, index) => (
                  <tr
                    key={`${item.student}-${item.plan}-${index}`}
                    className="border-b border-slate-100 text-[12px] last:border-0"
                  >
                    <td className="px-5 py-4 font-extrabold text-slate-800">
                      {item.student}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.plan}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">
                      {item.due}
                    </td>
                    <td className="px-5 py-4 font-extrabold text-slate-800">
                      {item.amount}
                    </td>
                    <td className="px-5 py-4">
                      {item.status ? (
                        <Badge
                          tone={
                            item.status === "Güncel"
                              ? "green"
                              : item.status === "Gecikme riski"
                                ? "rose"
                                : "amber"
                          }
                        >
                          {item.status}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onSelectPlan ? (
                          <button
                            type="button"
                            onClick={() => onSelectPlan(item)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                          >
                            Detay
                          </button>
                        ) : null}
                        {activeDemo &&
                        role === "admin" &&
                        item.status !== "Güncel" ? (
                          <button
                            type="button"
                            onClick={() =>
                              toast.info(
                                "Ödeme hatırlatması henüz aktif değil",
                                {
                                  description:
                                    "Hatırlatma gönderimi e-posta sağlayıcısı kurulduğunda çalışacaktır; şu an bir kayıt oluşturulmadı.",
                                }
                              )
                            }
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                          >
                            Hatırlat
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-[10px] leading-5 text-blue-800">
        <strong>Not:</strong>{" "}
        {role === "admin"
          ? "Bu alan eğitim kurumu tahsilat operasyonunu takip eder; resmi muhasebe veya e-Fatura kaydı oluşturmaz."
          : "Bu alan öğrencinizin kayıt ve taksit ödeme planını gösterir; ödemeleriniz kurum muhasebesi tarafından işlenir."}
      </p>
    </>
  );
}
