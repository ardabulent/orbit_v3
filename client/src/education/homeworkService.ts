import { supabase } from "@/lib/supabaseClient";
import type { Homework, HomeworkStatus } from "@/components/education/types";
import { POSTGREST_MAX_ROWS } from "@/lib/postgrestLimits";
import { formatTrDate, getOrbitToday } from "./trDate";
import { readAllPages, PagedReadError } from "@/lib/pagedRead";

/**
 * Ödev servis katmanı (v1.4-05 · #273).
 *
 * `homework_assignments` tablosunu gerçek Supabase sorgularına bağlar.
 *
 * =========================================================================
 * Şemanın kısıtları ve kuralları
 * =========================================================================
 *
 * 1. Açık `organization_id` süzgeci şarttır (§4.12 kısıtı).
 * 2. `id` ve `assigned_by_membership_id` `authenticated` için salt okunurdur.
 *    Kayıt yüküne (`createHomework`) KESİNLİKLE konmaz. Atayan üyelik
 *    `set_homework_assigner` tetikleyicisi tarafından doldurulur.
 * 3. UPDATE yetkisi yalnız 5 sütundadır: `title`, `description`, `due_date`,
 *    `subject_id`, `archived_at`. Başka sütun SET edilemez; `.upsert()` kullanılmaz.
 * 4. Silme yoktur: arşiv deseni (`archived_at`) kullanılır.
 * 5. Durum türetimi: "Tamamlandı" yoktur. Teslim tablosu olmadığı için durum
 *    `due_date < getOrbitToday()` ile "Süresi Doldu" ya da "Aktif" olarak türetilir.
 * 6. Ders adı: Sabit tipten değil `subjects` tablosundan okunur. `subject_id` boşsa
 *    ders rozeti çizilmez; "Genel" gibi bir etiket uydurulmaz (K-22).
 * 7. Atayan adı: `class_staff_names` RPC fonksiyonu üzerinden çözülür.
 *    Çözülemezse `null` bırakılır; isim uydurulmaz (K-22).
 */

/**
 * Listenin toplam tavanı (2026-10-05). Eskiden tek sorguda 100'dü; 300
 * öğrencili kurumda liste eksik kalıyordu. Artık sayfa sayfa
 * (`lib/pagedRead.ts`) bu tavana kadar okunur.
 */
export const HOMEWORK_TOTAL_CAP = 5000;

/** Tek ödevin teslim listesi; tek sorgu, sunucu tavanının altında (bir sınıf). */
export const DEFAULT_SUBMISSION_LIMIT = 500;

// `POSTGREST_MAX_ROWS` v1.5-09'da `@/lib/postgrestLimits`'e taşındı: platformun
// tamamına ait bir gerçek, tek bir özelliğin servis dosyasına değil (K-06).

export type HomeworkListResult = {
  rows: Homework[];
  truncated: boolean;
};

