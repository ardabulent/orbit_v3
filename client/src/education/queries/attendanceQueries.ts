// Yoklama geçmişi ve öğrencinin yoklama kayıtları.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  loadAttendanceHistory,
  loadStudentAttendanceRecords,
  type AttendanceHistoryResult,
  type StudentAttendanceRecord,
} from "../attendanceService";
import { educationKeys } from "./educationKeys";

/** Bir öğrencinin `since`'ten bu yana yoklama kayıtları (Genel Bakış). */
export function useStudentAttendanceRecords(options: {
  studentId: string;
  since: string;
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options.organizationId ?? identity?.membership?.organizationId;
  const isEnabled =
    (options.enabled ?? true) &&
    Boolean(organizationId) &&
    Boolean(options.studentId);

  return useQuery<StudentAttendanceRecord[], Error>({
    queryKey: educationKeys.studentAttendance(
      organizationId ?? "",
      options.studentId,
      options.since
    ),
    queryFn: () =>
      loadStudentAttendanceRecords(
        organizationId as string,
        options.studentId,
        options.since
      ),
    enabled: isEnabled,
  });
}

/** Geçmiş yoklama oturumları, durum sayılarıyla (Yoklama · Geçmiş). */
export function useAttendanceHistory(options: {
  since: string;
  classId?: string | null;
  organizationId?: string;
  enabled?: boolean;
}) {
  const { identity } = useAuth();
  const organizationId =
    options.organizationId ?? identity?.membership?.organizationId;
  const isEnabled = (options.enabled ?? true) && Boolean(organizationId);

  return useQuery<AttendanceHistoryResult, Error>({
    queryKey: educationKeys.attendanceHistory(organizationId ?? "", {
      since: options.since,
      classId: options.classId,
    }),
    queryFn: () =>
      loadAttendanceHistory(organizationId as string, {
        since: options.since,
        classId: options.classId,
      }),
    enabled: isEnabled,
    staleTime: 0,
  });
}
