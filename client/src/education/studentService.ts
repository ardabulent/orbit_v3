import { supabase } from "@/lib/supabaseClient";
import type { Student } from "@/components/education/types";
import { loadStudentAttendancePercentages } from "./attendanceService";
import {
  loadStudentLatestExamScores,
  type StudentLatestExamScore,
} from "./examService";
import { loadStudentPaymentStatuses } from "./paymentService";
import { loadStudentHomeworkRatios } from "./homeworkService";
import { searchPattern } from "./turkishSearch";

/**
 * Öğrenci listesi ve CRUD servis katmanı (v1.3-01 & v1.4-01 · #264).
 *
 * `students` tablosunu Supabase sorgularına ve RPC çağrılarına bağlar.
 *
 * **Açık `organization_id` filtresi (ROADMAP §4.12, #249):** RLS tek başına süzdüğünde
 * Postgres sorgu planlayıcısı `organization_id` indeksini kullanamıyor. Bu nedenle
 * performans kısıtı olarak sorguya açık `.eq("organization_id", organizationId)` eklenir.
 *
 * **Arşiv filtresi zorunludur:** `archived_at is null` filtresi uygulanır. Bu sistemde
 * silme yerine arşivleme kullanılır; arşivlenmiş satırı getirmek silinen kaydı canlandırmaktır.
 *
 * **Devam yüzdesi türetimi (v1.3-01c · 2.D & K-06):**
 * `Student.attendance` alanı `attendanceService`'ten çağrılan toplu yardımcı
 * (`loadStudentAttendancePercentages`) ile doldurulur. Öğrenci başına tekil sorgu atılmaz (N+1 engellenir).
 * Payda sıfır ise veya hiç kayıt yoksa değer `undefined` bırakılır (K-22).
 *
 * **Sınav puanı türetimi (v1.3-01d · 2.D & K-06):**
 * `Student.score` alanı `examService`'ten çağrılan toplu yardımcı
 * (`loadStudentLatestExamScores`) ile doldurulur. Öğrenci başına tekil sorgu atılmaz (N+1 engellenir).
 * Sınavı olmayan öğrencinin puanı `undefined` bırakılır, kesinlikle `0` verilmez (K-22).
 *
 * **Ödeme durumu türetimi (v1.3-01e · 3.B/3.C & K-06):**
 * `Student.payment` alanı `paymentService`'ten çağrılan toplu yardımcı
 * (`loadStudentPaymentStatuses`) ile doldurulur. Öğrenci başına tekil sorgu atılmaz (N+1 engellenir).
 * Ödeme planı olmayan veya görmeye yetkisi olmayan öğrencinin durumu `undefined` bırakılır,
 * kesinlikle "Güncel" verilmez (K-22).
 *
 * **Tip dürüstlüğü (K-03):** Kaynağı olmayan veya henüz hesaplanmayan alanlar
 * (`homework`, `risk`) `undefined` bırakılır,
 * kesinlikle `0` veya uydurulmuş dizelerle doldurulmaz.
 */

export const DEFAULT_STUDENT_LIMIT = 100;

export type StudentListResult = {
  rows: Student[];
  truncated: boolean;
};

export type LoadStudentsOptions = {
  limit?: number;
  search?: string;
};

type RawStudentRow = {
  id: string;
  full_name: string;
  student_number?: string | null;
  auth_user_id?: string | null;
  branch_id?: string | null;
  archived_at?: string | null;
  branches?: { name: string } | { name: string }[] | null;
  class_enrollments?:
    | {
        archived_at: string | null;
        classes?:
          | { name: string; archived_at?: string | null }
          | { name: string; archived_at?: string | null }[]
          | null;
      }[]
    | null;
  student_guardians?:
    | {
        archived_at: string | null;
        guardians?:
          | { full_name: string; archived_at?: string | null }
          | { full_name: string; archived_at?: string | null }[]
          | null;
      }[]
    | null;
};

export const STUDENT_ERROR_MESSAGES: Record<string, string> = {
  "23505":
    "Bu öğrenci numarası kurumda zaten kullanımda. Farklı bir numara girin.",
  "23514":
    "Öğrenci numarası en fazla 32 karakter olmalı, başında ve sonunda boşluk bulunmamalıdır.",
  "42501":
    "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor.",
  ORB03:
    "Bu üyelik bir öğrenci kaydına bağlanamaz. Lütfen aynı kurumda rolü öğrenci olan başka bir üyelik seçin.",
  ORB04:
    "Bu kayıt veya hesap zaten başka bir bağa sahip. Önce mevcut bağı çözün.",
};

