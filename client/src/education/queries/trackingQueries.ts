// Takip sekmesinin sorguları (2026-11-24).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { loadFollowupNotes, type FollowupNote } from "../followupNoteService";
import {
  loadStudentTargets,
  type StudentTarget,
} from "../studentTargetService";
import type { TrackingStudentRow } from "../tracking/trackingTypes";
import {
  loadTrackingDefaults,
  loadTrackingMetrics,
  type TrackingDefaults,
  type TrackingScope,
} from "../trackingService";
import { educationKeys } from "./educationKeys";

/**
 * Seçili kapsamın ham sayıları. Ekran başına tek istek; sınır, ölçüt ve
 * sıralama değişimi anahtara girmediği için yeni istek doğurmaz.
 */
export function useTrackingMetrics(
  scope: TrackingScope,
  options?: { enabled?: boolean }
) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<TrackingStudentRow[], Error>({
    queryKey: educationKeys.trackingMetrics(
      organizationId,
      scope.weeks,
      scope.classId,
      scope.studentId
    ),
    queryFn: () => loadTrackingMetrics(scope),
    enabled: isEnabled,
  });
}

/** Kurum varsayılan sınırları: küçük, nadiren değişir. */
export function useTrackingDefaults(options?: { enabled?: boolean }) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<TrackingDefaults, Error>({
    queryKey: educationKeys.trackingDefaults(organizationId),
    queryFn: () => loadTrackingDefaults(organizationId),
    enabled: isEnabled,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Öğrencinin hedefleri (4.10b): öğrenci ve velinin sınav ekranı okur.
 * Takip'teki düzenleyici satırdaki `targets`'ı kullanır, bunu değil.
 */
export function useStudentTargets(
  studentId: string | undefined,
  options?: { enabled?: boolean }
) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && Boolean(studentId);

  return useQuery<StudentTarget[], Error>({
    queryKey: educationKeys.studentTargets(organizationId, studentId ?? ""),
    queryFn: () => loadStudentTargets(studentId ?? ""),
    enabled: isEnabled,
  });
}

/** Takip notları (4.10c): yalnız öğrenci profili açıkken ve her açılışta taze okunur. */
export function useFollowupNotes(
  studentId: string | undefined,
  options?: { enabled?: boolean }
) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "";
  const isEnabled =
    (options?.enabled ?? true) && Boolean(organizationId) && Boolean(studentId);

  return useQuery<FollowupNote[], Error>({
    queryKey: educationKeys.followupNotes(organizationId, studentId ?? ""),
    queryFn: () => loadFollowupNotes(studentId ?? ""),
    enabled: isEnabled,
    // Not başka bir öğretmen ya da yönetici tarafından eklenmiş olabilir:
    // profil her açıldığında taze okunur (genel ayar 1 dakika, main.tsx).
    staleTime: 0,
  });
}
