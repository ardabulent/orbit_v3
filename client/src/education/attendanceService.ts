import { supabase } from "@/lib/supabaseClient";
import type { AttendanceState } from "@/components/education/types";
import {
  ATTENDANCE_DB_STATUSES,
  dbStatusToAttendanceState,
  type AttendanceDbStatus,
} from "./attendanceStatus";

/**
 * Yoklama servis katmanı (v1.3-01 · C parçası, v1.4-03 · #268).
 *
 * `attendance_sessions` ve `attendance_records` tablolarını gerçek Supabase sorgularına bağlar.
 *
 * **Açık `organization_id` filtresi (ROADMAP §4.12, #249):** RLS tek başına süzdüğünde
 * Postgres sorgu planlayıcısı `organization_id` indeksini kullanamıyor. Bu nedenle
 * performans kısıtı olarak tüm yoklama sorgularına açık `.eq("organization_id", organizationId)` eklenir.
 *
 * **⚠️ Arşiv filtresi tuzağı (K-06):**
 * `attendance_records` tablosunda `archived_at` sütunu YOK; `attendance_sessions` tablosunda VAR.
 * Bu nedenle doğrudan `attendance_records` üzerinde `archived_at is null` filtresi uygulanamaz;
 * sorgu `attendance_sessions!inner` üzerinden arşiv durumunu denetler.
 *
 * **Sıralama açık yazılır:** En son oturum için önce oturum tarihi (`session_date` azalan),
 * sonra başlangıç saati (`starts_at` azalan) sıralanır.
 *
 * **Devam yüzdesi formülü (DECISION_LOG 2026-09-08):**
 * Devam % = (Katıldı + Geç kaldı) / (Katıldı + Geç kaldı + Gelmedi) * 100
 * İzinli (excused) ne paya ne paydaya katılır. Payda sıfır ise yüzde hesaplanmaz,
 * kesinlikle `0` değil `undefined` döner (K-22).
 */

export const DEFAULT_ATTENDANCE_SESSION_LIMIT = 50;

export type AttendanceRecordDetail = {
  id: string;
  studentId: string;
  studentName: string;
  status: AttendanceState | null;
};

export type AttendanceSessionDetail = {
  id: string;
  classId: string;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  sessionDate: string;
  startsAt: string | null;
  records: AttendanceRecordDetail[];
};

export type LatestAttendanceSessionResult = {
  session: AttendanceSessionDetail | null;
};

export type AttendanceSessionListResult = {
  rows: AttendanceSessionDetail[];
  truncated: boolean;
};

/**
 * Devam yüzdesi formülü (DECISION_LOG 2026-09-08):
 *
 * Devam % = (Katıldı + Geç kaldı) / (Katıldı + Geç kaldı + Gelmedi) * 100
 *
 * - Geç kalma devam sayılır (öğrenci derstedir).
 * - İzinli dersler (excused) ne paya ne paydaya katılır (kurum onaylı muafiyet).
 * - Payda (Katıldı + Geç kaldı + Gelmedi) sıfır ise yüzde HESAPLANMAZ;
 *   kesinlikle `0` değil `undefined` döner (K-22: yokluk etiketi de bir iddiadır).
 */
export function calculateAttendancePercentage(counts: {
  present: number;
  late: number;
  absent: number;
}): number | undefined {
  const numerator = counts.present + counts.late;
  const denominator = counts.present + counts.late + counts.absent;
  if (denominator === 0) {
    return undefined;
  }
  return Math.round((numerator / denominator) * 100);
}

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/**
 * Oturum tarih ve saatini Türkçe arayüz formatına çevirir (ör. "8 Eylül 2026, 09:00" veya "8 Eylül 2026").
 */
export function formatSessionDateTime(
  sessionDate: string,
  startsAt?: string | null
): string {
  if (!sessionDate) return "";
  const parts = sessionDate.split("-");
  if (parts.length !== 3) return sessionDate;

  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const monthName = TR_MONTHS[monthIdx] || parts[1];
  const dateStr = `${day} ${monthName} ${year}`;

  if (startsAt) {
    const timeStr = startsAt.slice(0, 5);
    return `${dateStr}, ${timeStr}`;
  }
  return dateStr;
}