/**
 * Veritabanı ve RPC hata kodlarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 * Ham hata kodları arayüze sızdırılmaz.
 */
export function translateStudentError(error: unknown): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;

  if (typeof error === "object" && error !== null) {
    if (
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
    ) {
      code = (error as { code: string }).code;
    }
  }

  if (code && STUDENT_ERROR_MESSAGES[code]) {
    return STUDENT_ERROR_MESSAGES[code];
  }

  if (error instanceof Error) {
    for (const [knownCode, message] of Object.entries(STUDENT_ERROR_MESSAGES)) {
      if (error.message.includes(knownCode)) {
        return message;
      }
    }
    if (
      error.message &&
      !error.message.includes("PGRST") &&
      !error.message.includes("PostgREST")
    ) {
      return error.message;
    }
  }

  return "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.";
}

export function extractBranchName(branches: unknown): string | null {
  if (!branches) return null;
  if (Array.isArray(branches)) {
    return branches[0]?.name || null;
  }
  if (typeof branches === "object" && "name" in branches) {
    return (branches as { name: string }).name || null;
  }
  return null;
}

export function extractClassName(enrollments: unknown): string | null {
  if (!Array.isArray(enrollments)) return null;
  const active = enrollments.find(e => {
    if (!e || typeof e !== "object") return false;
    if (e.archived_at !== null && e.archived_at !== undefined) return false;
    const cls = e.classes;
    if (!cls || typeof cls !== "object") return false;
    const clsObj = Array.isArray(cls) ? cls[0] : cls;
    return (
      !clsObj || clsObj.archived_at === null || clsObj.archived_at === undefined
    );
  });

  if (!active) return null;
  const cls = active.classes;
  if (Array.isArray(cls)) {
    return cls[0]?.name || null;
  }
  return cls?.name || null;
}

export function extractGuardianName(links: unknown): string | null {
  if (!Array.isArray(links)) return null;
  const activeGuardians = links
    .filter(link => {
      if (!link || typeof link !== "object") return false;
      if (link.archived_at !== null && link.archived_at !== undefined)
        return false;
      const g = link.guardians;
      if (!g || typeof g !== "object") return false;
      const gObj = Array.isArray(g) ? g[0] : g;
      return (
        !gObj || gObj.archived_at === null || gObj.archived_at === undefined
      );
    })
    .map(link => {
      const g = link.guardians;
      if (Array.isArray(g)) {
        return g[0]?.full_name;
      }
      return g?.full_name;
    })
    .filter(
      (name): name is string =>
        typeof name === "string" && name.trim().length > 0
    );

  return activeGuardians.length > 0 ? activeGuardians.join(", ") : null;
}

export function mapStudentRow(
  row: RawStudentRow,
  attendancePercentage?: number,
  latestExamScore?: StudentLatestExamScore | number,
  paymentStatus?: "Güncel" | "Takip gerekli",
  homeworkRatio?: string
): Student {
  let score: number | undefined;
  let latestExamId: string | undefined;
  let latestExamName: string | undefined;
  let latestExamDate: string | undefined;
  let latestExamMaxScore: number | null | undefined;

  if (typeof latestExamScore === "number") {
    score = latestExamScore;
  } else if (typeof latestExamScore === "object" && latestExamScore !== null) {
    score = latestExamScore.score;
    latestExamId = latestExamScore.examId;
    latestExamName = latestExamScore.examName;
    latestExamDate = latestExamScore.examDate;
    latestExamMaxScore = latestExamScore.maxScore;
  }

  return {
    id: row.id,
    name: row.full_name,
    code: row.student_number ?? undefined,
    hasAccount: Boolean(row.auth_user_id),
    group: extractClassName(row.class_enrollments),
    branch: extractBranchName(row.branches),
    branchId: row.branch_id ?? null,
    parent: extractGuardianName(row.student_guardians),
    attendance: attendancePercentage,
    score,
    latestExamId,
    latestExamName,
    latestExamDate,
    latestExamMaxScore,
    payment: paymentStatus,
    homework: homeworkRatio,
    // Kaynağı olmayan ve henüz türetilmeyen alanlar dürüstçe undefined bırakılır:
    // risk: hesaplama kuralı henüz tanımlanmadı
  };
}

