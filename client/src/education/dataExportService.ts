import { supabase } from "@/lib/supabaseClient";
import { PagedReadError, readAllPages } from "@/lib/pagedRead";
import { toTurkishCsv, type CsvCell } from "@/lib/turkishCsv";
import { buildXlsx } from "@/lib/xlsxWriter";
import { userFacingErrorText } from "@/lib/userFacingError";
import { extractClassNames } from "./studentService";
import { getOrbitToday, orbitLocalDate } from "./trDate";

/**
 * Kurum verisini dışa aktarma (2026-10-24, ana plan 2.4).
 *
 * Yönetici seçtiği veri kümelerini tek bir Excel dosyası (küme başına bir
 * sayfa) ya da küme başına bir CSV olarak indirir. Okuma RLS'ten geçer —
 * yönetici yalnız kendi kurumunu görür; açık `organization_id` süzgeci
 * performans içindir (§4.12).
 *
 * **Önce iz, sonra dosya:** dosyalar hazırlandıktan sonra
 * `record_data_export` denetim kaydına kim/hangi küme/kaç satır yazar;
 * bu yazılamazsa hata fırlatılır ve dosya verilmez (iz bırakmayan dışa
 * aktarma yok — KVKK).
 *
 * **Kesme yok:** bir küme `EXPORT_ROW_CAP`'i aşarsa sessizce kısaltılmaz,
 * hata verilir (`DECISION_LOG` — sessiz kesme yoktur).
 *
 * Kapsam: öğrenci ve velide arşivdekiler de "Durum" sütunuyla gelir (kurum
 * verisinin tamamı). Yoklama, sınav ve ödemede arşivlenmiş oturum/sınav/
 * plan gelmez — arşiv orada "kaldırıldı" demektir.
 */

export const EXPORT_DATASETS = [
  { key: "students", title: "Öğrenciler" },
  { key: "guardians", title: "Veliler" },
  { key: "attendance", title: "Yoklama" },
  { key: "exam_results", title: "Sınav sonuçları" },
  { key: "payments", title: "Ödemeler" },
] as const;

export type ExportDatasetKey = (typeof EXPORT_DATASETS)[number]["key"];
export type ExportFormat = "xlsx" | "csv";

export type ExportTable = {
  key: ExportDatasetKey;
  title: string;
  header: string[];
  rows: CsvCell[][];
};

export type ExportFile = { name: string; mime: string; data: BlobPart };

export const EXPORT_ROW_CAP = 200_000;

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Katıldı",
  late: "Geç kaldı",
  absent: "Gelmedi",
  excused: "İzinli",
};

// --- Ham satır tipleri ---------------------------------------------------

type One<T> = T | T[] | null;

