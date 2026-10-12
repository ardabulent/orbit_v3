import { supabase } from "@/lib/supabaseClient";
import { loadClassStaffNames } from "./classStaffNames";

export type ClassTeacherItem = {
  id: string;
  organizationId: string;
  classId: string;
  membershipId: string;
  teacherName: string | null;
  subjectId: string;
  subjectName: string | null;
  createdAt?: string;
  archivedAt?: string | null;
};

export type ClassTeacherListResult = {
  rows: ClassTeacherItem[];
  truncated: boolean;
};

export type LoadClassTeachersOptions = {
  includeArchived?: boolean;
  limit?: number;
};

export type AssignTeacherInput = {
  organizationId: string;
  classId: string;
  membershipId: string;
  subjectId: string;
};

export const DEFAULT_CLASS_TEACHER_LIMIT = 50;

type RawClassTeacherRow = {
  id: string;
  organization_id: string;
  class_id: string;
  membership_id: string;
  subject_id: string;
  created_at?: string;
  archived_at?: string | null;
  subjects?:
    | { id?: string; name: string; archived_at?: string | null }
    | { id?: string; name: string; archived_at?: string | null }[]
    | null;
};

function extractSubjectName(subjects: unknown): string | null {
  if (!subjects) return null;
  const subObj = Array.isArray(subjects) ? subjects[0] : subjects;
  if (!subObj || typeof subObj !== "object") return null;
  const sub = subObj as { name?: string; archived_at?: string | null };
  return sub.name?.trim() || null;
}

/**
 * Bir sınıfın öğretmen atamalarını listeler.
 *
 * - Açık `organization_id` süzgeci taşır (K-19 / multi-tenant izolasyonu).
 * - Açık `.limit()` ve `truncated` bayrağı döner (sessiz kesilme engeli / K-03).
 */
export async function loadClassTeachers(
  organizationId: string,
  classId: string,
  options?: LoadClassTeachersOptions
): Promise<ClassTeacherListResult> {
  if (!organizationId || !classId) {
    return { rows: [], truncated: false };
  }

  const limit = options?.limit ?? DEFAULT_CLASS_TEACHER_LIMIT;

  let query = supabase
    .from("class_teachers")
    .select(
      `
      id,
      organization_id,
      class_id,
      membership_id,
      subject_id,
      created_at,
      archived_at,
      subjects ( id, name, archived_at )
    `
    )
    .eq("organization_id", organizationId)
    .eq("class_id", classId);

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(translateClassTeacherError(error));
  }

  const rawRows = (data ?? []) as RawClassTeacherRow[];
  const staffNames = await loadClassStaffNames([classId]);

  const rows: ClassTeacherItem[] = rawRows.map(row => ({
    id: row.id,
    organizationId: row.organization_id,
    classId: row.class_id,
    membershipId: row.membership_id,
    teacherName: staffNames.get(row.membership_id) ?? null,
    subjectId: row.subject_id,
    subjectName: extractSubjectName(row.subjects),
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  }));

  return {
    rows,
    truncated: rawRows.length === limit,
  };
}

/**
 * Bir sınıfa ders öğretmeni atar (yalnızca kurum yöneticisi / RLS).
 *
 * ⚠️ Yüke asla `id` KONMAZ — kimlik veritabanının işidir (#287 / K-00).
 * Sunucu kuralı: Yalnızca admin veya teacher rolündeki üyeler atanabilir (ORB03).
 */
export async function assignTeacher(
  input: AssignTeacherInput
): Promise<{ id: string }> {
  const payload = {
    organization_id: input.organizationId,
    class_id: input.classId,
    membership_id: input.membershipId,
    subject_id: input.subjectId,
  };

  const { data, error } = await supabase
    .from("class_teachers")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(translateClassTeacherError(error));
  }

  return { id: data.id };
}

/**
 * Bir öğretmen atamasını kaldırır (arşivler).
 *
 * ⚠️ Öğretmen ataması DÜZENLENEMEZ (`UPDATE` yetkisi yalnız `archived_at`).
 * Yanlış atama kaldırılır ve yenisi açılır.
 * Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function unassignTeacher(
  organizationId: string,
  assignmentId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("class_teachers")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", assignmentId)
    .is("archived_at", null)
    .select("id");

  if (error) {
    throw new Error(translateClassTeacherError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Öğretmen ataması bulunamadı veya işlem yetkiniz yok.");
  }
}

/**
 * Öğretmen atama işlemlerinde veritabanı hatalarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 *
 * 🔴 ORB03: Atama yapılacak üyelik admin veya teacher rolünde olmalıdır.
 * 23505: Aynı öğretmen aynı sınıfa aynı dersten zaten atanmış.
 */
export function translateClassTeacherError(error: unknown): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  let message = "";
  let details: string | undefined;

  if (typeof error === "object" && error !== null) {
    const errObj = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      detail?: unknown;
    };
    if (typeof errObj.code === "string") {
      code = errObj.code;
    }
    if (typeof errObj.message === "string") {
      message = errObj.message;
    }
    if (typeof errObj.details === "string") {
      details = errObj.details;
    } else if (typeof errObj.detail === "string") {
      details = errObj.detail;
    }
  }

  if (!code && (message || details)) {
    const textToScan = `${message} ${details}`;
    for (const known of ["ORB03", "23505", "23503", "42501"]) {
      if (textToScan.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "ORB03") {
    return "Ders ataması yalnızca kurum yöneticisi veya öğretmen rolündeki üyelere yapılabilir.";
  }

  if (code === "23505") {
    return "Bu öğretmen bu derse zaten atanmış.";
  }

  if (code === "23503") {
    return "Seçilen sınıf veya ders bulunamadı ya da arşivlenmiş.";
  }

  if (code === "42501") {
    return "Bu işlem için kurum yöneticisi yetkisi gerekiyor.";
  }

  return "Öğretmen atama işlemi gerçekleştirilemedi. Lütfen tekrar deneyin.";
}
