import { supabase } from "@/lib/supabaseClient";
import { calculateAttendancePercentage } from "./attendanceService";

/**
 * Rapor ekranı servis katmanı (v1.4-16 · #278 / K-22).
 *
 * Sıfır bir ölçümdür, yokluk değildir.
 *
 * Veritabanındaki üç `security invoker` fonksiyonunu çağırır:
 * - `report_attendance_weeks` (devam görünümü: 4 takvim haftası)
 * - `report_exam_averages` (deneme gelişimi: son 0-4 sınav)
 * - `report_homework_weeks` (ödev tamamlama: 4 takvim haftası)
 *
 * Satır yoksa veya ölçüm yapılamadıysa `null` döner (`undefined` veya sahte `[0, 0, 0, 0]` değil).
 */

export type AttendanceWeek = {
  weekStart: string; // "2026-09-14"
  attendancePercent?: number; // payda 0 ise undefined
};

/**
 * Net ile puanlanan denemede `averageNet`, puanla okunan sınavda
 * `averagePercent` dolu (2026-09-29). İkisi aynı grafikte karışmaz.
 */
export type ExamAverage = {
  examId: string;
  examName: string;
  examDate: string;
  isNet: boolean;
  averagePercent?: number;
  averageNet?: number;
  resultCount: number;
};

/** Raporun okuduğu dilim: 4/8/12 hafta (denemede son N sınav) ve sınıf. */
export type ReportWeeks = 4 | 8 | 12;
export const REPORT_WEEK_OPTIONS: ReportWeeks[] = [4, 8, 12];

export type ReportRange = {
  weeks: ReportWeeks;
  classId: string | null;
};

export const DEFAULT_REPORT_RANGE: ReportRange = { weeks: 4, classId: null };

export type HomeworkWeek = {
  weekStart: string;
  completionPercent?: number;
  submissionCount?: number;
  expectedCount?: number;
};

/**
 * Rapor işlemlerinde oluşan veritabanı / RPC hatalarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 */
function translateReportError(error: unknown): string {
  if (!error) {
    return "Rapor verileri yüklenirken beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  if (typeof error === "object" && error !== null && "code" in error) {
    code = String((error as { code: unknown }).code);
  } else if (error instanceof Error) {
    for (const known of ["42501", "PGRST", "ECONNREFUSED"]) {
      if (error.message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "42501") {
    return "Bu raporu görüntüleme yetkiniz bulunmuyor.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = String((error as { message: unknown }).message);
    if (msg) return msg;
  }

  return "Rapor verileri yüklenirken bir hata oluştu.";
}

/**
 * Devam görünümü için son dört takvim haftasının verilerini çeker.
 *
 * Fonksiyon her zaman dört satır döndürür; ekseni sunucu kurar.
 * Ölçülmemiş hafta (ders yok veya hepsi izinli) NULL sayılarla gelir -> attendancePercent: undefined.
 * Ölçülmüş sıfır (kimse gelmedi) -> attendancePercent: 0.
 *
 * Dördü de boşsa (hiçbir haftada geçerli ölçüm yoksa) `null` döner; kart boş durum gösterir.
 */
export async function loadAttendanceWeeks(
  range: ReportRange = DEFAULT_REPORT_RANGE
): Promise<AttendanceWeek[] | null> {
  const { data, error } = await supabase.rpc("report_attendance_weeks", {
    p_weeks: range.weeks,
    p_class_id: range.classId,
  });

  if (error) {
    throw new Error(translateReportError(error));
  }

  if (!data) {
    return null;
  }

  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) {
    return null;
  }

  const weeks: AttendanceWeek[] = [];
  for (const row of rows as {
    week_start?: string | null;
    present_count?: number | string | null;
    late_count?: number | string | null;
    absent_count?: number | string | null;
  }[]) {
    if (!row.week_start) continue;

    const hasMeasurement =
      row.present_count !== null &&
      row.present_count !== undefined &&
      row.late_count !== null &&
      row.late_count !== undefined &&
      row.absent_count !== null &&
      row.absent_count !== undefined;

    let attendancePercent: number | undefined = undefined;
    if (hasMeasurement) {
      attendancePercent = calculateAttendancePercentage({
        present: Number(row.present_count),
        late: Number(row.late_count),
        absent: Number(row.absent_count),
      });
    }

    weeks.push({
      weekStart: row.week_start,
      attendancePercent,
    });
  }

  if (weeks.length === 0) {
    return null;
  }

  // Dördü de boşsa (ölçülemedi) null dön; kart boş durumu gösterir (K-22)
  if (weeks.every(w => w.attendancePercent === undefined)) {
    return null;
  }

  return weeks;
}

/**
 * Deneme gelişimi için son N net denemenin ortalama netini ve son N puanlı
 * sınavın yüzde ortalamasını çeker (N = aralığın hafta sayısı).
 *
 * `max_score` boş veya 0 olan sınavlar fonksiyon tarafından elenmiştir (K-04).
 * Sınav adı okunamayan satırlar çizilmez (classService deseni).
 *
 * Satır yoksa veya çağıranın görebildiği sınav sonucu yoksa `null` döner.
 */
export async function loadExamAverages(
  range: ReportRange = DEFAULT_REPORT_RANGE
): Promise<ExamAverage[] | null> {
  const { data, error } = await supabase.rpc("report_exam_averages", {
    p_limit: range.weeks,
    p_class_id: range.classId,
  });

  if (error) {
    throw new Error(translateReportError(error));
  }

  if (!data) {
    return null;
  }

  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) {
    return null;
  }

  const exams: ExamAverage[] = [];
  for (const row of rows as {
    exam_id?: string | null;
    exam_name?: string | null;
    exam_date?: string | null;
    average_percent?: number | string | null;
    average_net?: number | string | null;
    is_net?: boolean | null;
    result_count?: number | string | null;
  }[]) {
    const examName = row.exam_name?.trim();
    if (!row.exam_id || !examName || !row.exam_date) {
      continue;
    }

    // Net denemede ortalama net, puanlı sınavda yüzde okunur; ilgili değer
    // yoksa satır çizilmez (uydurma sıfır üretilmez).
    const isNet = row.is_net === true;
    const raw = isNet ? row.average_net : row.average_percent;
    if (raw === null || raw === undefined) {
      continue;
    }

    const value = Number(raw);
    if (Number.isNaN(value)) {
      continue;
    }

    const resultCount = Number(row.result_count ?? 0);

    exams.push({
      examId: row.exam_id,
      examName,
      examDate: row.exam_date,
      isNet,
      ...(isNet ? { averageNet: value } : { averagePercent: value }),
      resultCount: Number.isNaN(resultCount) ? 0 : resultCount,
    });
  }

  if (exams.length === 0) {
    return null;
  }

  return exams;
}