function one<T>(value: One<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type RawStudent = {
  id: string;
  full_name: string;
  student_number: string | null;
  auth_user_id: string | null;
  archived_at: string | null;
  created_at: string;
  branches: One<{ name: string }>;
  class_enrollments: unknown;
  student_guardians:
    | {
        archived_at: string | null;
        guardians: One<{ full_name: string; archived_at: string | null }>;
      }[]
    | null;
};

type RawGuardian = {
  id: string;
  full_name: string;
  phone: string | null;
  auth_user_id: string | null;
  archived_at: string | null;
  created_at: string;
  student_guardians:
    | {
        archived_at: string | null;
        students: One<{ full_name: string; archived_at: string | null }>;
      }[]
    | null;
};

type RawAttendance = {
  id: string;
  status: string;
  attendance_sessions: One<{
    session_date: string;
    starts_at: string | null;
    classes: One<{ name: string }>;
    subjects: One<{ name: string }>;
  }>;
  students: One<{ full_name: string; student_number: string | null }>;
};

type RawExamResult = {
  id: string;
  score: number | string | null;
  exams: One<{
    name: string;
    exam_date: string;
    max_score: number | string | null;
    net_penalty: number | null;
    class_id: string | null;
    branch_id: string | null;
    classes: One<{ name: string }>;
    branches: One<{ name: string }>;
  }>;
  students: One<{ full_name: string; student_number: string | null }>;
};

type RawInstallment = {
  id: string;
  sequence_no: number;
  due_date: string;
  amount: number | string;
  paid_at: string | null;
  payment_plans: One<{
    name: string;
    total_amount: number | string;
    students: One<{ full_name: string; student_number: string | null }>;
  }>;
};

// --- Saf eşleme (test edilir) ----------------------------------------------

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Türkiye numarası yerel biçimde: "+90 532 111 22 33" → "0532 111 22 33".
 * "+" ile başlayan hücreyi Excel CSV'de formül sanar (tırnak koruması da
 * CSV'de görünür kalır); yerel biçim iki dosya türünde de düz metin açılır,
 * boşluklar baştaki sıfırı korur. Yabancı numara olduğu gibi kalır.
 */
export function exportPhone(phone: string | null): string | null {
  if (!phone) return null;
  return /^\+90\s*/.test(phone) ? "0" + phone.replace(/^\+90\s*/, "") : phone;
}

type Person = { full_name: string; archived_at: string | null };

/** Arşivlenmemiş bağların arşivlenmemiş kişileri, Türkçe sırayla. */
function activeNames<L extends { archived_at: string | null }>(
  links: L[] | null,
  pick: (link: L) => One<Person>
): string {
  return (links ?? [])
    .filter(link => !link.archived_at)
    .map(link => one(pick(link)))
    .filter((person): person is Person => !!person && !person.archived_at)
    .map(person => person.full_name)
    .sort((a, b) => a.localeCompare(b, "tr"))
    .join(", ");
}

export function mapStudents(rows: RawStudent[]): ExportTable {
  return {
    key: "students",
    title: "Öğrenciler",
    header: [
      "Öğrenci no",
      "Ad soyad",
      "Şube",
      "Sınıflar",
      "Veliler",
      "Giriş hesabı",
      "Durum",
      "Kayıt tarihi",
    ],
    rows: [...rows]
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"))
      .map(row => [
        row.student_number,
        row.full_name,
        one(row.branches)?.name ?? null,
        extractClassNames(row.class_enrollments).join(", ") || null,
        activeNames(row.student_guardians, link => link.guardians) || null,
        row.auth_user_id ? "Var" : "Yok",
        row.archived_at ? "Arşivde" : "Aktif",
        orbitLocalDate(row.created_at) || null,
      ]),
  };
}

export function mapGuardians(rows: RawGuardian[]): ExportTable {
  return {
    key: "guardians",
    title: "Veliler",
    header: [
      "Ad soyad",
      "Telefon",
      "Çocukları",
      "Giriş hesabı",
      "Durum",
      "Kayıt tarihi",
    ],
    rows: [...rows]
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"))
      .map(row => [
        row.full_name,
        exportPhone(row.phone),
        activeNames(row.student_guardians, link => link.students) || null,
        row.auth_user_id ? "Var" : "Yok",
        row.archived_at ? "Arşivde" : "Aktif",
        orbitLocalDate(row.created_at) || null,
      ]),
  };
}

export function mapAttendance(rows: RawAttendance[]): ExportTable {
  const mapped = rows.map(row => {
    const session = one(row.attendance_sessions);
    const student = one(row.students);
    return {
      sortKey: `${session?.session_date ?? ""} ${session?.starts_at ?? ""} ${one(session?.classes)?.name ?? ""} ${student?.full_name ?? ""}`,
      cells: [
        session?.session_date ?? null,
        session?.starts_at ? session.starts_at.slice(0, 5) : null,
        one(session?.classes)?.name ?? null,
        one(session?.subjects)?.name ?? null,
        student?.student_number ?? null,
        student?.full_name ?? null,
        ATTENDANCE_LABELS[row.status] ?? row.status,
      ] as CsvCell[],
    };
  });
  mapped.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "tr"));
  return {
    key: "attendance",
    title: "Yoklama",
    header: [
      "Tarih",
      "Saat",
      "Sınıf",
      "Ders",
      "Öğrenci no",
      "Öğrenci",
      "Durum",
    ],
    rows: mapped.map(row => row.cells),
  };
}

