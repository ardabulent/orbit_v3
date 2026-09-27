import { supabase } from "@/lib/supabaseClient";

/**
 * Genel Bakış servis katmanı (yönetici).
 *
 * İki veritabanı fonksiyonunu çağırır: `admin_overview_counts` ve
 * `today_lessons` (`20261001000000`). Sayım istemcide YAPILMAZ: öğrenci
 * listesi 100 satırla sınırlı ve tavana dayanan istemci yetkili görünen
 * yanlış bir sayı üretir (`20260908020000`).
 *
 * **Hata yutulmaz.** Sorgu hata verirse fırlatılır; ekran "yüklenemedi" der.
 * Sıfır uydurmak, sorunsuz bir kurum resmi çizmek olurdu (**K-03**, **K-22**).
 *
 * **Satır yoksa `null`.** Fonksiyon, çağıranın göremediği kurum için hiç
 * satır döndürmez; bu "kurumda hiçbir şey yok" demek değildir.
 */

export type AdminOverviewCounts = {
  activeStudents: number;
  studentsWithoutClass: number;
  studentsWithoutGuardian: number;
  activeClasses: number;
  lessonsToday: number;
  classesMissingAttendanceToday: number;
};

export type TodayLesson = {
  id: string;
  time: string;
  endTime: string | null;
  classId: string;
  className: string;
  title: string;
  room: string | null;
  teacher: string | null;
  /**
   * `null`: çağıran bu sınıfın yoklamasını göremiyor (vekil öğretmen,
   * `my_lessons_today`). "Alınmadı" ile aynı şey değil.
   */
  attendanceTaken: boolean | null;
};

export type TeacherOverviewCounts = {
  myClasses: number;
  myStudents: number;
  myLessonsToday: number;
  classesMissingAttendanceToday: number;
  homeworkAwaitingMarking: number;
};

type RawCountsRow = {
  active_students: number | string | null;
  students_without_class: number | string | null;
  students_without_guardian: number | string | null;
  active_classes: number | string | null;
  lessons_today: number | string | null;
  classes_missing_attendance_today: number | string | null;
};

type RawTodayLessonRow = {
  entry_id: string;
  starts_at: string;
  ends_at: string | null;
  class_id: string;
  class_name: string;
  subject_name: string | null;
  title: string | null;
  room: string | null;
  teacher_name: string | null;
  attendance_taken: boolean | null;
};

type RawTeacherCountsRow = {
  my_classes: number | string | null;
  my_students: number | string | null;
  my_lessons_today: number | string | null;
  classes_missing_attendance_today: number | string | null;
  homework_awaiting_marking: number | string | null;
};

/** bigint PostgREST'ten sayı ya da dizge olarak gelebilir. */
function toCount(value: number | string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapCountsRow(row: RawCountsRow): AdminOverviewCounts {
  return {
    activeStudents: toCount(row.active_students),
    studentsWithoutClass: toCount(row.students_without_class),
    studentsWithoutGuardian: toCount(row.students_without_guardian),
    activeClasses: toCount(row.active_classes),
    lessonsToday: toCount(row.lessons_today),
    classesMissingAttendanceToday: toCount(
      row.classes_missing_attendance_today
    ),
  };
}

export function mapTodayLessonRow(row: RawTodayLessonRow): TodayLesson {
  return {
    id: row.entry_id,
    time: row.starts_at.slice(0, 5),
    endTime: row.ends_at ? row.ends_at.slice(0, 5) : null,
    classId: row.class_id,
    className: row.class_name,
    // Ad kuralı `resolveLessonTitle` ile aynı: ders doluysa dersten, değilse başlıktan.
    title: row.subject_name?.trim() || row.title?.trim() || "",
    room: row.room?.trim() || null,
    teacher: row.teacher_name?.trim() || null,
    attendanceTaken: row.attendance_taken ?? null,
  };
}

export async function loadAdminOverviewCounts(
  organizationId: string
): Promise<AdminOverviewCounts | null> {
  const { data, error } = await supabase.rpc("admin_overview_counts", {
    target_organization_id: organizationId,
  });

  if (error) {
    throw new Error("Genel bakış sayıları yüklenemedi.");
  }

  const rows = (data ?? []) as RawCountsRow[];
  return rows.length > 0 ? mapCountsRow(rows[0]) : null;
}

export async function loadTodayLessons(
  organizationId: string
): Promise<TodayLesson[]> {
  const { data, error } = await supabase.rpc("today_lessons", {
    target_organization_id: organizationId,
  });

  if (error) {
    throw new Error("Bugünün dersleri yüklenemedi.");
  }

  return ((data ?? []) as RawTodayLessonRow[]).map(mapTodayLessonRow);
}

export function mapTeacherCountsRow(
  row: RawTeacherCountsRow
): TeacherOverviewCounts {
  return {
    myClasses: toCount(row.my_classes),
    myStudents: toCount(row.my_students),
    myLessonsToday: toCount(row.my_lessons_today),
    classesMissingAttendanceToday: toCount(
      row.classes_missing_attendance_today
    ),
    homeworkAwaitingMarking: toCount(row.homework_awaiting_marking),
  };
}

/** Öğretmen Genel Bakış sayıları (`teacher_overview_counts`, `20261002000000`). */
export async function loadTeacherOverviewCounts(
  organizationId: string
): Promise<TeacherOverviewCounts | null> {
  const { data, error } = await supabase.rpc("teacher_overview_counts", {
    target_organization_id: organizationId,
  });

  if (error) {
    throw new Error("Genel bakış sayıları yüklenemedi.");
  }

  const rows = (data ?? []) as RawTeacherCountsRow[];
  return rows.length > 0 ? mapTeacherCountsRow(rows[0]) : null;
}

/** Çağıranın programda öğretmen olarak yazılı olduğu bugünkü dersler. */
export async function loadMyLessonsToday(
  organizationId: string
): Promise<TodayLesson[]> {
  const { data, error } = await supabase.rpc("my_lessons_today", {
    target_organization_id: organizationId,
  });

  if (error) {
    throw new Error("Bugünün dersleri yüklenemedi.");
  }

  return ((data ?? []) as RawTodayLessonRow[]).map(mapTodayLessonRow);
}