/**
 * Oturum başlık metnini oluşturur (v1.3-01c · 2.C).
 *
 * Örnek: "TYT Matematik · YKS 12-A · 8 Eylül 2026, 09:00"
 * Günlük yoklamada (subject_id boş): "Günlük Yoklama · YKS 12-A · 8 Eylül 2026"
 */
export function formatSessionTitle(session: AttendanceSessionDetail): string {
  const titleParts: string[] = [];
  if (session.subjectName) {
    titleParts.push(session.subjectName);
  } else {
    titleParts.push("Günlük Yoklama");
  }

  if (session.className) {
    titleParts.push(session.className);
  }

  const dt = formatSessionDateTime(session.sessionDate, session.startsAt);
  if (dt) {
    titleParts.push(dt);
  }

  return titleParts.join(" · ");
}

export function extractActiveName(relation: unknown): string | null {
  if (!relation) return null;
  const obj = Array.isArray(relation) ? relation[0] : relation;
  if (!obj || typeof obj !== "object") return null;
  const item = obj as { name?: string; archived_at?: string | null };
  if (item.archived_at !== null && item.archived_at !== undefined) {
    return null;
  }
  return item.name?.trim() || null;
}

type RawAttendanceRecord = {
  id: string;
  student_id: string;
  status: string;
  students?:
    | { id?: string; full_name?: string; archived_at?: string | null }
    | { id?: string; full_name?: string; archived_at?: string | null }[]
    | null;
};

type RawAttendanceSessionRow = {
  id: string;
  class_id: string;
  subject_id?: string | null;
  session_date: string;
  starts_at?: string | null;
  archived_at?: string | null;
  classes?:
    | { id?: string; name: string; archived_at?: string | null }
    | { id?: string; name: string; archived_at?: string | null }[]
    | null;
  subjects?:
    | { id?: string; name: string; archived_at?: string | null }
    | { id?: string; name: string; archived_at?: string | null }[]
    | null;
  attendance_records?: RawAttendanceRecord[] | null;
};

export function mapSessionRow(
  row: RawAttendanceSessionRow
): AttendanceSessionDetail {
  const className = extractActiveName(row.classes);
  const subjectName = extractActiveName(row.subjects);

  const rawRecords = Array.isArray(row.attendance_records)
    ? row.attendance_records
    : [];
  const records: AttendanceRecordDetail[] = rawRecords.map(r => {
    const studentObj = Array.isArray(r.students) ? r.students[0] : r.students;
    const studentName = studentObj?.full_name?.trim() || "";
    return {
      id: r.id,
      studentId: r.student_id,
      studentName,
      status: dbStatusToAttendanceState(r.status),
    };
  });

  // Kayıtları öğrenci adına göre alfabetik sırala
  records.sort((a, b) => a.studentName.localeCompare(b.studentName, "tr"));

  return {
    id: row.id,
    classId: row.class_id,
    className,
    subjectId: row.subject_id || null,
    subjectName,
    sessionDate: row.session_date,
    startsAt: row.starts_at ? row.starts_at.slice(0, 5) : null,
    records,
  };
}

/**
 * Öğrencilerin devam yüzdelerini toplu olarak hesaplar (v1.3-01c · Revizyon 1).
 *
 * İstemciye binlerce ham yoklama satırını taşımak ve istemcide saymak yerine,
 * sayım işi doğrudan veritabanındaki `student_attendance_counts` RPC fonksiyonuna
 * bırakılır. Böylece sessiz satır sınırı ve bellek/ağ yükü ortadan kalkar.
 *
 * Fonksiyon öğrenci başına (present_count, late_count, absent_count) döner.
 * `excused` ve arşivlenmiş oturumların kayıtları veritabanında filtrelenmiştir.
 *
 * Yüzde hesabı istemcide `calculateAttendancePercentage` ile yapılır;
 * payda sıfır ise (veya hiç kayıt yoksa) değer kesinlikle `0` değil `undefined` kalır (K-22).
 *
 * `studentService` içinden tek seferde çağrılır. N+1 sorgusu yapılmaz (K-06).
 */
