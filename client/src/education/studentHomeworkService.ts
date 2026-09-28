import { supabase } from "@/lib/supabaseClient";
import { translateHomeworkError } from "./homeworkService";

/**
 * Öğrenci ve velinin ödev görünümü için öğrenciye özgü bağlam
 * (karar 2026-09-29): öğrencinin sınıfları ve öğretmenin teslim aldığı
 * ödevleri. Kapsam RLS'te: öğrenci kendi, veli çocuğunun satırını görür
 * (`homework_submissions_select_student/guardian`).
 *
 * Ödev listesinin kendisi sayfaya zaten geliyor (`loadHomework`); bu modül
 * yalnız "bu öğrenci için" süzmeye ve durum yazmaya yetecek kadarını okur.
 */
export type StudentHomeworkContext = {
  classIds: Set<string>;
  deliveredIds: Set<string>;
};

export async function loadStudentHomeworkContext(
  organizationId: string,
  studentId: string
): Promise<StudentHomeworkContext> {
  if (!organizationId || !studentId) {
    return { classIds: new Set(), deliveredIds: new Set() };
  }

  const [enrollments, submissions] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("class_id")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .is("archived_at", null),
    supabase
      .from("homework_submissions")
      .select("homework_id")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .is("archived_at", null),
  ]);
  if (enrollments.error)
    throw new Error(translateHomeworkError(enrollments.error));
  if (submissions.error)
    throw new Error(translateHomeworkError(submissions.error));

  return {
    classIds: new Set(
      ((enrollments.data ?? []) as { class_id: string }[]).map(r => r.class_id)
    ),
    deliveredIds: new Set(
      ((submissions.data ?? []) as { homework_id: string }[]).map(
        r => r.homework_id
      )
    ),
  };
}
