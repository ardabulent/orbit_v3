import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";
import type {
  ClassGroup,
  ClassEnrollmentItem,
} from "@/components/education/types";
import { extractBranchName } from "./studentService";

/**
 * Sınıf listesi ve sınıf yönetimi servis katmanı (v1.3-01 · A parçası, v1.4-02 · #266).
 *
 * `classes` ve `class_enrollments` tablolarını gerçek Supabase sorgularına bağlar.
 *
 * **Açık `organization_id` filtresi (ROADMAP §4.12, #249):** RLS tek başına süzdüğünde
 * Postgres sorgu planlayıcısı `organization_id` indeksini kullanamıyor. Bu nedenle
 * performans kısıtı olarak sorguya açık `.eq("organization_id", organizationId)` eklenir.
 *
 * **Arşiv filtresi zorunludur:** `archived_at is null` filtresi uygulanır.
 *
 * **Mentor isim çözümü:** `class_staff_names` veritabanı fonksiyonu üzerinden yapılır (#231).
 * `profiles` tablosuna doğrudan sorgu atılmaz; çünkü `profiles` aynı satırda `recovery_email`,
 * `phone` ve şifre kilidi durumunu taşır ve RLS sütun gizleyemez (#228).
 *
 * **Tip dürüstlüğü (K-03):** Kaynağı olmayan veya henüz hesaplanmayan alanlar
 * (`attendance`, `nextLesson`) `undefined` bırakılır, kesinlikle `0` veya uydurulmuş
 * dizeler verilmez. Kontenjan belirtilmemişse `null` bırakılır.
 */

export const DEFAULT_CLASS_LIMIT = 100;

export type ClassListResult = {
  rows: ClassGroup[];
  truncated: boolean;
};

type RawClassRow = {
  id: string;
  name: string;
  program: string | null;
  mentor_membership_id: string | null;
  branch_id?: string | null;
  capacity?: number | null;
  branches?: { name: string } | { name: string }[] | null;
  archived_at?: string | null;
  class_enrollments?: { id: string; archived_at: string | null }[] | null;
};

type RawClassEnrollmentRow = {
  id: string;
  class_id: string;
  student_id: string;
  created_at?: string | null;
  archived_at?: string | null;
  students?:
    | {
        full_name: string;
        student_number?: string | null;
      }
    | {
        full_name: string;
        student_number?: string | null;
      }[]
    | null;
};

/**
 * Sınıf ve kayıt işlemlerinde oluşan veritabanı hatalarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 * 23505 hatası sınıf oluşturma/güncellemede "aynı isimde sınıf var", kayıtta "öğrenci zaten kayıtlı" anlamına gelir.
 */
export function translateClassError(
  error: unknown,
  context: "class" | "enrollment" = "class"
): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  if (typeof error === "object" && error !== null && "code" in error) {
    code = String((error as { code: unknown }).code);
  } else if (error instanceof Error) {
    for (const known of ["23505", "23514", "42501", "ORB03"]) {
      if (error.message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "23505") {
    return context === "enrollment"
      ? "Bu öğrenci zaten bu sınıfa kayıtlı."
      : "Bu isimde bir sınıf bu kurumda zaten var. Farklı bir sınıf adı girin.";
  }
  if (code === "23514") {
    return context === "enrollment"
      ? "Geçersiz kayıt bilgisi."
      : "Sınıf adı 1-120 karakter arasında olmalı veya kontenjan 1 ile 1000 arasında bir sayı olmalıdır.";
  }
  if (code === "ORB03") {
    return "Rehber öğretmen olarak yalnızca öğretmen veya yönetici rolündeki bir üye seçilebilir.";
  }
  if (code === "42501") {
    return "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor.";
  }

  // Türkçe veritabanı uyarısı ve ağ hatası gösterilir; İngilizce teknik
  // metin gösterilmez (B6, 2026-10-07 — `lib/userFacingError.ts`).
  const shown = userFacingErrorText(error);
  if (shown) {
    return shown;
  }

  return "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.";
}

export async function loadMentorNames(
  classIds: string[]
): Promise<Map<string, string>> {
  const unique = classIds.filter(
    (id, index) => Boolean(id) && classIds.indexOf(id) === index
  );
  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("class_staff_names", {
    target_class_ids: unique,
  });

  if (error || !data) {
    return new Map();
  }

  const result = new Map<string, string>();
  for (const row of data as {
    class_id: string;
    membership_id: string;
    display_name: string;
  }[]) {
    if (row.membership_id && row.display_name) {
      result.set(row.membership_id, row.display_name);
    }
  }
  return result;
}

export function mapClassRow(
  row: RawClassRow,
  mentorNames: Map<string, string>
): ClassGroup {
  const enrollments = Array.isArray(row.class_enrollments)
    ? row.class_enrollments
    : [];
  const activeStudentCount = enrollments.filter(
    e => e && (e.archived_at === null || e.archived_at === undefined)
  ).length;

  const mentorName = row.mentor_membership_id
    ? (mentorNames.get(row.mentor_membership_id) ?? null)
    : null;

  return {
    id: row.id,
    name: row.name,
    program: row.program || null,
    mentor: mentorName,
    mentorMembershipId: row.mentor_membership_id ?? null,
    branch: extractBranchName(row.branches),
    branchId: row.branch_id ?? null,
    capacity: row.capacity ?? null,
    studentCount: activeStudentCount,
    // attendance: yoklama türetmesi (C parçası)
    // nextLesson: ders programı türetmesi (B parçası)
  };
}

export async function loadClasses(
  organizationId: string,
  options?: { limit?: number }
): Promise<ClassListResult> {
  const limit = options?.limit ?? DEFAULT_CLASS_LIMIT;

  const { data, error } = await supabase
    .from("classes")
    .select(
      `
      id,
      name,
      program,
      mentor_membership_id,
      branch_id,
      capacity,
      branches ( name ),
      class_enrollments (
        id,
        archived_at
      )
    `
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error("Sınıf listesi yüklenemedi.");
  }

  const rawRows = (data ?? []) as RawClassRow[];
  const classIds = rawRows.map(row => row.id).filter(Boolean);

  const mentorNames = await loadMentorNames(classIds);
  const rows = rawRows.map(row => mapClassRow(row, mentorNames));

  return {
    rows,
    truncated: rows.length === limit,
  };
}

export type CreateClassInput = {
  organizationId: string;
  branchId: string;
  name: string;
  program?: string | null;
  mentorMembershipId?: string | null;
  capacity?: number | null;
};

export async function createClass(
  input: CreateClassInput
): Promise<{ id: string }> {
  const payload: {
    organization_id: string;
    branch_id: string;
    name: string;
    program?: string | null;
    mentor_membership_id?: string | null;
    capacity?: number | null;
  } = {
    organization_id: input.organizationId,
    branch_id: input.branchId,
    name: input.name,
  };

  if (input.program !== undefined) {
    payload.program = input.program;
  }
  if (input.mentorMembershipId !== undefined) {
    payload.mentor_membership_id = input.mentorMembershipId;
  }
  if (input.capacity !== undefined) {
    payload.capacity = input.capacity;
  }

  const { data, error } = await supabase
    .from("classes")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(translateClassError(error, "class"));
  }

  return data;
}

