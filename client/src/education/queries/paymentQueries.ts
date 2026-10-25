// Ödeme planları, genel bakış sayıları ve taksitler.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  loadPaymentOverviewCounts,
  loadPayments,
  loadPlanInstallments,
  loadInstallmentsForPlans,
  type PaymentListResult,
  type PaymentOverviewCounts,
  type Installment,
} from "../paymentService";
import { educationKeys } from "./educationKeys";

export type UsePaymentsOptions = {
  organizationId?: string;
  limit?: number;
  studentId?: string;
  search?: string;
  enabled?: boolean;
};

/**
 * Aktif kurumun ödeme planlarını getiren React Query hook'u (v1.3-01 · E parçası).
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function usePayments(options?: UsePaymentsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<PaymentListResult, Error>({
    queryKey: organizationId
      ? educationKeys.payments(organizationId, {
          studentId: options?.studentId,
          search: options?.search,
        })
      : (["education", "payments", { organizationId: "" }] as const),
    queryFn: () =>
      loadPayments(organizationId!, {
        limit: options?.limit,
        studentId: options?.studentId,
        search: options?.search,
      }),
    enabled: isEnabled,
  });
}

export type UsePaymentOverviewOptions = {
  organizationId?: string;
  enabled?: boolean;
};

/**
 * Aktif kurumun ödeme genel bakış sayılarını getiren React Query hook'u (v1.3-01 · E parçası).
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function usePaymentOverview(options?: UsePaymentOverviewOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<PaymentOverviewCounts | null, Error>({
    queryKey: organizationId
      ? educationKeys.paymentOverview(organizationId)
      : (["education", "paymentOverview", { organizationId: "" }] as const),
    queryFn: () => loadPaymentOverviewCounts(),
    enabled: isEnabled,
  });
}

/** Birden çok planın taksitleri tek sorguda (veli ödeme görünümü). */
export function usePlansInstallments(options: {
  planIds: string[];
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options.organizationId ?? identity?.membership?.organizationId;
  const ids = [...options.planIds].sort();
  const isEnabled =
    (options.enabled ?? true) && Boolean(organizationId) && ids.length > 0;

  return useQuery<Map<string, Installment[]>, Error>({
    queryKey: [
      "education",
      "planInstallments",
      { organizationId: organizationId ?? "", planIds: ids },
    ] as const,
    queryFn: () => loadInstallmentsForPlans(organizationId as string, ids),
    enabled: isEnabled,
  });
}

export type UsePlanInstallmentsOptions = {
  organizationId?: string;
  planId?: string;
  enabled?: boolean;
};

/**
 * Bir ödeme planına ait aktif taksitleri getiren React Query hook'u (v1.4-06 · #277).
 */
export function usePlanInstallments(options?: UsePlanInstallmentsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const planId = options?.planId;
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && Boolean(planId);

  return useQuery<Installment[], Error>({
    queryKey:
      organizationId && planId
        ? educationKeys.planInstallments(organizationId, planId)
        : (["education", "planInstallments", { organizationId: "" }] as const),
    queryFn: () => loadPlanInstallments(organizationId!, planId!),
    enabled: isEnabled,
  });
}
