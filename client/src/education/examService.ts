import { supabase } from "@/lib/supabaseClient";
import { formatTrDate } from "./trDate";

/**
 * Sınav servis katmanı (v1.3-01 · D parçası).
 *
 * `exams` ve `exam_results` tablolarını gerçek Supabase servisine bağlar.
 *
 * =========================================================================
 * ⛔ İki okuma yolu var, birbirinin yerine geçmez (DECISION_LOG)
 * =========================================================================
 *
 * - `exam_ranking(uuid)`: SIRALAMA yolu. `security definer`, satır bazında
 *   maskeleme yapar, yetkisiz isimleri `null`'lar. Bu parçada KULLANILMAZ.
 * - `student_latest_exam_scores(uuid[])`: LİSTE yolu. Maskeleme YOKTUR;
 *   RLS doğrudan uygulanır ve çağıran yalnız yetkili olduğu satırları alır.
 *
 * =========================================================================
 * Neden veritabanı fonksiyonu (student_latest_exam_scores)
 * =========================================================================
 *
 * "Son sınav" bir seçimdir (distinct on). İstemcide ham `exam_results` satırları
 * çekilip istemcide seçilmeye kalkışılırsa, kaçınılmaz bir satır üst sınırı
 * (tavan) konmak zorunda kalınır. Bu sessiz tavan aşıldığında eksik satır kümesinden
 * seçilen sınav gerçekten son olmayabilir ve kullanıcıya yanlış sınavın puanı
 * yetkili görünen bir sayı gibi sunulur (K-03).
 *
 * Fonksiyon öğrenci başına tek satır döndürür; kaç sonuç olursa olsun sonuç
 * kümesi öğrenci sayısı kadardır. Arşivlenmiş sınavlar veritabanında elenir.
 *
 * =========================================================================
 * Sayılar PostgREST'ten DİZGE gelir
 * =========================================================================
 *
 * PostgREST `numeric` ve `bigint` sütunlarını JSON'a string olarak koyar (ör. `"84.00"`).
 * Değerler `Number(...)` ile çevrilir.
 *
 * =========================================================================
 * Yokluk etiketi de bir iddiadır (K-22)
 * =========================================================================
 *
 * Puanı olmayan öğrenci için değer `undefined` kalır; kesinlikle `0` verilmez.
 * `max_score` boş (null) olduğunda "100 üzerinden" gibi uydurulmuş ibareler
 * üretilmez.
 *
 * =========================================================================
 * ⛔ Katılımcı sayısı, GÖRÜLEBİLEN satır sayısı DEĞİLDİR
 * =========================================================================
 *
 * İlk yazımda katılımcı sayısı `exams` sorgusuna gömülen `exam_results (id)`
 * dizisinin uzunluğundan geliyordu. `exam_results` üzerindeki RLS satır
 * bazlıdır, dolayısıyla o uzunluk sınava kaç kişinin girdiğini değil
 * **çağıranın kaç satır görmeye yetkili olduğunu** ölçüyordu.
 *
 * Canlıda ölçüldü (2026-09-08): üç kişinin girdiği bir denemede yönetici 3,
 * öğretmen 2, öğrenci 1 satır görüyor. Öğrenci ve veli için sayı **her zaman
 * 1**, sınava girmemiş biri için **her zaman 0** olurdu.
 *
 * Sayı artık `exam_participant_count(uuid)` veritabanı fonksiyonundan gelir.
 * Yetkisiz çağırana `null` döner ve o durumda ibare **hiç çizilmez** (K-22).
 */

export type LatestExamDetail = {
  id: string;
  name: string;
  examDate: string;
  maxScore: number | null;
  /**
   * Sınavın sınıf kimliği.
   */
  classId?: string;
  className?: string | null;
  /**
   * Sınava giren kişi sayısı — sınavın kendi sayısı, okuyanın gördüğü değil.
   * Çağıranın bu sayıyı görmeye yetkisi yoksa `null` kalır ve çizilmez.
   */
  participantCount: number | null;
  /**
   * Netli sınavda kaç yanlışın bir doğruyu götürdüğü (YKS 4, LGS 3);
   * `null`/yok = tek puanlı sınav (`20261007000000`).
   */
  netPenalty?: number | null;
};

export type LatestExamResult = {
  exam: LatestExamDetail | null;
};

/**
 * #257: Öğrenci başına en son sınav puanı ve sınav bilgileri.
 * `student_latest_exam_scores` fonksiyonu altı sütun döndürür:
 * `student_id, score, exam_id, exam_name, exam_date, max_score`.
 */