/**
 * Ödev tamamlama kartı için son dört takvim haftasının teslim oranını çeker.
 *
 * Yalnızca `submissions_recorded_at` dolu ödevler sayılır (v1.4-15).
 * Payda ödev-öğrenci çiftlerini sayar ve beklenen > 0 olan haftalar için oran hesaplanır.
 *
 * Dördü de boşsa `null` döner; kart boş durum gösterir.
 */
export async function loadHomeworkWeeks(
  range: ReportRange = DEFAULT_REPORT_RANGE
): Promise<HomeworkWeek[] | null> {
  const { data, error } = await supabase.rpc("report_homework_weeks", {
    p_weeks: range.weeks,
    p_class_id: range.classId,
  });

  if (error) {
    throw new Error(translateReportError(error));
  }

  if (!data) {
    return null;
  }

  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) {
    return null;
  }

  const weeks: HomeworkWeek[] = [];
  for (const row of rows as {
    week_start?: string | null;
    submission_count?: number | string | null;
    expected_count?: number | string | null;
  }[]) {
    if (!row.week_start) continue;

    const hasExpected =
      row.expected_count !== null &&
      row.expected_count !== undefined &&
      Number(row.expected_count) > 0;

    let completionPercent: number | undefined = undefined;
    let submissionCount: number | undefined = undefined;
    let expectedCount: number | undefined = undefined;

    if (hasExpected) {
      const exp = Number(row.expected_count);
      const sub = Number(row.submission_count ?? 0);
      expectedCount = Number.isNaN(exp) ? undefined : exp;
      submissionCount = Number.isNaN(sub) ? 0 : sub;
      if (expectedCount !== undefined && expectedCount > 0) {
        completionPercent = Math.round((submissionCount / expectedCount) * 100);
      }
    }

    weeks.push({
      weekStart: row.week_start,
      completionPercent,
      submissionCount,
      expectedCount,
    });
  }

  if (weeks.length === 0) {
    return null;
  }

  // Dördü de boşsa (hiçbir haftada işaretlenmiş ödev yoksa) null dön
  if (weeks.every(w => w.completionPercent === undefined)) {
    return null;
  }

  return weeks;
}

/**
 * Sınıf karşılaştırmasının bir satırı (2026-09-29). Ölçülmeyen değer
 * `undefined` kalır — tabloda "—", CSV'de boş hücre (K-22).
 */
export type ClassComparisonRow = {
  classId: string;
  className: string;
  studentCount: number;
  attendancePercent?: number;
  homeworkPercent?: number;
  netExamCount?: number;
  netAverage?: number;
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
};

/**
 * Her sınıf için devam, ödev ve net deneme ortalaması
 * (`report_class_comparison`). Sayım veritabanında (K-03); devam yüzdesi
 * yine `calculateAttendancePercentage`'tan (K-06).
 */
export async function loadClassComparison(
  weeks: ReportWeeks
): Promise<ClassComparisonRow[]> {
  const { data, error } = await supabase.rpc("report_class_comparison", {
    p_weeks: weeks,
  });

  if (error) {
    throw new Error(translateReportError(error));
  }

  const rows: ClassComparisonRow[] = [];
  for (const row of (data ?? []) as {
    class_id?: string | null;
    class_name?: string | null;
    student_count?: number | string | null;
    present_count?: number | string | null;
    late_count?: number | string | null;
    absent_count?: number | string | null;
    submission_count?: number | string | null;
    expected_count?: number | string | null;
    net_exam_count?: number | string | null;
    net_average?: number | string | null;
  }[]) {
    const className = row.class_name?.trim();
    if (!row.class_id || !className) continue;

    const present = optionalNumber(row.present_count);
    const late = optionalNumber(row.late_count);
    const absent = optionalNumber(row.absent_count);
    const submitted = optionalNumber(row.submission_count);
    const expected = optionalNumber(row.expected_count);

    rows.push({
      classId: row.class_id,
      className,
      studentCount: optionalNumber(row.student_count) ?? 0,
      attendancePercent:
        present !== undefined && late !== undefined && absent !== undefined
          ? calculateAttendancePercentage({ present, late, absent })
          : undefined,
      homeworkPercent:
        submitted !== undefined && expected !== undefined && expected > 0
          ? Math.round((submitted / expected) * 100)
          : undefined,
      netExamCount: optionalNumber(row.net_exam_count),
      netAverage: optionalNumber(row.net_average),
    });
  }
  return rows;
}
