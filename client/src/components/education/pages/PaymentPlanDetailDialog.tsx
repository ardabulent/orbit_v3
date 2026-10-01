import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  usePlanInstallments,
  educationKeys,
} from "@/education/educationQueries";
import {
  archivePaymentPlan,
  restorePaymentPlan,
  markInstallmentPaid,
  unmarkInstallmentPaid,
  formatCurrency,
  translatePaymentError,
  type Installment,
} from "@/education/paymentService";
import { formatTrDate, orbitLocalDate } from "@/education/trDate";
import { Badge, TableSkeleton, ErrorState, EmptyState } from "../shared";
import type { Role } from "../types";

export type PaymentPlanDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  role: Role;
  plan: {
    id: string;
    studentId?: string;
    studentName?: string;
    name: string;
    totalAmount?: number;
  } | null;
  onEditPlan?: (plan: {
    id: string;
    studentId: string;
    name: string;
    totalAmount: number;
  }) => void;
  onPlanArchived?: () => void;
};

export function PaymentPlanDetailDialog({
  open,
  onOpenChange,
  organizationId,
  role,
  plan,
  onEditPlan,
  onPlanArchived,
}: PaymentPlanDetailDialogProps) {
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const installmentsQuery = usePlanInstallments({
    organizationId,
    planId: plan?.id,
    enabled: Boolean(open && plan?.id && organizationId),
  });

  const installments = installmentsQuery.data ?? [];
  const planTotal = plan?.totalAmount ?? 0;
  const installmentsTotal = installments.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
  // Plan toplamı ile taksitlerin toplamı tutmadığında ekran bunu söyler (v1.4-06 #277)
  const hasDiscrepancy = Boolean(plan && planTotal !== installmentsTotal);
  const discrepancyAmount = Math.abs(planTotal - installmentsTotal);

  const handleArchivePlan = async () => {
    if (!plan || !organizationId || !isAdmin) return;

    const planId = plan.id;
    const planName = plan.name;

    try {
      await archivePaymentPlan(organizationId, planId);
      toast.success("Ödeme planı arşivlendi", {
        description: `"${planName}" planı arşive kaldırıldı.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void restorePaymentPlan(organizationId, planId)
              .then(async () => {
                toast.success("Plan geri yüklendi", {
                  description: `"${planName}" planı aktif duruma getirildi.`,
                });
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.payments(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.paymentOverview(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.students(organizationId),
                  }),
                ]);
              })
              .catch(err => {
                toast.error(translatePaymentError(err));
              });
          },
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.payments(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.paymentOverview(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);

      onOpenChange(false);
      onPlanArchived?.();
    } catch (err) {
      toast.error(translatePaymentError(err));
    }
  };

  const handleMarkPaid = async (inst: Installment) => {
    if (!plan || !organizationId || !isAdmin) return;

    try {
      await markInstallmentPaid(organizationId, inst.id);
      toast.success("Ödeme kaydedildi", {
        description: `${inst.sequenceNo}. taksit ödendi olarak işaretlendi.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void unmarkInstallmentPaid(organizationId, inst.id)
              .then(async () => {
                toast.success("Ödeme geri alındı", {
                  description: `${inst.sequenceNo}. taksit ödenmedi durumuna getirildi.`,
                });
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.planInstallments(
                      organizationId,
                      plan.id
                    ),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.payments(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.paymentOverview(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.students(organizationId),
                  }),
                ]);
              })
              .catch(err => {
                toast.error(translatePaymentError(err));
              });
          },
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.planInstallments(organizationId, plan.id),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.payments(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.paymentOverview(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translatePaymentError(err));
    }
  };

  const handleUnmarkPaid = async (inst: Installment) => {
    if (!plan || !organizationId || !isAdmin) return;

    const previousPaidAt = inst.paidAt;

    try {
      await unmarkInstallmentPaid(organizationId, inst.id);
      toast.success("Ödeme işareti geri alındı", {
        description: `${inst.sequenceNo}. taksit ödenmedi durumuna getirildi.`,
        action: {
          label: "Geri al",
          onClick: () => {
            void markInstallmentPaid(
              organizationId,
              inst.id,
              previousPaidAt ?? undefined
            )
              .then(async () => {
                toast.success("Ödeme tekrar işaretlendi", {
                  description: `${inst.sequenceNo}. taksit tekrar ödendi yapıldı.`,
                });
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.planInstallments(
                      organizationId,
                      plan.id
                    ),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.payments(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.paymentOverview(organizationId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: educationKeys.students(organizationId),
                  }),
                ]);
              })
              .catch(err => {
                toast.error(translatePaymentError(err));
              });
          },
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationKeys.planInstallments(organizationId, plan.id),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.payments(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.paymentOverview(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationKeys.students(organizationId),
        }),
      ]);
    } catch (err) {
      toast.error(translatePaymentError(err));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {plan?.name || "Ödeme Planı Detayı"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {plan?.studentName
                ? `${plan.studentName} için tanımlı taksitler ve ödeme takvimi.`
                : "Plan taksitleri ve ödeme takvimi."}
            </DialogDescription>
          </DialogHeader>

          {/* Özet ve Bilgilendirme Alanı */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">
                Plan Toplamı
              </p>
              <p className="text-base font-extrabold text-slate-900">
                {formatCurrency(planTotal)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">
                Taksitler Toplamı
              </p>
              <p className="text-base font-extrabold text-slate-900">
                {formatCurrency(installmentsTotal)}
              </p>
            </div>
          </div>

          {/* Plan toplamı ile taksit toplamı tutmadığında gösterilen bilgi alanı (K-06 & #277) */}
          {hasDiscrepancy && (
            <div
              data-testid="payment-plan-discrepancy-warning"
              className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs font-semibold text-amber-800"
            >
              Plan toplamı ({formatCurrency(planTotal)}) ile taksitlerin toplamı
              ({formatCurrency(installmentsTotal)}) uyuşmuyor. Fark:{" "}
              {formatCurrency(discrepancyAmount)}.
            </div>
          )}

          {/* Admin eylemleri: plan ve taksitler tek ekranda düzenlenir (2026-09-30) */}
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 pt-1">
              <div className="flex items-center gap-2">
                {onEditPlan && plan?.studentId && (
                  <button
                    type="button"
                    onClick={() => {
                      onEditPlan({
                        id: plan.id,
                        studentId: plan.studentId!,
                        name: plan.name,
                        totalAmount: planTotal,
                      });
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Planı ve taksitleri düzenle
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleArchivePlan()}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  Planı Arşivle
                </button>
              </div>
            </div>
          )}

          {/* Taksitler Tablosu */}
          <div className="mt-1">
            {installmentsQuery.isLoading ? (
              <TableSkeleton rows={3} columns={4} />
            ) : installmentsQuery.error ? (
              <ErrorState
                title="Taksitler yüklenemedi"
                message={installmentsQuery.error.message}
                onRetry={() => void installmentsQuery.refetch()}
              />
            ) : installments.length === 0 ? (
              <EmptyState
                title="Henüz taksit eklenmemiş"
                description={
                  isAdmin
                    ? "Ödeme planına taksit eklemek için yukarıdaki '+ Taksit Ekle' butonunu kullanabilirsiniz."
                    : "Bu plana ait girilmiş bir taksit bulunmuyor."
                }
              />
            ) : (
              <div className="max-h-[320px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">
                      <th className="px-3 py-2.5">Sıra</th>
                      <th className="px-3 py-2.5">Vade Tarihi</th>
                      <th className="px-3 py-2.5">Tutar</th>
                      <th className="px-3 py-2.5">Durum</th>
                      {isAdmin && (
                        <th className="px-3 py-2.5 text-right">İşlemler</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map(inst => {
                      const isPaid = Boolean(inst.paidAt);
                      return (
                        <tr
                          key={inst.id}
                          className="border-b border-slate-100 text-xs last:border-0 hover:bg-slate-50/50"
                        >
                          <td className="px-3 py-2.5 font-bold text-slate-700">
                            #{inst.sequenceNo}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-600">
                            {formatTrDate(inst.dueDate)}
                          </td>
                          <td className="px-3 py-2.5 font-extrabold text-slate-800">
                            {formatCurrency(inst.amount)}
                          </td>
                          <td className="px-3 py-2.5">
                            {isPaid ? (
                              <Badge tone="green">
                                Ödendi (
                                {formatTrDate(orbitLocalDate(inst.paidAt))})
                              </Badge>
                            ) : (
                              <Badge tone="amber">Bekliyor</Badge>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPaid ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleUnmarkPaid(inst)}
                                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                                  >
                                    Ödemeyi Geri Al
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleMarkPaid(inst)}
                                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                                  >
                                    Ödendi İşaretle
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