export async function loadStudentAttendancePercentages(
  studentIds: string[]
): Promise<Map<string, number>> {
  const uniqueIds = Array.from(
    new Set(studentIds.filter(id => Boolean(id) && typeof id === "string"))
  );
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("student_attendance_counts", {
    target_student_ids: uniqueIds,
  });

  if (error || !data) {
    // Fail-closed (K-04): Veritabanı hatasında uydurma yüzde üretilmez
    return new Map();
  }

  const resultMap = new Map<string, number>();

  for (const row of data as {
    student_id: string;
    present_count: number | string | bigint;
    late_count: number | string | bigint;
    absent_count: number | string | bigint;
  }[]) {
    const studentId = row.student_id;
    if (!studentId) continue;

    const present = Number(row.present_count) || 0;
    const late = Number(row.late_count) || 0;
    const absent = Number(row.absent_count) || 0;

    const percentage = calculateAttendancePercentage({
      present,
      late,
      absent,
    });
    if (percentage !== undefined) {
      resultMap.set(studentId, percentage);
    }
  }

  return resultMap;
}

export type AttendanceEntryInput = {
  student_id: string;
  status: AttendanceDbStatus;
};

export type OpenAttendanceSessionInput = {
  organizationId: string;
  classId: string;
  sessionDate: string;
  /**
   * Ders yoklaması (karar 2026-09-28, `20261006000000`): programdaki dersin
   * dersi ve başlangıç saati. Dersi olmayan satırda (etüt) `subjectId` boş,
   * saat dolu. İkisi de boşsa eski düzen günlük oturum açılır — o oturum
   * günün bütün derslerini kapsar; yeni ekran bunu açmaz.
   */
  subjectId?: string | null;
  startsAt?: string | null;
};

export type AttendanceSheetStudent = {
  studentId: string;
  studentName: string;
  studentCode?: string;
  status: AttendanceState | null;
};

export type AttendanceSheet = {
  session: {
    id: string;
    classId: string;
    className: string | null;
    subjectId: string | null;
    subjectName: string | null;
    sessionDate: string;
    startsAt: string | null;
  };
  students: AttendanceSheetStudent[];
};

/**
 * Yoklama işlemlerinde oluşan veritabanı hatalarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 */