export function mapExamResults(rows: RawExamResult[]): ExportTable {
  const mapped = rows.map(row => {
    const exam = one(row.exams);
    const student = one(row.students);
    const isNet = Boolean(exam?.net_penalty);
    const scope = exam?.class_id
      ? (one(exam.classes)?.name ?? "Sınıf")
      : exam?.branch_id
        ? `${one(exam.branches)?.name ?? ""} şubesi`.trim()
        : "Kurum geneli";
    return {
      sortKey: `${exam?.exam_date ?? ""} ${exam?.name ?? ""} ${student?.full_name ?? ""}`,
      cells: [
        exam?.exam_date ?? null,
        exam?.name ?? null,
        scope,
        student?.student_number ?? null,
        student?.full_name ?? null,
        num(row.score),
        isNet ? "Net" : "Puan",
        isNet ? null : num(exam?.max_score),
      ] as CsvCell[],
    };
  });
  mapped.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "tr"));
  return {
    key: "exam_results",
    title: "Sınav sonuçları",
    header: [
      "Tarih",
      "Sınav",
      "Kapsam",
      "Öğrenci no",
      "Öğrenci",
      "Sonuç",
      "Tür",
      "Tam puan",
    ],
    rows: mapped.map(row => row.cells),
  };
}

export function mapPayments(
  rows: RawInstallment[],
  today: string
): ExportTable {
  const mapped = rows.map(row => {
    const plan = one(row.payment_plans);
    const student = one(plan?.students);
    const status = row.paid_at
      ? "Ödendi"
      : row.due_date < today
        ? "Gecikti"
        : "Bekliyor";
    return {
      sortKey: `${student?.full_name ?? ""} ${plan?.name ?? ""} ${String(row.sequence_no).padStart(4, "0")}`,
      cells: [
        student?.student_number ?? null,
        student?.full_name ?? null,
        plan?.name ?? null,
        num(plan?.total_amount),
        row.sequence_no,
        row.due_date,
        num(row.amount),
        orbitLocalDate(row.paid_at) || null,
        status,
      ] as CsvCell[],
    };
  });
  mapped.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "tr"));
  return {
    key: "payments",
    title: "Ödemeler",
    header: [
      "Öğrenci no",
      "Öğrenci",
      "Plan",
      "Plan toplamı",
      "Taksit no",
      "Vade",
      "Tutar",
      "Ödeme tarihi",
      "Durum",
    ],
    rows: mapped.map(row => row.cells),
  };
}

// --- Okuma -----------------------------------------------------------------

const SELECTS: Record<ExportDatasetKey, { table: string; select: string }> = {
  students: {
    table: "students",
    select:
      "id, full_name, student_number, auth_user_id, archived_at, created_at, branches ( name ), class_enrollments ( archived_at, classes ( name, archived_at ) ), student_guardians ( archived_at, guardians ( full_name, archived_at ) )",
  },
  guardians: {
    table: "guardians",
    select:
      "id, full_name, phone, auth_user_id, archived_at, created_at, student_guardians ( archived_at, students ( full_name, archived_at ) )",
  },
  attendance: {
    table: "attendance_records",
    select:
      "id, status, attendance_sessions!inner ( session_date, starts_at, archived_at, classes ( name ), subjects ( name ) ), students ( full_name, student_number )",
  },
  exam_results: {
    table: "exam_results",
    select:
      "id, score, exams!inner ( name, exam_date, max_score, net_penalty, class_id, branch_id, archived_at, classes ( name ), branches ( name ) ), students ( full_name, student_number )",
  },
  payments: {
    table: "installments",
    select:
      "id, sequence_no, due_date, amount, paid_at, archived_at, payment_plans!inner ( name, total_amount, archived_at, students ( full_name, student_number ) )",
  },
};

