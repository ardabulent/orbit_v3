import { supabase } from "@/lib/supabaseClient";

/**
 * Toplu öğrenci aktarımı (karar 2026-09-29).
 *
 * Bu modül yalnız CSV'yi hücrelere böler ve satırları gönderir; hiçbir iş kuralı (numara tekil
 * mi, sınıf var mı, telefon geçerli mi) burada yazılmaz. Kurallar tek yerde,
 * `import_students` veritabanı fonksiyonunda durur ve ön izleme de onu
 * çağırır — ön izlemede geçen dosya kayıtta da geçer (K-06).
 */

export type ImportRow = {
  full_name: string;
  student_number: string;
  class_name: string;
  guardian_name: string;
  guardian_phone: string;
};

export type ImportError = { row: number; field: string; message: string };

export type ImportResult = {
  saved: boolean;
  rowCount: number;
  errors: ImportError[];
  students?: number;
  enrollments?: number;
  guardiansCreated?: number;
  guardiansReused?: number;
};

/** Excel CSV dosyalarının başındaki görünmez UTF-8 işareti. */
const BOM_AT_START = new RegExp("^" + String.fromCharCode(0xfeff));

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 1024 * 1024;

/**
 * Şablonun başlıkları. Dosyanın başlıkları bunlar olmak zorunda değil;
 * eşleme adımı (`importMapping.ts`) her sütunu bir alana bağlar.
 */
export const IMPORT_HEADERS: { key: keyof ImportRow; label: string }[] = [
  { key: "full_name", label: "Ad Soyad" },
  { key: "student_number", label: "Öğrenci No" },
  { key: "class_name", label: "Sınıf" },
  { key: "guardian_name", label: "Veli Ad Soyad" },
  { key: "guardian_phone", label: "Veli Telefon" },
];

/**
 * Tek bir CSV metnini hücrelere böler. Türkçe Excel ";" ile, diğerleri ","
 * ile kaydeder; ayırıcı başlık satırından seçilir. Tırnaklı hücre, hücre
 * içinde ayırıcı ve çift tırnak ("") desteklenir.
 */
export function splitCsv(text: string): string[][] {
  const body = text.replace(BOM_AT_START, "");
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map(d => firstLine.split(d).length - 1);
  const delimiter = [";", ",", "\t"][counts.indexOf(Math.max(...counts))];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return dropTrailingEmptyRows(rows);
}

/**
 * Sondaki boş satırları atar, aradakileri TUTAR: tablonun sırası dosyanın
 * satır numarasıdır ve hata iletisi "5. satır" dediğinde Excel'deki 5. satırı
 * göstermelidir (2026-10-01, tarayıcıda yakalandı: aradaki boş satır atılınca
 * numaralar bir kayıyordu).
 */
export function dropTrailingEmptyRows(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && rows[end - 1].every(c => c.trim() === "")) end -= 1;
  return rows.slice(0, end);
}

/** İndirilecek şablon: başlık ve kurgusal bir örnek satır, Türkçe Excel için. */
export function importTemplateCsv(): string {
  const bom = String.fromCharCode(0xfeff);
  return (
    bom +
    IMPORT_HEADERS.map(h => h.label).join(";") +
    "\r\n" +
    ["Örnek Öğrenci", "1001", "12-A", "Örnek Veli", "0500 000 00 00"].join(
      ";"
    ) +
    "\r\n"
  );
}

/**
 * Ön izleme (`dryRun`) ya da kayıt. İkisi de aynı veritabanı fonksiyonu;
 * kayıt ya hep ya hiç yazılır.
 */
export async function importStudents(
  organizationId: string,
  rows: ImportRow[],
  dryRun: boolean
): Promise<ImportResult> {
  const { data, error } = await supabase.rpc("import_students", {
    p_organization_id: organizationId,
    p_rows: rows,
    p_dry_run: dryRun,
  });

  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Toplu aktarımı yalnız kurum yöneticisi yapabilir."
        : "Aktarım tamamlanamadı; hiçbir kayıt yazılmadı."
    );
  }

  const result = (data ?? {}) as {
    saved?: boolean;
    row_count?: number;
    errors?: ImportError[];
    students?: number;
    enrollments?: number;
    guardians_created?: number;
    guardians_reused?: number;
  };
  return {
    saved: result.saved === true,
    rowCount: result.row_count ?? rows.length,
    errors: result.errors ?? [],
    students: result.students,
    enrollments: result.enrollments,
    guardiansCreated: result.guardians_created,
    guardiansReused: result.guardians_reused,
  };
}

/**
 * Dosyadaki numaralardan kurumda zaten kayıtlı olanlar (2026-10-02).
 * "Kayıtlı öğrencileri atla" seçeneği bunları göndermeden çıkarır; güncel
 * listeyi yeniden yükleyen kurum yalnız yenileri eklemiş olur. Arşivdekiler
 * de sayılır — `import_students`'ın numara kuralı da onları sayar. Dosya en
 * çok 500 satır olduğu için tek sorgu yeter. Bu bir kolaylıktır; son söz
 * yine veritabanındadır.
 */
export async function findExistingStudentNumbers(
  organizationId: string,
  numbers: string[]
): Promise<Set<string>> {
  const unique = [...new Set(numbers.map(n => n.trim()).filter(Boolean))];
  if (unique.length === 0) return new Set();

  const { data, error } = await supabase
    .from("students")
    .select("student_number")
    .eq("organization_id", organizationId)
    .in("student_number", unique);

  if (error) {
    throw new Error("Kayıtlı öğrenciler denetlenemedi; hiçbir şey yazılmadı.");
  }
  return new Set(
    (data ?? [])
      .map(row => (row as { student_number: string | null }).student_number)
      .filter((n): n is string => Boolean(n))
  );
}
