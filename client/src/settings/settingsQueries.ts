import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  loadOrganizationMembers,
  type OrganizationMember,
} from "@/organization/memberService";
import {
  DEFAULT_BRANCH_LIMIT,
  loadBranches,
  loadOrganizationBranches,
  type BranchListResult,
  type LoadBranchesOptions,
} from "@/organization/branchService";
import { loadProfileContact } from "@/auth/profileContactService";
import {
  loadMemberMailStatus,
  type MemberMailStatus,
} from "@/organization/memberMailService";

/**
 * Ayarlar alanı sorgu anahtarları (v1.3-02 · a parçası, **K-19** / mimari kararlar).
 *
 * **Anahtar sözleşmesi:** `[alan, kaynak, kapsam]`
 *
 * - Kurum verileri `{ organizationId }` kapsamını taşır (**K-19** / izolasyon):
 *   kurum üyeleri ve şubeler kuruma aittir. Kurum değiştiğinde önbellekten
 *   farklı kurumun verisinin servis edilmesi engellenir.
 *
 * - Kişi iletişim verisi `{ userId }` kapsamını taşır:
 *   kullanıcının kendi iletişim bilgisi (telefon, kurtarma e-postası) kullanıcıya
 *   özgüdür.
 *
 * Anahtar üreticileri parametrelerini (`organizationId`, `userId`) zorunlu kılarak
 * kapsam taşımayan anahtar oluşturulmasını derleme zamanında (TypeScript) engeller.
 */
export const settingsKeys = {
  all: ["settings"] as const,
  members: (organizationId: string) =>
    ["settings", "members", { organizationId }] as const,
  branches: (organizationId: string) =>
    ["settings", "branches", { organizationId }] as const,
  profileContact: (userId: string) =>
    ["settings", "profileContact", { userId }] as const,
  memberMail: (organizationId: string) =>
    ["settings", "memberMail", { organizationId }] as const,
};

export type UseSettingsMembersOptions = {
  organizationId?: string;
  organizationCode?: number | null;
  enabled?: boolean;
};

/**
 * Kurumun kayıtlı üyelerini getiren React Query hook'u.
 *
 * Kurum kimliği henüz çözümlenmemişse veya demo modundaysa sorgu çalıştırılmaz (`enabled: false`).
 */
export function useSettingsMembers(options?: UseSettingsMembersOptions) {
  const { identity, demoMode } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const organizationCode =
    options?.organizationCode !== undefined
      ? options.organizationCode
      : (identity?.membership?.organizationCode ?? null);
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && !demoMode;

  return useQuery<OrganizationMember[], Error>({
    queryKey: organizationId
      ? settingsKeys.members(organizationId)
      : (["settings", "members", { organizationId: "" }] as const),
    queryFn: () => loadOrganizationMembers(organizationId!, organizationCode),
    enabled: isEnabled,
  });
}

export type UseSettingsBranchesOptions = {
  enabled?: boolean;
};

/**
 * Kurumun şubelerini getiren React Query hook'u.
 *
 * Kurum kimliği henüz sağlanmamışsa veya demo modundaysa sorgu çalıştırılmaz (`enabled: false`).
 */
export function useSettingsBranches(
  organizationId?: string,
  options?: UseSettingsBranchesOptions
) {
  const { identity, demoMode } = useAuth();
  const targetOrgId = organizationId ?? identity?.membership?.organizationId;
  const isEnabled =
    (options?.enabled ?? true) && Boolean(targetOrgId) && !demoMode;

  return useQuery<{ id: string; name: string; isDefault?: boolean }[], Error>({
    queryKey: targetOrgId
      ? settingsKeys.branches(targetOrgId)
      : (["settings", "branches", { organizationId: "" }] as const),
    queryFn: () => loadOrganizationBranches(targetOrgId!),
    enabled: isEnabled,
  });
}

export type UseBranchesOptions = LoadBranchesOptions & {
  organizationId?: string;
  enabled?: boolean;
};

/**
 * Kurumun tüm şubelerini limit ve kesilme bilgisiyle getiren React Query hook'u.
 *
 * Şube yönetimi ekranı (SettingsInstitutionSection) tarafından kullanılır.
 */
export function useBranches(
  organizationId?: string,
  options?: UseBranchesOptions
) {
  const { identity, demoMode } = useAuth();
  const targetOrgId = organizationId ?? identity?.membership?.organizationId;
  const isEnabled =
    (options?.enabled ?? true) && Boolean(targetOrgId) && !demoMode;
  const limit = options?.limit ?? DEFAULT_BRANCH_LIMIT;
  const includeArchived = Boolean(options?.includeArchived);

  return useQuery<BranchListResult, Error>({
    queryKey: targetOrgId
      ? ([
          "settings",
          "branches",
          {
            organizationId: targetOrgId,
            includeArchived,
            limit,
          },
        ] as const)
      : (["settings", "branches", { organizationId: "" }] as const),
    queryFn: () =>
      loadBranches(targetOrgId!, {
        includeArchived,
        limit,
      }),
    enabled: isEnabled,
  });
}

export type UseProfileContactOptions = {
  userId?: string;
  enabled?: boolean;
};

/**
 * Çağıran kullanıcının kendi profil iletişim bilgilerini getiren React Query hook'u.
 *
 * Kullanıcı kimliği yoksa veya demo modundaysa sorgu çalıştırılmaz (`enabled: false`).
 */
export function useProfileContact(options?: UseProfileContactOptions) {
  const { identity, demoMode } = useAuth();
  const userId = options?.userId ?? identity?.userId;
  const isEnabled = (options?.enabled ?? true) && Boolean(userId) && !demoMode;

  return useQuery<
    { phone: string | null; recoveryEmail: string | null } | null,
    Error
  >({
    queryKey: userId
      ? settingsKeys.profileContact(userId)
      : (["settings", "profileContact", { userId: "" }] as const),
    queryFn: () => loadProfileContact(),
    enabled: isEnabled,
  });
}

/**
 * Üyelerin kurtarma adresi var mı ve son e-postaları nasıl gitti
 * (2026-10-14). Yalnız yönetici için çalışır; şikâyet gelince güncel olsun
 * diye pencereye dönüldüğünde tazelenir.
 */
export function useMemberMailStatus(options?: { enabled?: boolean }) {
  const { identity, demoMode } = useAuth();
  const organizationId = identity?.membership?.organizationId;
  return useQuery<Map<string, MemberMailStatus>, Error>({
    queryKey: organizationId
      ? settingsKeys.memberMail(organizationId)
      : (["settings", "memberMail", { organizationId: "" }] as const),
    queryFn: loadMemberMailStatus,
    enabled: (options?.enabled ?? true) && Boolean(organizationId) && !demoMode,
    refetchOnWindowFocus: true,
  });
}