export type StudentLatestExamScore = {
  studentId: string;
  score: number;
  examId: string;
  examName: string;
  examDate: string;
  maxScore: number | null;
};

export type CreateExamInput = {
  organizationId: string;
  classId: string;
  subjectId?: string | null;
  name: string;
  examDate: string;
  maxScore?: number | null;
  /** Doluysa sınav ders ders netli (YKS 4, LGS 3); boşsa tek puanlı. */
  netPenalty?: number | null;
};

export type UpdateExamInput = {
  classId?: string;
  subjectId?: string | null;
  name?: string;
  examDate?: string;
  maxScore?: number | null;
  /** Sonuç girildikten sonra tür (tek puan ↔ net) değişemez (ORB06). */
  netPenalty?: number | null;
};

export type ExamDetail = {
  id: string;
  organizationId: string;
  classId: string;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  name: string;
  examDate: string;
  maxScore: number | null;
};

export type ExamSheetStudent = {
  studentId: string;
  studentName: string;
  studentCode?: string;
  score: number | null;
  resultId?: string | null;
};

export type ExamSheet = {
  exam: ExamDetail;
  students: ExamSheetStudent[];
};

export type ExamResultEntryInput =
  { studentId: string; score: number } | { student_id: string; score: number };

/**
 * Sınav işlemlerinde oluşan veritabanı hatalarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 */
