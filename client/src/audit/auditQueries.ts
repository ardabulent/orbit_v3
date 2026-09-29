import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  DEFAULT_AUDIT_LIMIT,
  EMPTY_AUDIT_FILTERS,
  loadAuditActors,
  loadOrganizationAuditEvents,
  type AuditFilters,
  type AuditPage,
  type OrganizationAuditEvent,
} from "./auditService";

/**
 * Denetim kaydı sorgu anahtarları (v1.3-00, **K-19** / mimari kararlar).
 *
 * **Anahtar sözleşmesi:** `[alan, kaynak, kapsam]`
 *
 * Kapsam HER ZAMAN aktif kurumu taşır. Bu bir kod düzeni tercihi değil,
 * **izolasyon kuralıdır**: kurum kimliği anahtarda yoksa, iki kuruma da erişimi
 * olan bir kullanıcı kurum değiştirdiğinde React Query önceki kurumun satırlarını
 * önbellekten (cache) servis eder ve RLS bunu engelleyemez — çünkü istek
 * sunucuya hiç gitmez.
 *
 * Anahtar üreticisi `organizationId: string` parametresini zorunlu kılarak
 * kurumsuz anahtar oluşturulmasını derleme zamanında (TypeScript) engeller.
 */
export const auditKeys = {
  all: ["audit"] as const,
  events: (
    organizationId: string,
    filters: AuditFilters = EMPTY_AUDIT_FILTERS
  ) => ["audit", "events", { organizationId, ...filters }] as const,
  actors: (organizationId: string) =>
    ["audit", "actors", { organizationId }] as const,
};

export type UseOrganizationAuditEventsOptions = {
  organizationId?: string;
  limit?: number;
  filters?: AuditFilters;
};

/**
 * Aktif kurumun denetim kayıtlarını getiren React Query hook'u.
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function useOrganizationAuditEvents(
  options?: UseOrganizationAuditEventsOptions
) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? DEFAULT_AUDIT_LIMIT;
  const filters = options?.filters ?? EMPTY_AUDIT_FILTERS;

  return useInfiniteQuery<
    AuditPage<OrganizationAuditEvent>,
    Error,
    InfiniteData<AuditPage<OrganizationAuditEvent>, number | null>,
    ReturnType<typeof auditKeys.events>,
    number | null
  >({
    queryKey: organizationId
      ? auditKeys.events(organizationId, filters)
      : auditKeys.events("", filters),
    queryFn: ({ pageParam }) =>
      // `organizationId` burada kesin dolu: `enabled` onsuz sorguyu hiç
      // çalıştırmıyor ve anahtar da onu taşıyor.
      loadOrganizationAuditEvents(organizationId!, limit, pageParam, filters),
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: Boolean(organizationId),
  });
}

/** "Kim yaptı" süzgecinin kişi listesi. */
export function useAuditActors() {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId;

  return useQuery({
    queryKey: auditKeys.actors(organizationId ?? ""),
    queryFn: loadAuditActors,
    enabled: Boolean(organizationId),
  });
}
