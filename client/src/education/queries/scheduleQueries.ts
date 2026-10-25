// Ders programı, şablonlar ve vekillikler.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  SCHEDULE_TOTAL_CAP,
  loadSchedule,
  type ScheduleListResult,
} from "../scheduleService";
import {
  loadScheduleTemplates,
  type ScheduleTemplate,
} from "../scheduleTemplateService";
import {
  loadSubstitutes,
  type SubstituteListResult,
} from "../substituteService";
import { educationKeys } from "./educationKeys";

export type UseScheduleOptions = {
  organizationId?: string;
  limit?: number;
  enabled?: boolean;
};

/**
 * Aktif kurumun ders programını getiren React Query hook'u (v1.3-01 · B parçası).
 *
 * Aktif kurum kimliği `useAuth` üzerinden sağlanır; kurum kimliği henüz
 * çözümlenmemişse veya kullanıcı bir kuruma ait değilse sorgu çalıştırılmaz (`enabled: false`).
 */
export function useSchedule(options?: UseScheduleOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? SCHEDULE_TOTAL_CAP;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<ScheduleListResult, Error>({
    queryKey: organizationId
      ? educationKeys.schedule(organizationId)
      : (["education", "schedule", { organizationId: "" }] as const),
    queryFn: () => loadSchedule(organizationId!, limit),
    enabled: isEnabled,
  });
}

/** Kurumun ders programı şablonları (yalnız yönetici; RLS süzer). */
export function useScheduleTemplates(options: {
  organizationId: string;
  enabled?: boolean;
}) {
  const { organizationId } = options;
  return useQuery<ScheduleTemplate[], Error>({
    queryKey: educationKeys.scheduleTemplates(organizationId),
    queryFn: () => loadScheduleTemplates(organizationId),
    enabled: (options.enabled ?? true) && Boolean(organizationId),
  });
}

/**
 * Kurumun iptal edilmemiş vekillikleri. Yönetici hepsini, öğretmen yalnız
 * kendisinin vekil ya da izinli olduğu satırları görür (RLS).
 */
export function useSubstitutes(options?: {
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<SubstituteListResult, Error>({
    queryKey: organizationId
      ? educationKeys.substitutes(organizationId)
      : (["education", "substitutes", { organizationId: "" }] as const),
    queryFn: () => loadSubstitutes(organizationId!),
    enabled: isEnabled,
  });
}