export async function loadStudents(
  organizationId: string,
  options?: LoadStudentsOptions
): Promise<StudentListResult> {
  const limit = options?.limit ?? DEFAULT_STUDENT_LIMIT;

  let query = supabase
    .from("students")
    .select(
      `
      id,
      full_name,
      student_number,
      auth_user_id,
      branch_id,
      branches ( name ),
      class_enrollments (
        archived_at,
        classes ( name, archived_at )
      ),
      student_guardians (
        archived_at,
        guardians ( full_name, archived_at )
      )
    `
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null);

  const term = options?.search?.trim();
  if (term) {
    // Türkçe arama (2026-10-03): `search_key` = search_fold(ad + numara);
    // "ilker" → "İlker", "isik" → "Işık". Bkz. turkishSearch.ts.
    query = query.ilike("search_key", searchPattern(term));
  }

  const { data, error } = await query
    .order("full_name", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error("Öğrenci listesi yüklenemedi.");
  }

  const rawRows = (data ?? []) as RawStudentRow[];
  const studentIds = rawRows.map(r => r.id);
  const [attendancePercentages, latestScores, paymentStatuses, homeworkRatios] =
    await Promise.all([
      loadStudentAttendancePercentages(studentIds),
      loadStudentLatestExamScores(studentIds),
      loadStudentPaymentStatuses(studentIds),
      loadStudentHomeworkRatios(studentIds),
    ]);

  const rows = rawRows.map(r =>
    mapStudentRow(
      r,
      attendancePercentages.get(r.id),
      latestScores.get(r.id),
      paymentStatuses.get(r.id),
      homeworkRatios.get(r.id)
    )
  );

  return {
    rows,
    truncated: rows.length === limit,
  };
}

export type CreateStudentInput = {
  organizationId: string;
  branchId: string;
  fullName: string;
  studentNumber?: string;
};

export async function createStudent(
  input: CreateStudentInput
): Promise<{ id: string }> {
  const payload: {
    organization_id: string;
    branch_id: string;
    full_name: string;
    student_number?: string | null;
  } = {
    organization_id: input.organizationId,
    branch_id: input.branchId,
    full_name: input.fullName,
  };

  if (input.studentNumber !== undefined) {
    payload.student_number = input.studentNumber;
  }

  const { data, error } = await supabase
    .from("students")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(translateStudentError(error));
  }

  return data;
}

export type UpdateStudentInput = {
  fullName?: string;
  branchId?: string;
  studentNumber?: string | null;
};

export async function updateStudent(
  studentId: string,
  input: UpdateStudentInput
): Promise<void> {
  const payload: {
    full_name?: string;
    branch_id?: string;
    student_number?: string | null;
  } = {};

  if (input.fullName !== undefined) {
    payload.full_name = input.fullName;
  }
  if (input.branchId !== undefined) {
    payload.branch_id = input.branchId;
  }
  if (input.studentNumber !== undefined) {
    payload.student_number = input.studentNumber;
  }

  const { data, error } = await supabase
    .from("students")
    .update(payload)
    .eq("id", studentId)
    .select("id");

  if (error) {
    throw new Error(translateStudentError(error));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Öğrenci bulunamadı veya güncellenemedi.");
  }
}

export async function archiveStudent(studentId: string): Promise<void> {
  const { data, error } = await supabase
    .from("students")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", studentId)
    .select("id");

  if (error) {
    throw new Error(translateStudentError(error));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Öğrenci bulunamadı veya arşivlenemedi.");
  }
}

export async function restoreStudent(studentId: string): Promise<void> {
  const { data, error } = await supabase
    .from("students")
    .update({ archived_at: null })
    .eq("id", studentId)
    .select("id");

  if (error) {
    throw new Error(translateStudentError(error));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Öğrenci bulunamadı veya geri yüklenemedi.");
  }
}

export async function linkStudentAccount(
  studentId: string,
  membershipId: string
): Promise<void> {
  const { error } = await supabase.rpc("link_student_account", {
    target_student_id: studentId,
    target_membership_id: membershipId,
  });

  if (error) {
    throw new Error(translateStudentError(error));
  }
}

export async function unlinkStudentAccount(studentId: string): Promise<void> {
  const { error } = await supabase.rpc("unlink_student_account", {
    target_student_id: studentId,
  });

  if (error) {
    throw new Error(translateStudentError(error));
  }
}
