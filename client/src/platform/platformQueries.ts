import {
  loadClientErrorReports,
  type ClientErrorReportPage,
} from "@/errorReporting/errorReportService";
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  DEFAULT_OPERATOR_LIMIT,
  DEFAULT_ORGANIZATION_LIMIT,
  DEFAULT_PLATFORM_AUDIT_LIMIT,
  loadAuditEvents,
  loadOperators,
  loadOrganizations,
  loadOrganizationStats,
  type AuditPage,
  type OperatorListResult,
  type OrganizationListResult,
  type OrganizationStats,
  type PlatformAuditEvent,
} from "./platformService";

/**
 * Platform alanı sorgu anahtarları (v1.3-02 · a parçası, **K-19** / mimari kararlar).
 *
 * **Anahtar sözleşmesi:** `[alan, kaynak, kapsam]`
 *
 * - Platform geneli kaynaklar `{ scope: "platform" }` kapsamını taşır.
 *   Operatör zaten kurumlar üstü tüm kayıtları görmeye yetkilidir. Çıkışta
 *   önbellek `clearIdentity` içinde tamamen temizlenir (`identityRace.test.ts`).
 *
 * - Kurum istatistikleri `{ organizationId }` kapsamını taşır (**K-19** / izolasyon).
 *   Operatör kurumlar arasında gezerken farklı kurumların istatistiklerinin birbirine
 *   karışması (cache collision) engellenir.
 *
 * Anahtar üreticisi `organizationId: string` parametresini zorunlu kılarak
 * kurumsuz anahtar oluşturulmasını derleme zamanında (TypeScript) engeller.
 */
export const platformKeys = {
  all: ["platform"] as const,
  organizations: () =>
    ["platform", "organizations", { scope: "platform" }] as const,
  operators: () => ["platform", "operators", { scope: "platform" }] as const,
  auditEvents: () =>
    ["platform", "auditEvents", { scope: "platform" }] as const,
  errorReports: () => ["platform", "errorReports"] as const,
  organizationStats: (organizationId: string) =>
    ["platform", "organizationStats", { organizationId }] as const,
};

export type UsePlatformOrganizationsOptions = {
  enabled?: boolean;
  limit?: number;
};

/**
 * Platformdaki kurumların listesini getiren React Query hook'u.
 *
 * Operatör yetkisi `useAuth` üzerinden doğrulanır; operatör olmayan kullanıcılar
 * için sorgu çalıştırılmaz (`enabled: false`).
 */
export function usePlatformOrganizations(
  options?: UsePlatformOrganizationsOptions
) {
  const { identity } = useAuth();
  const isOperator = Boolean(identity?.platformOperator);
  const isEnabled = (options?.enabled ?? true) && isOperator;
  const limit = options?.limit ?? DEFAULT_ORGANIZATION_LIMIT;

  return useQuery<OrganizationListResult, Error>({
    queryKey: platformKeys.organizations(),
    queryFn: () => loadOrganizations(limit),
    enabled: isEnabled,
  });
}

export type UsePlatformOperatorsOptions = {
  enabled?: boolean;
  limit?: number;
};

/**
 * Platformdaki operatörlerin listesini getiren React Query hook'u.
 *
 * Operatör yetkisi `useAuth` üzerinden doğrulanır; operatör olmayan kullanıcılar
 * için sorgu çalıştırılmaz (`enabled: false`).
 */
export function usePlatformOperators(options?: UsePlatformOperatorsOptions) {
  const { identity } = useAuth();
  const isOperator = Boolean(identity?.platformOperator);
  const isEnabled = (options?.enabled ?? true) && isOperator;
  const limit = options?.limit ?? DEFAULT_OPERATOR_LIMIT;

  return useQuery<OperatorListResult, Error>({
    queryKey: platformKeys.operators(),
    queryFn: () => loadOperators(limit),
    enabled: isEnabled,
  });
}

export type UsePlatformAuditEventsOptions = {
  enabled?: boolean;
  limit?: number;
};

/**
 * Platform genel denetim kayıtlarını getiren React Query hook'u.
 *
 * Operatör yetkisi `useAuth` üzerinden doğrulanır; operatör olmayan kullanıcılar
 * için sorgu çalıştırılmaz (`enabled: false`).
 */
export function usePlatformAuditEvents(
  options?: UsePlatformAuditEventsOptions
) {
  const { identity } = useAuth();
  const isOperator = Boolean(identity?.platformOperator);
  const isEnabled = (options?.enabled ?? true) && isOperator;
  const limit = options?.limit ?? DEFAULT_PLATFORM_AUDIT_LIMIT;

  return useInfiniteQuery<
    AuditPage<PlatformAuditEvent>,
    Error,
    InfiniteData<AuditPage<PlatformAuditEvent>, number | null>,
    readonly [string, string, { readonly scope: "platform" }],
    number | null
  >({
    queryKey: platformKeys.auditEvents(),
    queryFn: ({ pageParam }) => loadAuditEvents(limit, pageParam),
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: isEnabled,
  });
}

export type UseOrganizationStatsOptions = {
  enabled?: boolean;
};

/**
 * Belirli bir kurumun yapısal sayılarını getiren React Query hook'u.
 *
 * Kurum kimliği sağlanmamışsa veya kullanıcı operatör değilse sorgu çalıştırılmaz (`enabled: false`).
 * Kuruma özgü anahtarlama sayesinde farklı kurumlar arasında gezinirken sayıların karışması önlenir.
 */
export function useOrganizationStats(
  organizationId?: string,
  options?: UseOrganizationStatsOptions
) {
  const { identity } = useAuth();
  const isOperator = Boolean(identity?.platformOperator);
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && isOperator;

  return useQuery<OrganizationStats | null, Error>({
    queryKey: organizationId
      ? platformKeys.organizationStats(organizationId)
      : (["platform", "organizationStats", { organizationId: "" }] as const),
    queryFn: () => loadOrganizationStats(organizationId!),
    enabled: isEnabled,
  });
}

/** Hata kayıtları sayfa boyu (2026-10-05, v1.5-06). */
export const ERROR_REPORT_PAGE_SIZE = 50;

/**
 * Ekran hata kayıtları. Yalnız operatörde ve sekme açıkken çalışır; asıl
 * yetki kontrolü sunucuda (`list_client_error_reports`).
 */
export function usePlatformErrorReports(options?: { enabled?: boolean }) {
  const { identity } = useAuth();
  const isOperator = Boolean(identity?.platformOperator);

  return useInfiniteQuery<
    ClientErrorReportPage,
    Error,
    InfiniteData<ClientErrorReportPage, string | null>,
    readonly [string, string],
    string | null
  >({
    queryKey: platformKeys.errorReports(),
    queryFn: ({ pageParam }) =>
      loadClientErrorReports(ERROR_REPORT_PAGE_SIZE, pageParam),
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: (options?.enabled ?? true) && isOperator,
  });
}
