// Takip sekmesinin sorguları (2026-11-24).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
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
