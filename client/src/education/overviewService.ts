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

// =========================================================================
// Öğrenci (ve veli) — kimlik parametresi öğrenci, kurum değil (`20261003000000`)
// =========================================================================

export type StudentOverview = {
  lessonsToday: number;
  homeworkDueThisWeek: number;
  homeworkDueSoon: number;
  homeworkMissed: number;
  absentCount: number;
  lateCount: number;
  /** Öğrencinin hiç sınav sonucu yoksa `null` — sıfır puan uydurulmaz. */
  latestExam: {
    name: string;
    date: string;
    score: number;
    maxScore: number | null;
  } | null;
};

export type UpcomingHomework = {
  id: string;
  title: string;
  subject: string | null;
  className: string;
  dueDate: string;
};

type RawStudentOverviewRow = {
  lessons_today: number | string | null;
  homework_due_this_week: number | string | null;
  homework_due_soon: number | string | null;
  homework_missed: number | string | null;
  absent_count: number | string | null;
  late_count: number | string | null;
  latest_exam_name: string | null;
  latest_exam_date: string | null;
  latest_exam_score: number | string | null;
  latest_exam_max_score: number | string | null;
};

type RawUpcomingHomeworkRow = {
  homework_id: string;
  title: string;
  subject_name: string | null;
  class_name: string;
  due_date: string;
};

export function mapStudentOverviewRow(
  row: RawStudentOverviewRow
): StudentOverview {
  const hasExam =
    row.latest_exam_name !== null &&
    row.latest_exam_date !== null &&
    row.latest_exam_score !== null;
  const maxScore =
    row.latest_exam_max_score === null
      ? null
      : Number(row.latest_exam_max_score);

  return {
    lessonsToday: toCount(row.lessons_today),
    homeworkDueThisWeek: toCount(row.homework_due_this_week),
    homeworkDueSoon: toCount(row.homework_due_soon),
    homeworkMissed: toCount(row.homework_missed),
    absentCount: toCount(row.absent_count),
    lateCount: toCount(row.late_count),
    latestExam: hasExam
      ? {
          name: row.latest_exam_name as string,
          date: row.latest_exam_date as string,
          score: Number(row.latest_exam_score),
          maxScore: Number.isFinite(maxScore) ? maxScore : null,
        }
      : null,
  };
}

export async function loadStudentOverview(
  studentId: string
): Promise<StudentOverview | null> {
  const { data, error } = await supabase.rpc("student_overview_counts", {
    target_student_id: studentId,
  });

  if (error) {
    throw new Error("Genel bakış sayıları yüklenemedi.");
  }

  const rows = (data ?? []) as RawStudentOverviewRow[];
  return rows.length > 0 ? mapStudentOverviewRow(rows[0]) : null;
}

export async function loadStudentUpcomingHomework(
  studentId: string
): Promise<UpcomingHomework[]> {
  const { data, error } = await supabase.rpc("student_upcoming_homework", {
    target_student_id: studentId,
  });

  if (error) {
    throw new Error("Yaklaşan ödevler yüklenemedi.");
  }

  return ((data ?? []) as RawUpcomingHomeworkRow[]).map(row => ({
    id: row.homework_id,
    title: row.title,
    subject: row.subject_name?.trim() || null,
    className: row.class_name,
    dueDate: row.due_date,
  }));
}

export async function loadStudentLessonsToday(
  studentId: string
): Promise<TodayLesson[]> {
  const { data, error } = await supabase.rpc("student_lessons_today", {
    target_student_id: studentId,
  });

  if (error) {
    throw new Error("Bugünün dersleri yüklenemedi.");
  }

  return ((data ?? []) as RawTodayLessonRow[]).map(mapTodayLessonRow);
}

/**
 * Bir öğrencinin vadesi geçmiş taksit sayısı (`student_payment_summaries`).
 *
 * `null`: satır dönmedi — öğrencinin görülebilir bir ödeme planı yok ya da
 * çağıran ödemeyi göremiyor. "0 gecikmiş" ile aynı şey değil ve sıfıra
 * çevrilmez. Fonksiyon invoker; ödeme yalnız yönetici ve veliye açık.
 */
export async function loadStudentOverdueInstallments(
  studentId: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc("student_payment_summaries", {
    target_student_ids: [studentId],
  });

  if (error) {
    throw new Error("Ödeme durumu yüklenemedi.");
  }

  const row = ((data ?? []) as { overdue_count: number | string | null }[])[0];
  return row ? toCount(row.overdue_count) : null;
}