export type UpdateClassInput = {
  name?: string;
  program?: string | null;
  branchId?: string;
  mentorMembershipId?: string | null;
  capacity?: number | null;
};

export async function updateClass(
  classId: string,
  input: UpdateClassInput
): Promise<void> {
  const payload: {
    name?: string;
    program?: string | null;
    branch_id?: string;
    mentor_membership_id?: string | null;
    capacity?: number | null;
  } = {};

  if (input.name !== undefined) {
    payload.name = input.name;
  }
  if (input.program !== undefined) {
    payload.program = input.program;
  }
  if (input.branchId !== undefined) {
    payload.branch_id = input.branchId;
  }
  if (input.mentorMembershipId !== undefined) {
    payload.mentor_membership_id = input.mentorMembershipId;
  }
  if (input.capacity !== undefined) {
    payload.capacity = input.capacity;
  }

  const { data, error } = await supabase
    .from("classes")
    .update(payload)
    .eq("id", classId)
    .select("id");

  if (error) {
    throw new Error(translateClassError(error, "class"));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Sınıf bulunamadı veya güncellenemedi.");
  }
}

export async function archiveClass(classId: string): Promise<void> {
  const { data, error } = await supabase
    .from("classes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", classId)
    .select("id");

  if (error) {
    throw new Error(translateClassError(error, "class"));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Sınıf bulunamadı veya arşivlenemedi.");
  }
}

export async function restoreClass(classId: string): Promise<void> {
  const { data, error } = await supabase
    .from("classes")
    .update({ archived_at: null })
    .eq("id", classId)
    .select("id");

  if (error) {
    throw new Error(translateClassError(error, "class"));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Sınıf bulunamadı veya geri yüklenemedi.");
  }
}

export async function loadClassEnrollments(
  organizationId: string,
  classId: string,
  options?: { includeArchived?: boolean }
): Promise<ClassEnrollmentItem[]> {
  let query = supabase
    .from("class_enrollments")
    .select(
      `
      id,
      class_id,
      student_id,
      created_at,
      archived_at,
      students (
        full_name,
        student_number
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("class_id", classId);

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    throw new Error(translateClassError(error, "enrollment"));
  }

  const rows = (data ?? []) as RawClassEnrollmentRow[];
  return rows.map(r => {
    const student = Array.isArray(r.students) ? r.students[0] : r.students;
    return {
      id: r.id,
      classId: r.class_id,
      studentId: r.student_id,
      // Ad okunamadığında **etiket uydurulmaz**. Boş gelmesinin üç sebebi var
      // (kayıt yok · RLS satırı vermedi · henüz türetilmedi) ve uydurulmuş bir
      // etiket üçünü birden birinciye indirir. Servis `null` döner; ne
      // gösterileceğine ekran karar verir.
      studentName: student?.full_name ?? null,
      studentNumber: student?.student_number ?? null,
      enrolledAt: r.created_at ?? null,
      archivedAt: r.archived_at ?? null,
    };
  });
}

export type EnrollStudentInput = {
  organizationId: string;
  classId: string;
  studentId: string;
};

export async function enrollStudent(
  input: EnrollStudentInput
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("class_enrollments")
    .insert({
      organization_id: input.organizationId,
      class_id: input.classId,
      student_id: input.studentId,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(translateClassError(error, "enrollment"));
  }

  return data;
}

export async function unenrollStudent(enrollmentId: string): Promise<void> {
  const { data, error } = await supabase
    .from("class_enrollments")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", enrollmentId)
    .select("id");

  if (error) {
    throw new Error(translateClassError(error, "enrollment"));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Sınıf kaydı bulunamadı veya kaldırılamadı.");
  }
}