export function translateAttendanceError(error: unknown): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  if (typeof error === "object" && error !== null && "code" in error) {
    code = String((error as { code: unknown }).code);
  } else if (error instanceof Error) {
    for (const known of [
      "ORB02",
      "42501",
      "23503",
      "22P02",
      "23505",
      "22023",
    ]) {
      if (error.message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "ORB02") {
    return "Öğrenci bu sınıfa kayıtlı değil. Önce öğrenciyi sınıfa kaydedin (Sınıflar ekranından).";
  }
  if (code === "42501") {
    return "Bu yoklamayı kaydetme yetkiniz yok. Yoklamayı yalnızca kurum yöneticisi veya sınıfın öğretmeni kaydedebilir.";
  }
  if (code === "23503") {
    return "Yoklama oturumu bulunamadı veya arşivlenmiş. Listeyi tazeleyip tekrar deneyin.";
  }
  if (code === "22P02") {
    return "Geçersiz yoklama durumu değeri gönderildi.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Yoklama işlemi sırasında bir hata oluştu.";
}

/**
 * Aktif kurumun en son yoklama oturumunu ve kayıtlarını çeker (v1.3-01c · 2.C, v1.4-03).
 *
 * Oturum yoksa `{ session: null }` döner.
 */
export async function loadLatestAttendanceSession(
  organizationId: string
): Promise<LatestAttendanceSessionResult> {
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(
      `
      id,
      class_id,
      subject_id,
      session_date,
      starts_at,
      archived_at,
      classes ( id, name, archived_at ),
      subjects ( id, name, archived_at ),
      attendance_records (
        id,
        student_id,
        status,
        students ( id, full_name, archived_at )
      )
    `
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("session_date", { ascending: false })
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw new Error("Yoklama oturumu yüklenemedi.");
  }

  const rawRows = (data ?? []) as RawAttendanceSessionRow[];
  if (rawRows.length === 0) {
    return { session: null };
  }

  return {
    session: mapSessionRow(rawRows[0]),
  };
}

/**
 * Yoklama oturumu açar veya var olan oturumu döner (v1.4-03 · #268).
 *
 * ⛔ `attendance_sessions.id` authenticated rolü için salt okunurdur. Yüke `id`
 * konursa PostgreSQL `42501 permission denied for table attendance_sessions`
 * hatası döndürür (ölçüldü). Bu nedenle `id` GÖNDERİLMEZ; kimliği veritabanı
 * üretir ve `.select("id").single()` ile geri okunur.
 *
 * Aynı sınıf ve tarih için zaten aktif bir oturum varsa ikinci bir oturum
 * açılmaz; mevcut oturumun kimliği döner.
 */
export async function openAttendanceSession(
  input: OpenAttendanceSessionInput
): Promise<{ id: string }> {
  const subjectId = input.subjectId ?? null;
  const startsAt = input.startsAt ?? null;

  // Aynı oturumun kimliği: sınıf + gün + ders + saat (benzersiz dizinlerle
  // aynı anahtar). Boş alan `is null` ile aranır; `eq(null)` hiç eşleşmez.
  const findExisting = () => {
    let query = supabase
      .from("attendance_sessions")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("class_id", input.classId)
      .eq("session_date", input.sessionDate)
      .is("archived_at", null);
    query = subjectId
      ? query.eq("subject_id", subjectId)
      : query.is("subject_id", null);
    query = startsAt
      ? query.eq("starts_at", startsAt)
      : query.is("starts_at", null);
    return query.maybeSingle();
  };

  // 1. Önce aynı oturum var mı
  const { data: existing, error: selectError } = await findExisting();

  if (selectError) {
    throw new Error(translateAttendanceError(selectError));
  }

  if (existing) {
    return { id: existing.id };
  }

  // 2. Yoksa id GÖNDERMEDEN yeni oturum aç (id veritabanı tarafından üretilir)
  const { data, error: insertError } = await supabase
    .from("attendance_sessions")
    .insert({
      organization_id: input.organizationId,
      class_id: input.classId,
      session_date: input.sessionDate,
      subject_id: subjectId,
      starts_at: startsAt,
    })
    .select("id")
    .single();

  if (insertError) {
    // Eşzamanlı açma yarışında 23505 (unique ihlali) dönerse mevcut oturumu tekrar ara
    if ((insertError as { code?: string }).code === "23505") {
      const { data: retryExisting } = await findExisting();
      if (retryExisting) {
        return { id: retryExisting.id };
      }
    }
    throw new Error(translateAttendanceError(insertError));
  }

  return { id: data.id };
}

export type AttendanceHistoryRow = {
  sessionId: string;
  classId: string;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  sessionDate: string;
  /** "HH:MM:SS" ya da günlük oturumda `null`. */
  startsAt: string | null;
  counts: Record<AttendanceDbStatus, number>;
};

export type AttendanceHistoryResult = {
  rows: AttendanceHistoryRow[];
  truncated: boolean;
};

export const DEFAULT_ATTENDANCE_HISTORY_LIMIT = 200;

/**
 * Geçmiş yoklama oturumları (en yeni önce), durum sayılarıyla.
 *
 * Kimse işaretlenmemiş oturum listelenir ama "alındı" sayılmaz — sayıları
 * sıfırdır ve ekran bunu "boş" diye gösterir (`20261006000000`).
 * Açık kurum süzgeci (K-19), üst sınır ve `truncated` (K-03), hata fırlatılır.
 */
export async function loadAttendanceHistory(
  organizationId: string,
  options: { since: string; classId?: string | null },
  limit = DEFAULT_ATTENDANCE_HISTORY_LIMIT
): Promise<AttendanceHistoryResult> {
  if (!organizationId) return { rows: [], truncated: false };

  let query = supabase
    .from("attendance_sessions")
    .select(
      "id, class_id, subject_id, session_date, starts_at, classes(name), subjects(name), attendance_records(status)"
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .gte("session_date", options.since)
    .order("session_date", { ascending: false })
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (options.classId) query = query.eq("class_id", options.classId);

  const { data, error } = await query;
  if (error) {
    throw new Error(translateAttendanceError(error));
  }

  type Raw = {
    id: string;
    class_id: string;
    subject_id: string | null;
    session_date: string;
    starts_at: string | null;
    classes: unknown;
    subjects: unknown;
    attendance_records: { status: string }[] | null;
  };

  const rows = ((data ?? []) as Raw[]).map(row => {
    const counts: Record<AttendanceDbStatus, number> = {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
    };
    for (const record of row.attendance_records ?? []) {
      if (record.status in counts) {
        counts[record.status as AttendanceDbStatus] += 1;
      }
    }
    return {
      sessionId: row.id,
      classId: row.class_id,
      className: extractActiveName(row.classes),
      subjectId: row.subject_id,
      subjectName: extractActiveName(row.subjects),
      sessionDate: row.session_date,
      startsAt: row.starts_at,
      counts,
    };
  });

  return { rows, truncated: rows.length === limit };
}

/**
 * Bir yoklama oturumunun sınıfına kayıtlı öğrencileri ve mevcut yoklama durumlarını yükler (v1.4-03 · #268).
 *
 * Yalnızca o sınıfa kayıtlı öğrenciler listelenir; sınıfa kayıtlı olmayan öğrenciler
 * listelenmez. Öğrencinin oturumda henüz bir yoklama kaydı yoksa varsayılan durum
 * kesinlikle `Katıldı` DEĞİL `null` (seçilmemiş) olarak döner (K-03).
 */
export async function loadAttendanceSheet(
  organizationId: string,
  sessionId: string
): Promise<AttendanceSheet> {
  // 1. Oturum bilgisini çek
  const { data: sessionData, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select(
      `
      id,
      organization_id,
      class_id,
      subject_id,
      session_date,
      starts_at,
      archived_at,
      classes ( id, name, archived_at ),
      subjects ( id, name, archived_at )
    `
    )
    .eq("organization_id", organizationId)
    .eq("id", sessionId)
    .is("archived_at", null)
    .maybeSingle();

  if (sessionError) {
    throw new Error(translateAttendanceError(sessionError));
  }
  if (!sessionData) {
    throw new Error(translateAttendanceError({ code: "23503" }));
  }

  // 2. Sınıfa aktif kayıtlı öğrencileri çek
  const { data: enrollmentsData, error: enrollError } = await supabase
    .from("class_enrollments")
    .select(
      `
      id,
      student_id,
      archived_at,
      students (
        id,
        full_name,
        student_number,
        archived_at
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("class_id", sessionData.class_id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (enrollError) {
    throw new Error(translateAttendanceError(enrollError));
  }

  // 3. Bu oturumdaki mevcut yoklama durumlarını çek
  const { data: recordsData, error: recordsError } = await supabase
    .from("attendance_records")
    .select("id, student_id, status")
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId);

  if (recordsError) {
    throw new Error(translateAttendanceError(recordsError));
  }

  const statusByStudentId = new Map<string, AttendanceState | null>();
  for (const rec of recordsData ?? []) {
    statusByStudentId.set(
      rec.student_id,
      dbStatusToAttendanceState(rec.status)
    );
  }

  const rawEnrollments = enrollmentsData ?? [];
  const students: AttendanceSheetStudent[] = [];

  for (const enr of rawEnrollments) {
    const studentObj = Array.isArray(enr.students)
      ? enr.students[0]
      : enr.students;
    if (
      !studentObj ||
      (studentObj.archived_at !== null && studentObj.archived_at !== undefined)
    ) {
      continue;
    }

    const studentName = studentObj.full_name?.trim() || "";
    const studentCode = studentObj.student_number
      ? String(studentObj.student_number)
      : undefined;
    const status = statusByStudentId.get(enr.student_id) ?? null;

    students.push({
      studentId: enr.student_id,
      studentName,
      studentCode,
      status,
    });
  }

  // Alfabetik sırala
  students.sort((a, b) => a.studentName.localeCompare(b.studentName, "tr"));

  return {
    session: {
      id: sessionData.id,
      classId: sessionData.class_id,
      className: extractActiveName(sessionData.classes),
      subjectId: sessionData.subject_id || null,
      subjectName: extractActiveName(sessionData.subjects),
      sessionDate: sessionData.session_date,
      startsAt: sessionData.starts_at
        ? sessionData.starts_at.slice(0, 5)
        : null,
    },
    students,
  };
}

/**
 * Bir yoklama oturumunun kayıtlarını tek nefeste kaydeder (v1.4-03 · #268).
 *
 * ⛔ Düz `supabase.from("attendance_records").upsert(...)` KULLANILAMAZ.
 * `authenticated` rolü `attendance_records` üzerinde yalnızca `status` sütununda
 * UPDATE yetkisine sahiptir. PostgREST upsert'i tüm sütunları SET ettiği için
 * `42501 permission denied` ile kırılır (ölçüldü).
 *
 * Kaydetmenin tek yolu `record_attendance` RPC'sidir.
 */
export async function saveAttendance(
  sessionId: string,
  entries: AttendanceEntryInput[]
): Promise<number> {
  const { data, error } = await supabase.rpc("record_attendance", {
    target_session_id: sessionId,
    entries,
  });

  if (error) {
    throw new Error(translateAttendanceError(error));
  }

  return typeof data === "number" ? data : Number(data) || 0;
}

export type StudentAttendanceRecord = {
  id: string;
  status: AttendanceDbStatus;
  sessionDate: string;
  /** "HH:MM:SS"; günlük oturumda `null`. */
  startsAt: string | null;
  subjectName: string | null;
  className: string | null;
};

export const DEFAULT_STUDENT_ATTENDANCE_LIMIT = 500;

/**
 * Bir öğrencinin `since` tarihinden bu yana yoklama kayıtları, en yeni önce.
 * Öğrenci kendi kayıtlarını, veli çocuğununkileri, öğretmen ve yönetici
 * kapsamındakileri görür — kapsam RLS'tedir
 * (`attendance_records_select_*`, `attendance_sessions_select_*`).
 * Arşivli oturumun kaydı sayılmaz. Hata fırlatılır (K-22).
 */
export async function loadStudentAttendanceRecords(
  organizationId: string,
  studentId: string,
  since: string,
  limit = DEFAULT_STUDENT_ATTENDANCE_LIMIT
): Promise<StudentAttendanceRecord[]> {
  if (!organizationId || !studentId) return [];

  const { data, error } = await supabase
    .from("attendance_records")
    .select(
      "id, status, attendance_sessions!inner(session_date, starts_at, archived_at, subjects(name), classes(name))"
    )
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .gte("attendance_sessions.session_date", since)
    .is("attendance_sessions.archived_at", null)
    .limit(limit);

  if (error) {
    throw new Error(translateAttendanceError(error));
  }

  type Raw = {
    id: string;
    status: string;
    attendance_sessions: unknown;
  };

  const rows: StudentAttendanceRecord[] = [];
  for (const row of (data ?? []) as Raw[]) {
    const session = (
      Array.isArray(row.attendance_sessions)
        ? row.attendance_sessions[0]
        : row.attendance_sessions
    ) as
      | {
          session_date: string;
          starts_at: string | null;
          subjects?: unknown;
          classes?: unknown;
        }
      | null
      | undefined;
    if (!session) continue;
    if (!(ATTENDANCE_DB_STATUSES as readonly string[]).includes(row.status))
      continue;
    rows.push({
      id: row.id,
      status: row.status as AttendanceDbStatus,
      sessionDate: session.session_date,
      startsAt: session.starts_at,
      subjectName: extractActiveName(session.subjects),
      className: extractActiveName(session.classes),
    });
  }

  rows.sort(
    (a, b) =>
      b.sessionDate.localeCompare(a.sessionDate) ||
      (b.startsAt ?? "").localeCompare(a.startsAt ?? "")
  );
  return rows;
}
