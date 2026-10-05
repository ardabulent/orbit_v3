import { supabase } from "@/lib/supabaseClient";

/**
 * "Sınava girmedi" (2026-10-05). İşaretlenince öğrencinin sonucu ana
 * tablodan çıkar ve tam kopyası `exam_absences`'ta saklanır; ortalama ve
 * sıralama onu saymaz. Geri alınınca kopya aynen yazılır. Yönetici ya da
 * sınıfın öğretmeni yapar — yetki veritabanında (`mark_exam_absent`,
 * `restore_exam_result`); buradaki hiçbir kontrol güvenlik sınırı değildir.
 */

export type ExamAbsence = { studentId: string; reason: string | null };

export async function loadExamAbsences(
  organizationId: string,
  examId: string
): Promise<Map<string, ExamAbsence>> {
  // Kurum kimliği yoksa sorgu atılmaz (demo ve bağlamsız çizim).
  if (!organizationId || !examId) return new Map();
  const { data, error } = await supabase
    .from("exam_absences")
    .select("student_id, reason")
    .eq("organization_id", organizationId)
    .eq("exam_id", examId)
    .is("archived_at", null);

  if (error) throw new Error(translateAbsenceError(error));

  return new Map(
    ((data ?? []) as { student_id: string; reason: string | null }[]).map(
      row => [row.student_id, { studentId: row.student_id, reason: row.reason }]
    )
  );
}

export async function markExamAbsent(input: {
  examId: string;
  studentId: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc("mark_exam_absent", {
    p_exam_id: input.examId,
    p_student_id: input.studentId,
    p_reason: input.reason.trim() || null,
  });
  if (error) throw new Error(translateAbsenceError(error));
}

export async function restoreExamResult(input: {
  examId: string;
  studentId: string;
}): Promise<void> {
  const { error } = await supabase.rpc("restore_exam_result", {
    p_exam_id: input.examId,
    p_student_id: input.studentId,
  });
  if (error) throw new Error(translateAbsenceError(error));
}

export function translateAbsenceError(error: unknown): string {
  const { code, message } = (error ?? {}) as {
    code?: string;
    message?: string;
  };
  if (code === "42501") {
    return "Bunu yalnız kurum yöneticisi ya da sınıfın öğretmeni yapabilir.";
  }
  // Fonksiyonlar 22023/P0002/23503'te Türkçe ve gösterilebilir bir sebep yazar.
  if ((code === "22023" || code === "P0002" || code === "23503") && message) {
    return message;
  }
  if (code === "23514") {
    return "Sebep en çok 200 karakter olabilir.";
  }
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}