async function loadRaw<T>(
  organizationId: string,
  key: ExportDatasetKey,
  title: string
): Promise<T[]> {
  const { table, select } = SELECTS[key];
  const page = (from: number, to: number) => {
    let query = supabase
      .from(table)
      .select(select)
      .eq("organization_id", organizationId);
    if (key === "attendance") {
      query = query.is("attendance_sessions.archived_at", null);
    } else if (key === "exam_results") {
      query = query.is("exams.archived_at", null);
    } else if (key === "payments") {
      query = query
        .is("archived_at", null)
        .is("payment_plans.archived_at", null);
    }
    return query.order("id", { ascending: true }).range(from, to);
  };

  try {
    const { rows, truncated } = await readAllPages<T>(page, EXPORT_ROW_CAP);
    if (truncated) {
      throw new Error(
        `${title} ${EXPORT_ROW_CAP.toLocaleString("tr-TR")} satırı aşıyor; eksik dosya verilmez. Destekle iletişime geçin.`
      );
    }
    return rows;
  } catch (err) {
    if (err instanceof PagedReadError) {
      throw new Error(
        `${title} okunamadı. ${userFacingErrorText(err.cause) ?? "Bağlantıyı kontrol edip yeniden deneyin."}`,
        { cause: err }
      );
    }
    throw err;
  }
}

export async function loadExportTable(
  organizationId: string,
  key: ExportDatasetKey,
  today: string = getOrbitToday()
): Promise<ExportTable> {
  const title = EXPORT_DATASETS.find(d => d.key === key)?.title ?? key;
  switch (key) {
    case "students":
      return mapStudents(await loadRaw<RawStudent>(organizationId, key, title));
    case "guardians":
      return mapGuardians(
        await loadRaw<RawGuardian>(organizationId, key, title)
      );
    case "attendance":
      return mapAttendance(
        await loadRaw<RawAttendance>(organizationId, key, title)
      );
    case "exam_results":
      return mapExamResults(
        await loadRaw<RawExamResult>(organizationId, key, title)
      );
    case "payments":
      return mapPayments(
        await loadRaw<RawInstallment>(organizationId, key, title),
        today
      );
  }
}

/** Dışa aktarmayı denetim kaydına yazar; yazılamazsa fırlatır. */
export async function recordDataExport(
  organizationId: string,
  tables: ExportTable[]
): Promise<void> {
  const { error } = await supabase.rpc("record_data_export", {
    target_organization_id: organizationId,
    datasets: tables.map(t => t.key),
    row_counts: Object.fromEntries(tables.map(t => [t.key, t.rows.length])),
  });
  if (error) {
    throw new Error(
      `Dışa aktarma kayda geçirilemediği için dosya verilmedi. ${userFacingErrorText(error) ?? "Yeniden deneyin."}`,
      { cause: error }
    );
  }
}

export function buildExportFiles(
  tables: ExportTable[],
  format: ExportFormat,
  today: string
): ExportFile[] {
  if (format === "xlsx") {
    return [
      {
        name: `orbit-kurum-verisi-${today}.xlsx`,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data: buildXlsx(
          tables.map(t => ({ name: t.title, rows: [t.header, ...t.rows] }))
        ) as BlobPart,
      },
    ];
  }
  return tables.map(t => ({
    name: `orbit-${FILE_SLUGS[t.key]}-${today}.csv`,
    mime: "text/csv;charset=utf-8",
    data: toTurkishCsv(t.header, t.rows),
  }));
}

const FILE_SLUGS: Record<ExportDatasetKey, string> = {
  students: "ogrenciler",
  guardians: "veliler",
  attendance: "yoklama",
  exam_results: "sinav-sonuclari",
  payments: "odemeler",
};

/**
 * Seçilen kümeleri okur, dosyaları hazırlar, denetim kaydına yazar ve
 * dosyaları döndürür. Kayıt yazılamazsa dosya dönmez.
 */
export async function prepareDataExport(
  organizationId: string,
  keys: ExportDatasetKey[],
  format: ExportFormat,
  onProgress?: (title: string) => void,
  today: string = getOrbitToday()
): Promise<{ files: ExportFile[]; tables: ExportTable[] }> {
  if (keys.length === 0) throw new Error("En az bir veri kümesi seçin.");
  const tables: ExportTable[] = [];
  for (const dataset of EXPORT_DATASETS) {
    if (!keys.includes(dataset.key)) continue;
    onProgress?.(dataset.title);
    tables.push(await loadExportTable(organizationId, dataset.key, today));
  }
  const files = buildExportFiles(tables, format, today);
  await recordDataExport(organizationId, tables);
  return { files, tables };
}