export function translateExamError(error: unknown): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  if (typeof error === "object" && error !== null && "code" in error) {
    code = String((error as { code: unknown }).code);
  } else if (error instanceof Error) {
    for (const known of [
      "ORB06",
      "ORB05",
      "ORB02",
      "42501",
      "23503",
      "23514",
    ]) {
      if (error.message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "ORB06") {
    // Net kuralları (`20261007000000`): veritabanının cümlesi zaten
    // kullanıcıya yazılmış Türkçe ("Doğru ve yanlış toplamı soru sayısını
    // aşıyor." gibi); ham ayrıntı (detail) basılmaz.
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
    return message || "Net kurallarına uymayan bir değer girildi.";
  }
  if (code === "ORB05") {
    return "Girilen puan sınavın tam puanını aşıyor. Sınavın tam puanını değiştirmek gerekiyorsa sınav kaydını düzenleyin.";
  }
  if (code === "ORB02") {
    return "Öğrenci bu sınavın sınıfına kayıtlı değil. Öğrenciyi önce Sınıflar ekranından sınıfa kaydedin.";
  }
  if (code === "42501") {
    return "Bu işlem için yetkiniz yok veya şifre değişimi bekleniyor. Sonuçları kurum yöneticisi veya sınavın sınıfını okutan öğretmen girebilir.";
  }
  if (code === "23503") {
    return "Sınav bulunamadı veya arşivlenmiş. Listeyi tazeleyip tekrar deneyin.";
  }
  if (code === "23514") {
    return "Sınav adı 1 ile 160 karakter arasında olmalıdır.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Sınav işlemi sırasında bir hata oluştu.";
}

/**
 * Sınav başlık alt metnini oluşturur (v1.3-01d · 2.E).
 *
 * Örnek (ikisi de dolu): "14 Ağustos 2026 · 54 katılımcı · 100 üzerinden"
 * Örnek (max_score boş): "14 Ağustos 2026 · 54 katılımcı"
 * Örnek (sayı yetkisiz): "14 Ağustos 2026 · 100 üzerinden"
 *
 * ⚠️ Boş olan hiçbir alan için ibare üretilmez (K-22, K-03): `max_score`
 * bilinmiyorsa "üzerinden", katılımcı sayısı bilinmiyorsa "katılımcı" yazılmaz.
 * Bilinmeyen bir sayı yerine `0` yazmak da bir iddiadır — susmak değildir.
 */
export function formatExamSummary(exam: LatestExamDetail): string {
  const parts: string[] = [];
  const dt = formatTrDate(exam.examDate);
  if (dt) {
    parts.push(dt);
  }

  if (exam.participantCount !== null && exam.participantCount !== undefined) {
    parts.push(`${exam.participantCount} katılımcı`);
  }

  if (exam.maxScore !== null && exam.maxScore !== undefined) {
    parts.push(`${exam.maxScore} üzerinden`);
  }

  return parts.join(" · ");
}

type RawLatestExamRow = {
  id: string;
  name: string;
  exam_date: string;
  max_score?: number | string | null;
  class_id?: string;
  classes?: { id?: string; name?: string; archived_at?: string | null } | null;
  archived_at?: string | null;
};

/**
 * Sınav satırını arayüz nesnesine çevirir.
 *
 * Katılımcı sayısı **dışarıdan** verilir çünkü satırdan okunamaz: satırla
 * birlikte gelen `exam_results` dizisi çağıranın yetkisiyle süzülmüştür.
 * Sayı bilinmiyorsa `null` geçilir ve arayüz o ibareyi hiç çizmez (K-22).
 */
export function mapLatestExamRow(
  row: RawLatestExamRow,
  participantCount: number | null
): LatestExamDetail {
  let maxScore: number | null = null;
  if (row.max_score !== null && row.max_score !== undefined) {
    const parsed = Number(row.max_score);
    if (!Number.isNaN(parsed)) {
      maxScore = parsed;
    }
  }

  const cls = row.classes;
  const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;

  return {
    id: row.id,
    name: row.name,
    examDate: row.exam_date,
    maxScore,
    classId: row.class_id,
    className: className?.trim() || null,
    participantCount,
  };
}

/**
 * Öğrencilerin en son sınav puanlarını toplu olarak çeker (v1.3-01d · 2.A & 2.C, #257).
 *
 * `student_latest_exam_scores` veritabanı fonksiyonu üzerinden tek sorgu atılır (K-06).
 * İstemcide satır sayımı ve seçim yapılmaz.
 *
 * #257: Fonksiyonun döndürdüğü altı sütunun hepsi (student_id, score, exam_id,
 * exam_name, exam_date, max_score) taşınır.
 *
 * PostgREST'ten dizge olarak gelen sayılar (`"84.00"`) sayıya çevrilir.
 * Puanı olmayan öğrenciler map'te yer almaz (`undefined` döner, K-22).
 */
export async function loadStudentLatestExamScores(
  studentIds: string[]
): Promise<Map<string, StudentLatestExamScore>> {
  const uniqueIds = Array.from(
    new Set(studentIds.filter(id => Boolean(id) && typeof id === "string"))
  );
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("student_latest_exam_scores", {
    target_student_ids: uniqueIds,
  });

  if (error || !data) {
    // Fail-closed (K-04): Veritabanı hatasında uydurma puan üretilmez
    return new Map();
  }

  const resultMap = new Map<string, StudentLatestExamScore>();

  for (const row of data as {
    student_id: string;
    score: number | string;
    exam_id: string;
    exam_name: string;
    exam_date: string;
    max_score?: number | string | null;
  }[]) {
    const studentId = row.student_id;
    if (!studentId) continue;

    const parsedScore = Number(row.score);
    if (Number.isNaN(parsedScore)) continue;

    let maxScore: number | null = null;
    if (row.max_score !== null && row.max_score !== undefined) {
      const parsedMax = Number(row.max_score);
      if (!Number.isNaN(parsedMax)) {
        maxScore = parsedMax;
      }
    }

    resultMap.set(studentId, {
      studentId,
      score: parsedScore,
      examId: row.exam_id,
      examName: row.exam_name,
      examDate: row.exam_date,
      maxScore,
    });
  }

  return resultMap;
}

/**
 * Bir sınava kaç kişinin girdiğini çeker (v1.3-01d · 2.E).
 *
 * ⛔ Bu sayı `exam_results` satırları sayılarak bulunamaz: o tablodaki RLS
 * satır bazlıdır ve sayı role göre değişirdi (öğrenci her sınavda "1
 * katılımcı" görürdü). Sayım `exam_participant_count(uuid)` fonksiyonunda,
 * `security definer` altında yapılır.
 *
 * Çağıranın sayıyı görmeye yetkisi yoksa fonksiyon `null` döner — `0` değil,
 * çünkü `0` "bu sınava kimse girmedi" demektir ve bu bir iddiadır (K-22).
 * Sorgu hatasında da `null` döner (K-04): sayı üretilmez, ibare çizilmez.
 */
export async function loadExamParticipantCount(
  examId: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc("exam_participant_count", {
    target_exam_id: examId,
  });

  if (error || data === null || data === undefined) {
    return null;
  }

  // PostgREST `bigint` değerini dizge olarak da verebilir ("54").
  const parsed = Number(data);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Aktif kurumun en son aktif sınavını ve katılımcı sayısını çeker (v1.3-01d · 2.E, #249, #270).
 *
 * ⚠️ Açık `organization_id` süzgeci taşır (#249, ROADMAP §4.12).
 *
 * ⚠️ Arşiv filtresi: `exam_results` tablosunda `archived_at` yoktur;
 * filtre `exams` tablosu üzerinde `archived_at is null` olarak uygulanır.
 *
 * Sınav yoksa `{ exam: null }` döner (K-03: uydurulmuş sınav yok).
 */
export async function loadLatestExam(
  organizationId: string
): Promise<LatestExamResult> {
  let query = supabase.from("exams").select(
    `
      id,
      name,
      exam_date,
      max_score,
      class_id,
      classes ( id, name, archived_at ),
      archived_at
    `
  );

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query
    .is("archived_at", null)
    .order("exam_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(translateExamError(error));
  }

  const rawRows = (data ?? []) as RawLatestExamRow[];
  if (rawRows.length === 0) {
    return { exam: null };
  }

  const participantCount = await loadExamParticipantCount(rawRows[0].id);

  return {
    exam: mapLatestExamRow(rawRows[0], participantCount),
  };
}

/**
 * Yeni bir sınav kaydı oluşturur (v1.4-04 · #270).
 *
 * ⛔ 2. YASAK (ÖLÇÜLDÜ): Sınav oluştururken `id` GÖNDERME!
 * `exams.id` `authenticated` için salt okunur (yoklama oturumlarındaki tuzağın aynısı).
 * Kimliği veritabanı üretir; `.select("id").single()` ile geri okunur.
 */
export async function createExam(
  input: CreateExamInput
): Promise<{ id: string }> {
  const payload: {
    organization_id: string;
    class_id: string;
    subject_id?: string | null;
    name: string;
    exam_date: string;
    max_score?: number | null;
    net_penalty?: number | null;
  } = {
    organization_id: input.organizationId,
    class_id: input.classId,
    name: input.name.trim(),
    exam_date: input.examDate,
  };

  if (input.subjectId) {
    payload.subject_id = input.subjectId;
  }

  if (input.maxScore !== undefined && input.maxScore !== null) {
    payload.max_score = input.maxScore;
  }

  if (input.netPenalty) {
    payload.net_penalty = input.netPenalty;
  }

  const { data, error } = await supabase
    .from("exams")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(translateExamError(error));
  }

  return { id: data.id };
}

/**
 * Mevcut bir sınavı günceller (v1.4-04 · #270).
 * Açık `organization_id` süzgeci taşır.
 */
export async function updateExam(
  organizationId: string,
  examId: string,
  updates: UpdateExamInput
): Promise<void> {
  const payload: {
    class_id?: string;
    subject_id?: string | null;
    name?: string;
    exam_date?: string;
    max_score?: number | null;
    net_penalty?: number | null;
  } = {};

  if (updates.classId !== undefined) payload.class_id = updates.classId;
  if (updates.subjectId !== undefined) payload.subject_id = updates.subjectId;
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.examDate !== undefined) payload.exam_date = updates.examDate;
  if (updates.maxScore !== undefined) payload.max_score = updates.maxScore;
  if (updates.netPenalty !== undefined)
    payload.net_penalty = updates.netPenalty;

  const { data, error } = await supabase
    .from("exams")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", examId)
    .select("id");

  if (error) {
    throw new Error(translateExamError(error));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Sınav bulunamadı veya güncellenemedi.");
  }
}

/**
 * Bir sınavı arşivler (v1.4-04 · #270).
 * Açık `organization_id` süzgeci taşır.
 */
export async function archiveExam(
  organizationId: string,
  examId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("exams")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", examId)
    .select("id");

  if (error) {
    throw new Error(translateExamError(error));
  }

  // K-14: sıfır satır etkileyen bir yazma "oldu" demez. RLS satırı
  // gizlediğinde veya kimlik yanlış olduğunda `.update()` hata vermez,
  // sessizce hiçbir şey yapmaz — ekran da "başarılı" derdi.
  if (!data || data.length === 0) {
    throw new Error("Sınav bulunamadı veya arşivlenemedi.");
  }
}

/**
 * Bir sınavın sınıfına kayıtlı öğrencileri ve varsa girilmiş sınav puanlarını yükler (v1.4-04 · #270).
 *
 * 1. Sınav bilgisini çeker (açık organization_id süzgeci ile).
 * 2. Sınıfa aktif kayıtlı öğrencileri çeker.
 * 3. Girilmiş sonuçları çeker.
 *
 * ⚠️ Puanı olmayan öğrenci `null` (girilmedi) olarak döner; `0` uydurulmaz (K-03).
 */
export async function loadExamSheet(
  organizationId: string,
  examId: string
): Promise<ExamSheet> {
  // 1. Sınav bilgisini çek
  const { data: examData, error: examError } = await supabase
    .from("exams")
    .select(
      `
      id,
      organization_id,
      class_id,
      subject_id,
      name,
      exam_date,
      max_score,
      archived_at,
      classes ( id, name, archived_at ),
      subjects ( id, name, archived_at )
    `
    )
    .eq("organization_id", organizationId)
    .eq("id", examId)
    .is("archived_at", null)
    .maybeSingle();

  if (examError) {
    throw new Error(translateExamError(examError));
  }
  if (!examData) {
    throw new Error(translateExamError({ code: "23503" }));
  }

  const cls = examData.classes as {
    id?: string;
    name?: string;
    archived_at?: string | null;
  } | null;
  const clsName = Array.isArray(cls) ? cls[0]?.name : cls?.name;
  const sub = examData.subjects as {
    id?: string;
    name?: string;
    archived_at?: string | null;
  } | null;
  const subName = Array.isArray(sub) ? sub[0]?.name : sub?.name;

  const exam: ExamDetail = {
    id: examData.id,
    organizationId: examData.organization_id,
    classId: examData.class_id,
    className: clsName?.trim() || null,
    subjectId: examData.subject_id || null,
    subjectName: subName?.trim() || null,
    name: examData.name,
    examDate: examData.exam_date,
    maxScore:
      examData.max_score !== null && examData.max_score !== undefined
        ? Number(examData.max_score)
        : null,
  };

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
    .eq("class_id", examData.class_id)
    .is("archived_at", null);

  if (enrollError) {
    throw new Error(translateExamError(enrollError));
  }

  // 3. Sınava ait mevcut sonuçları çek
  const { data: resultsData, error: resultsError } = await supabase
    .from("exam_results")
    .select("id, student_id, score")
    .eq("organization_id", organizationId)
    .eq("exam_id", examId);

  if (resultsError) {
    throw new Error(translateExamError(resultsError));
  }

  const scoreByStudentId = new Map<string, number>();
  const resultIdByStudentId = new Map<string, string>();
  for (const res of resultsData ?? []) {
    if (res.student_id) {
      if (res.score !== null && res.score !== undefined) {
        const parsed = Number(res.score);
        if (!Number.isNaN(parsed)) {
          scoreByStudentId.set(res.student_id, parsed);
        }
      }
      if (res.id) {
        resultIdByStudentId.set(res.student_id, res.id);
      }
    }
  }

  const students: ExamSheetStudent[] = [];
  for (const enr of enrollmentsData ?? []) {
    if (enr.archived_at !== null && enr.archived_at !== undefined) continue;
    const stRaw = enr.students;
    if (!stRaw || typeof stRaw !== "object") continue;
    const studentObj = Array.isArray(stRaw) ? stRaw[0] : stRaw;
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
    const score = scoreByStudentId.has(enr.student_id)
      ? scoreByStudentId.get(enr.student_id)!
      : null;
    const resultId = resultIdByStudentId.get(enr.student_id) ?? null;

    students.push({
      studentId: enr.student_id,
      studentName,
      studentCode,
      score,
      resultId,
    });
  }

  // Alfabetik sırala
  students.sort((a, b) => a.studentName.localeCompare(b.studentName, "tr"));

  return {
    exam,
    students,
  };
}

/**
 * Bir sınavın sonuçlarını tek nefeste kaydeder (v1.4-04 · #270).
 *
 * ⛔ 1. YASAK (ÖLÇÜLDÜ): Düz `upsert` KULLANILAMAZ!
 * `exam_results` üzerinde `authenticated` rolü yalnız `score` sütununda UPDATE
 * yetkisine sahiptir; PostgREST upsert'i yükün her sütununu SET eder → `42501`.
 * Sonuç yazmanın tek yolu `record_exam_results` RPC'sidir.
 *
 * Giriş tabanı yoktur: eksi net geçerlidir.
 * Tavan `ORB05` ile veritabanında doğrulanır.
 */
export async function saveExamResults(
  examId: string,
  entries: ExamResultEntryInput[]
): Promise<number> {
  const rpcEntries = entries.map(e => ({
    student_id:
      "studentId" in e ? e.studentId : (e as { student_id: string }).student_id,
    score: e.score,
  }));

  const { data, error } = await supabase.rpc("record_exam_results", {
    target_exam_id: examId,
    entries: rpcEntries,
  });

  if (error) {
    throw new Error(translateExamError(error));
  }

  return typeof data === "number" ? data : Number(data) || 0;
}