export type HomeworkSubmissionItem = {
  id: string;
  organizationId: string;
  homeworkId: string;
  studentId: string;
  recordedByMembershipId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HomeworkSubmissionListResult = {
  rows: HomeworkSubmissionItem[];
  truncated: boolean;
};

export type CreateHomeworkInput = {
  organizationId: string;
  classId: string;
  subjectId?: string | null;
  title: string;
  description?: string | null;
  dueDate: string;
  assignedOn?: string;
};

export type UpdateHomeworkInput = {
  title?: string;
  description?: string | null;
  dueDate?: string;
  subjectId?: string | null;
  archivedAt?: string | null;
};

export type SubjectDetail = {
  id: string;
  name: string;
};

export type RawHomeworkRow = {
  id: string;
  organization_id: string;
  class_id: string;
  subject_id?: string | null;
  title: string;
  description?: string | null;
  assigned_by_membership_id?: string | null;
  assigned_on: string;
  due_date: string;
  submissions_recorded_at?: string | null;
  archived_at?: string | null;
  classes?:
    | { id?: string; name: string; archived_at?: string | null }
    | { id?: string; name: string; archived_at?: string | null }[]
    | null;
  subjects?:
    | { id?: string; name: string; archived_at?: string | null }
    | { id?: string; name: string; archived_at?: string | null }[]
    | null;
};

/**
 * Ödev işlemlerinde oluşan veritabanı hatalarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 */
export function translateHomeworkError(error: unknown): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  let message = "";
  if (typeof error === "object" && error !== null) {
    if ("code" in error) {
      code = String((error as { code: unknown }).code);
    }
    if (
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    ) {
      message = (error as { message: string }).message;
    }
  } else if (error instanceof Error) {
    message = error.message;
    for (const known of ["42501", "23503", "23514"]) {
      if (error.message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "42501") {
    return "Bu işlem için yetkiniz yok veya şifre değişimi bekleniyor. Ödev kaydını yalnızca kurum yöneticisi veya sınıfın öğretmeni oluşturabilir ve güncelleyebilir.";
  }
  if (code === "23503") {
    return "Seçilen sınıf veya ders bulunamadı ya da arşivlenmiş. Listeyi tazeleyip tekrar deneyin.";
  }
  if (code === "23514") {
    if (message.includes("homework_assignments_due_check")) {
      return "Son teslim tarihi ödevin verildiği tarihten önce olamaz.";
    }
    return "Ödev başlığı 1 ile 200 karakter arasında olmalıdır.";
  }

  if (message && !message.includes("PGRST") && !message.includes("PostgREST")) {
    return message;
  }

  return "Ödev işlemi sırasında bir hata oluştu.";
}

/**
 * Ödev teslim işlemlerinde oluşan veritabanı hatalarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 * Ham hata kodları veya PostgREST detayları arayüze sızdırılmaz (K-19).
 */
export function translateHomeworkSubmissionError(error: unknown): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  let message = "";
  if (typeof error === "object" && error !== null) {
    if ("code" in error) {
      code = String((error as { code: unknown }).code);
    }
    if (
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    ) {
      message = (error as { message: string }).message;
    }
  } else if (error instanceof Error) {
    message = error.message;
    for (const known of ["42501", "23505", "ORB02"]) {
      if (error.message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "ORB02" || message.includes("ORB02")) {
    return "Öğrenci bu ödevin sınıfına kayıtlı değil.";
  }
  if (code === "23505" || message.includes("23505")) {
    return "Bu öğrencinin ödev teslimi zaten işaretlenmiş.";
  }
  if (code === "42501" || message.includes("42501")) {
    return "Bu işlem için yetkiniz yok veya şifre değişimi bekleniyor. Ödev teslimini yalnızca kurum yöneticisi veya sınıfın öğretmeni işaretleyebilir.";
  }

  if (message && !message.includes("PGRST") && !message.includes("PostgREST")) {
    return message;
  }

  return "Ödev teslim işlemi sırasında bir hata oluştu.";
}

export function extractClassName(classes: unknown): string | null {
  if (!classes) return null;
  const clsObj = Array.isArray(classes) ? classes[0] : classes;
  if (!clsObj || typeof clsObj !== "object") return null;
  const cls = clsObj as { name?: string; archived_at?: string | null };
  if (cls.archived_at !== null && cls.archived_at !== undefined) {
    return null;
  }
  return cls.name?.trim() || null;
}

export function extractSubjectName(subjects: unknown): string | null {
  if (!subjects) return null;
  const subObj = Array.isArray(subjects) ? subjects[0] : subjects;
  if (!subObj || typeof subObj !== "object") return null;
  const sub = subObj as { name?: string; archived_at?: string | null };
  if (sub.archived_at !== null && sub.archived_at !== undefined) {
    return null;
  }
  return sub.name?.trim() || null;
}

export async function loadStaffNames(
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

/**
 * Sınıfların AKTİF öğrenci KİMLİKLERİ.
 *
 * ⚠️ Sayı değil **kimlik** döner ve sebebi bir kusurun düzeltilmesi: payda ile
 * pay farklı kümelerden geliyordu. Sınıftan ayrılmış bir öğrencinin geçmiş
 * teslimi sayılıyor ama kendisi paydaya girmiyordu; 10 aktif öğrencilik bir
 * sınıfta 12 teslim çıkabiliyordu. Kimlik döndürünce payda **birleşim** olarak
 * kurulabiliyor ve uydurulmuş bir sayı olmuyor.
 */
async function loadClassStudentIds(
  organizationId: string,
  classIds: string[],
  limit = POSTGREST_MAX_ROWS
): Promise<Map<string, Set<string>> | null> {
  const unique = Array.from(new Set(classIds.filter(Boolean)));
  if (unique.length === 0 || !organizationId) return new Map();
  // null = "ölçülemedi" (tavan ya da hata). Boş Map = "ölçüldü, kimse yok".
  // İkisi ayrı şeyler: ilki sayı ÜRETTİRMEZ, ikincisi 0 üretir.

  try {
    const query = supabase.from("class_enrollments");
    if (!query || typeof query.select !== "function") return new Map();

    const { data, error } = await query
      .select("class_id, student_id")
      .eq("organization_id", organizationId)
      .in("class_id", unique)
      .is("archived_at", null)
      .limit(limit);

    if (error || !data) return null;

    // R2-B: Tavana dayanıldığında veri kesilmiş olabilir; yarım sayı üretmektense ÖLÇÜLEMEDİ denir.
    if (data.length >= limit) {
      return null;
    }

    const idMap = new Map<string, Set<string>>();
    for (const row of data as { class_id: string; student_id: string }[]) {
      if (!row.class_id || !row.student_id) continue;
      let set = idMap.get(row.class_id);
      if (!set) {
        set = new Set();
        idMap.set(row.class_id, set);
      }
      set.add(row.student_id);
    }
    return idMap;
  } catch {
    return null;
  }
}

/** Ödevlerin teslim eden öğrenci KİMLİKLERİ (bkz. `loadClassStudentIds`). */
async function loadHomeworkSubmitterIds(
  organizationId: string,
  homeworkIds: string[],
  limit = POSTGREST_MAX_ROWS
): Promise<Map<string, Set<string>> | null> {
  const unique = Array.from(new Set(homeworkIds.filter(Boolean)));
  if (unique.length === 0 || !organizationId) return new Map();

  try {
    const query = supabase.from("homework_submissions");
    if (!query || typeof query.select !== "function") return new Map();

    const { data, error } = await query
      .select("homework_id, student_id")
      .eq("organization_id", organizationId)
      .in("homework_id", unique)
      .is("archived_at", null)
      .limit(limit);

    if (error || !data) return null;

    // R2-B: Tavana dayanıldığında veri kesilmiş olabilir; yarım sayı üretmektense ÖLÇÜLEMEDİ denir.
    if (data.length >= limit) {
      return null;
    }

    const idMap = new Map<string, Set<string>>();
    for (const row of data as { homework_id: string; student_id: string }[]) {
      if (!row.homework_id || !row.student_id) continue;
      let set = idMap.get(row.homework_id);
      if (!set) {
        set = new Set();
        idMap.set(row.homework_id, set);
      }
      set.add(row.student_id);
    }
    return idMap;
  } catch {
    return null;
  }
}

export function mapHomeworkRow(
  row: RawHomeworkRow,
  staffNames: Map<string, string>,
  today: string = getOrbitToday(),
  submissionCount?: number,
  totalStudents?: number
): Homework {
  const className = extractClassName(row.classes);
  const subjectName = row.subject_id ? extractSubjectName(row.subjects) : null;
  const assignedBy = row.assigned_by_membership_id
    ? (staffNames.get(row.assigned_by_membership_id) ?? null)
    : null;

  const isRecorded = Boolean(row.submissions_recorded_at);
  const isOverdue = row.due_date < today;

  // ⚠️ Burada `Math.max(totalStudents, submissionCount)` YOK ve olmamalı.
  // İlk düzeltmede "12 / 10" görünmesin diye payda öyle şişirilmişti; bu
  // **uydurulmuş bir payda** üretiyordu (10 aktif + 2 ayrılmış teslimci =
  // gerçekte 12 kişilik kümede "7 / 10" yazıyordu) ve daha kötüsü, durumu
  // bozuyordu: `submissionCount > totalStudents` olduğu an koşul HER ZAMAN
  // doğru oluyor ve ödev "Tamamlandı" görünüyordu — mevcut sınıfın yarısı
  // getirmemişken. Payda artık çağıranda **birleşim** olarak kuruluyor.
  // ⚠️ Tutarsız çift savunması: pay paydadan büyükse iki sayı **aynı kümeden
  // gelmiyor** demektir. Böyle bir çiftten "Tamamlandı" türetmek bilinmeyen bir
  // şeyi iddia etmek olur; payda da uydurulmaz, olduğu gibi bırakılır.
  const tutarsiz =
    totalStudents !== undefined &&
    submissionCount !== undefined &&
    submissionCount > totalStudents;

  const effectiveTotalStudents =
    totalStudents !== undefined && totalStudents > 0 && !tutarsiz
      ? totalStudents
      : undefined;

  let status: HomeworkStatus;
  // R2-C: submissions_recorded_at boşken durum "Tamamlandı" OLAMAZ!
  if (
    isRecorded &&
    effectiveTotalStudents !== undefined &&
    effectiveTotalStudents > 0 &&
    submissionCount !== undefined &&
    submissionCount >= effectiveTotalStudents
  ) {
    status = "Tamamlandı";
  } else {
    status = isOverdue ? "Süresi Doldu" : "Aktif";
  }

  return {
    id: row.id,
    classId: row.class_id,
    classGroup: className || "",
    subjectId: row.subject_id || null,
    subject: subjectName,
    title: row.title,
    description: row.description || "",
    assignedBy,
    assignedDate: formatTrDate(row.assigned_on),
    dueDate: formatTrDate(row.due_date),
    rawDueDate: row.due_date,
    status,
    // Ek madde 2: İşaretlemesi bitmiş bir ödevde 0 teslim dürüst bir bilgidir, korunur.
    submissionCount:
      submissionCount !== undefined
        ? isRecorded
          ? submissionCount
          : submissionCount > 0
            ? submissionCount
            : undefined
        : undefined,
    totalStudents: effectiveTotalStudents,
    submissionsRecordedAt: row.submissions_recorded_at ?? null,
  };
}

/**
 * Kurumun aktif ödevlerini listeler.
 * Açık `organization_id` süzgeci taşır (§4.12 kısıtı).
 * Açık `.limit(limit)` ile PostgREST tavanını yönetir ve `truncated` bayrağı döner.
 */
export async function loadHomework(
  organizationId: string,
  options?: { limit?: number }
): Promise<HomeworkListResult> {
  const limit = options?.limit ?? HOMEWORK_TOTAL_CAP;

  const page = (from: number, to: number) =>
    supabase
      .from("homework_assignments")
      .select(
        `
      id,
      organization_id,
      class_id,
      subject_id,
      title,
      description,
      assigned_by_membership_id,
      assigned_on,
      due_date,
      submissions_recorded_at,
      archived_at,
      classes ( id, name, archived_at ),
      subjects ( id, name, archived_at )
    `
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("due_date", { ascending: true })
      .order("id", { ascending: false })
      .range(from, to);

  let rawRows: RawHomeworkRow[];
  let truncated: boolean;
  try {
    ({ rows: rawRows, truncated } = await readAllPages<RawHomeworkRow>(
      page,
      limit
    ));
  } catch (err) {
    if (err instanceof PagedReadError) {
      throw new Error(translateHomeworkError(err.cause), { cause: err });
    }
    throw err;
  }
  const classIds = rawRows.map(r => r.class_id).filter(Boolean);
  const homeworkIds = rawRows.map(r => r.id);
  const today = getOrbitToday();

  const [staffNames, classStudentIds, homeworkSubmitterIds] = await Promise.all(
    [
      loadStaffNames(classIds),
      loadClassStudentIds(organizationId, classIds),
      loadHomeworkSubmitterIds(organizationId, homeworkIds),
    ]
  );

  const rows = rawRows.map(row => {
    const submitters = homeworkSubmitterIds?.get(row.id);
    const classStudents = classStudentIds?.get(row.class_id);
    const olculdu = homeworkSubmitterIds !== null && classStudentIds !== null;

    // Payda, payın geldiği kümeyle AYNI olmak zorunda: sınıfın aktif
    // öğrencileri **birleşim** teslim edenler. Sınıftan ayrılmış bir öğrencinin
    // teslimi sayılıyorsa kendisi de paydaya girer; girmezse "12 / 10" gibi bir
    // oran ya da uydurulmuş bir payda çıkar (**K-03**).
    const total =
      !olculdu || classStudents === undefined
        ? undefined
        : new Set([...classStudents, ...(submitters ?? [])]).size;

    return mapHomeworkRow(
      row,
      staffNames,
      today,
      olculdu ? (submitters?.size ?? 0) : undefined,
      total
    );
  });

  return {
    rows,
    truncated,
  };
}

/**
 * Yeni bir ödev kaydı oluşturur.
 *
 * ⛔ 1. YASAK (ÖLÇÜLDÜ): Yüke `id` ve `assigned_by_membership_id` KOYMA!
 * `homework_assignments.id` ve `assigned_by_membership_id` authenticated için salt okunurdur.
 * Atayan üyeliği tetikleyici doldurur; kimliği veritabanı üretir.
 */
export async function createHomework(
  input: CreateHomeworkInput
): Promise<{ id: string }> {
  const payload: {
    organization_id: string;
    class_id: string;
    subject_id?: string | null;
    title: string;
    description?: string | null;
    due_date: string;
    assigned_on?: string;
  } = {
    organization_id: input.organizationId,
    class_id: input.classId,
    title: input.title.trim(),
    due_date: input.dueDate,
  };

  if (input.subjectId) {
    payload.subject_id = input.subjectId;
  }
  if (input.description !== undefined && input.description !== null) {
    payload.description = input.description.trim() || null;
  }
  if (input.assignedOn) {
    payload.assigned_on = input.assignedOn;
  }

  const { data, error } = await supabase
    .from("homework_assignments")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(translateHomeworkError(error));
  }

  return { id: data.id };
}

/**
 * Mevcut bir ödevi günceller.
 * Açık `organization_id` ve `id` süzgeci taşır (§4.12 kısıtı).
 *
 * ⛔ 2. YASAK (ÖLÇÜLDÜ): Yalnız izin verilen beş sütun SET edilebilir!
 * `title`, `description`, `due_date`, `subject_id`, `archived_at`.
 */
export async function updateHomework(
  organizationId: string,
  homeworkId: string,
  updates: UpdateHomeworkInput
): Promise<void> {
  const payload: {
    title?: string;
    description?: string | null;
    due_date?: string;
    subject_id?: string | null;
    archived_at?: string | null;
  } = {};

  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.description !== undefined) {
    payload.description = updates.description?.trim() || null;
  }
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
  if (updates.subjectId !== undefined) payload.subject_id = updates.subjectId;
  if (updates.archivedAt !== undefined)
    payload.archived_at = updates.archivedAt;

  const { data, error } = await supabase
    .from("homework_assignments")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", homeworkId)
    .select("id");

  if (error) {
    throw new Error(translateHomeworkError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ödev bulunamadı veya güncellenemedi.");
  }
}

/**
 * Bir ödevi arşivler (archived_at ile).
 * Açık `organization_id` ve `id` süzgeci taşır (§4.12 kısıtı).
 */
export async function archiveHomework(
  organizationId: string,
  homeworkId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("homework_assignments")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", homeworkId)
    .select("id");

  if (error) {
    throw new Error(translateHomeworkError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ödev bulunamadı veya arşivlenemedi.");
  }
}

/**
 * Arşivlenmiş bir ödevi geri yükler.
 * Açık `organization_id` ve `id` süzgeci taşır (§4.12 kısıtı).
 */
export async function restoreHomework(
  organizationId: string,
  homeworkId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("homework_assignments")
    .update({ archived_at: null })
    .eq("organization_id", organizationId)
    .eq("id", homeworkId)
    .select("id");

  if (error) {
    throw new Error(translateHomeworkError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ödev bulunamadı veya geri yüklenemedi.");
  }
}

/**
 * Bir ödeve ait aktif teslimleri listeler.
 * Açık `organization_id` ve `homework_id` süzgeci taşır (§4.12 kısıtı).
 * Açık `.limit(limit)` ile PostgREST tavanını yönetir ve `truncated` bayrağı döner.
 */
export async function loadHomeworkSubmissions(
  organizationId: string,
  homeworkId: string,
  options?: { limit?: number }
): Promise<HomeworkSubmissionListResult> {
  const limit = options?.limit ?? DEFAULT_SUBMISSION_LIMIT;

  const { data, error } = await supabase
    .from("homework_submissions")
    .select(
      `
      id,
      organization_id,
      homework_id,
      student_id,
      recorded_by_membership_id,
      archived_at,
      created_at,
      updated_at
    `
    )
    .eq("organization_id", organizationId)
    .eq("homework_id", homeworkId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(translateHomeworkSubmissionError(error));
  }

  const rawRows = (data ?? []) as {
    id: string;
    organization_id: string;
    homework_id: string;
    student_id: string;
    recorded_by_membership_id: string;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
  }[];

  const rows: HomeworkSubmissionItem[] = rawRows.map(r => ({
    id: r.id,
    organizationId: r.organization_id,
    homeworkId: r.homework_id,
    studentId: r.student_id,
    recordedByMembershipId: r.recorded_by_membership_id,
    archivedAt: r.archived_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return {
    rows,
    truncated: rawRows.length === limit,
  };
}

/**
 * Bir öğrencinin ödev teslimini işaretler (yeni satır ekler).
 *
 * ⛔ 1. YASAK (ÖLÇÜLDÜ): Yüke `id` ve `recorded_by_membership_id` KOYMA!
 * `id` veritabanı tarafından üretilir. `recorded_by_membership_id` tetikleyici
 * (`set_homework_submission_recorder`) tarafından doldurulur ve authenticated yetkisinde yoktur.
 */
export async function markSubmission(
  organizationId: string,
  homeworkId: string,
  studentId: string
): Promise<{ id: string }> {
  const payload = {
    organization_id: organizationId,
    homework_id: homeworkId,
    student_id: studentId,
  };

  const { data, error } = await supabase
    .from("homework_submissions")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(translateHomeworkSubmissionError(error));
  }

  return { id: data.id };
}

/**
 * Bir ödev tesliminin işaretini kaldırır (satırı arşivler).
 * Açık `organization_id` ve `id` süzgeci taşır (§4.12 kısıtı).
 * UPDATE yetkisi yalnız `archived_at` sütunundadır.
 *
 * K-14: Sıfır satır etkilendiğinde hata fırlatılır.
 */
export async function unmarkSubmission(
  organizationId: string,
  submissionId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("homework_submissions")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", submissionId)
    .select("id");

  if (error) {
    throw new Error(translateHomeworkSubmissionError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ödev teslimi bulunamadı veya işareti kaldırılamadı.");
  }
}

/**
 * Bir ödevin teslim işaretleme sürecinin tamamlandığını veya yeniden açıldığını kaydeder (v1.4-15 R1).
 * Öğretmen "işaretlemeyi bitirdim" dediğinde `submissions_recorded_at` zaman damgasıyla dolar;
 * geri alındığında `null` yapılır.
 *
 * K-14: Sıfır satır etkilendiğinde hata fırlatılır.
 */
export async function setSubmissionsRecorded(
  organizationId: string,
  homeworkId: string,
  recorded: boolean
): Promise<{ submissionsRecordedAt: string | null }> {
  const timestamp = recorded ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("homework_assignments")
    .update({ submissions_recorded_at: timestamp })
    .eq("organization_id", organizationId)
    .eq("id", homeworkId)
    .select("id, submissions_recorded_at");

  if (error) {
    throw new Error(translateHomeworkError(error));
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Ödev kaydı bulunamadı veya güncelleme gerçekleştirilemedi."
    );
  }

  return { submissionsRecordedAt: timestamp };
}

/**
 * Verilen öğrencilerin ödev teslim oranlarını toplu (batch) olarak getirir
 * (v1.4-15 · #294 / R1 · sunucuya taşındı v1.5-17 · #308).
 * `studentService` içinden tek seferde çağrılır. N+1 sorgusu yapılmaz (K-06).
 *
 * 🔴 R1 Kararı: Bir ödevin oran hesaplamasına dahil edilmesi (takip ediliyor sayılması),
 * ancak öğretmenin teslim işaretlemesini bitirdiğini beyan etmesiyle
 * (`submissions_recorded_at is not null`) mümkündür.
 *
 * Yarım işaretlenmiş (öğretmenin henüz tamamlamadığı) ödevler orana HİÇ GİRMEZ (ne payda ne pay).
 * İşaretlemesi bitirilmiş hiçbir ödev yoksa öğrenci için oran üretilmez (`undefined`).
 *
 * 🔴 **Sayım artık istemcide yapılmıyor ve sebebi ölçüldü** (ROADMAP §4.17).
 * Eski hali üç ardışık PostgREST çağrısıydı (sınıf kayıtları → bitirilmiş ödevler
 * → teslimler) ve üçünün tavanı `POSTGREST_MAX_ROWS`'du. Bir dershane-yılı
 * tohumlanınca kolon **hiç çalışmadı**: 217 ödev kimliğinde URL 8.184 karaktere
 * çıkıp HTTP 414 döndü, ~55 ödevde teslim sorgusu 1.000 satır tavanına dayandı,
 * 20 sınıfta ödev adımı 960/1000'e geldi. Üç yol da `new Map()`'e çıkıyordu ve
 * arayüz tanımsız değeri satırı hiç çizmeyerek gösterdiği için eksiklik
 * **görünmüyordu**.
 *
 * `student_homework_ratios` toplamayı sunucuda yapıyor: dönen satır sayısı
 * istenen öğrenci sayısına eşit (ekranda en fazla 100), yani tavan da URL sınırı
 * da devre dışı. Üç tur bire indi.
 *
 * ⚠️ Yetki yüzeyi genişletilmedi: fonksiyon `security definer` ama yetkiyi
 * `class_enrollments` / `homework_assignments` / `homework_submissions`
 * politikalarının **kesişimi** olarak veriyor. Bir öğrenci sınıf arkadaşının
 * oranını görmüyor — bugün görüyordu ve gördüğü sayı (pay hep 0) yanlıştı.
 * Ayrıntı migration başlığında (20260921000000).
 */
export async function loadStudentHomeworkRatios(
  studentIds: string[]
): Promise<Map<string, string>> {
  const uniqueStudentIds = Array.from(
    new Set(studentIds.filter(id => Boolean(id) && typeof id === "string"))
  );
  if (uniqueStudentIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("student_homework_ratios", {
    target_student_ids: uniqueStudentIds,
  });

  if (error || !data) {
    // Fail-closed (K-04): Veritabanı hatasında uydurma oran üretilmez
    return new Map();
  }

  const resultMap = new Map<string, string>();

  for (const row of data as {
    student_id: string;
    recorded_count: number | string | bigint;
    submitted_count: number | string | bigint;
  }[]) {
    const studentId = row.student_id;
    if (!studentId) continue;

    const recorded = Number(row.recorded_count);
    const submitted = Number(row.submitted_count);

    // R1 & K-22: Sayı okunamıyorsa oran uydurulmaz. Sunucu sorumluluğu olmayan
    // öğrenciyi hiç döndürmüyor, ama bozuk bir satır gelirse de sessizce atlanır.
    if (!Number.isFinite(recorded) || !Number.isFinite(submitted)) continue;
    if (recorded <= 0) continue;

    resultMap.set(studentId, `${submitted}/${recorded}`);
  }

  return resultMap;
}
