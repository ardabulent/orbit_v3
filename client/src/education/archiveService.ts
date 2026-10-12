import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";

/**
 * Arşiv ekranının veri katmanı (2026-10-12, ROADMAP §4.23 B20).
 *
 * Öğrenci, sınıf ve veli arşivlenince geri almanın tek yolu birkaç saniyelik
 * bir tosttu; sınavın ise hiç yolu yoktu. Bu modül arşivdekileri türüne göre
 * listeler ve geri alır.
 *
 * Yetki veritabanında: okuma kuralları arşiv sütununa bakmaz, yazma kuralları
 * öğrenci, sınıf ve veliyi yöneticiye, sınavı yönetici ve sınıfın
 * öğretmenine açar. Ekranın yalnız yöneticide görünmesi kullanıcı deneyimidir,
 * güvenlik sınırı değil.
 */

export type ArchiveKind = "student" | "class" | "guardian" | "exam";

export type ArchivedItem = {
  kind: ArchiveKind;
  id: string;
  title: string;
  /** İkinci satır: öğrenci numarası, sınav tarihi ve sınıfı gibi. */
  detail: string | null;
  archivedAt: string;
};

export type ArchiveListing = Record<ArchiveKind, ArchivedItem[]>;

/** Tür başına en çok bu kadar satır, en yeni arşivlenen önce. */
export const ARCHIVE_PAGE_CAP = 200;

const TABLE: Record<ArchiveKind, string> = {
  student: "students",
  class: "classes",
  guardian: "guardians",
  exam: "exams",
};

function failure(error: unknown, fallback: string): Error {
  return new Error(userFacingErrorText(error) ?? fallback);
}

type Row = Record<string, unknown> & { id: string; archived_at: string };

function relationName(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "name" in row) {
    const name = (row as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

export function mapArchivedRow(kind: ArchiveKind, row: Row): ArchivedItem {
  switch (kind) {
    case "student":
      return {
        kind,
        id: row.id,
        title: String(row.full_name ?? ""),
        detail: row.student_number ? `No: ${String(row.student_number)}` : null,
        archivedAt: row.archived_at,
      };
    case "class":
      return {
        kind,
        id: row.id,
        title: String(row.name ?? ""),
        detail: null,
        archivedAt: row.archived_at,
      };
    case "guardian":
      return {
        kind,
        id: row.id,
        title: String(row.full_name ?? ""),
        detail: null,
        archivedAt: row.archived_at,
      };
    case "exam": {
      const className = relationName(row.classes);
      return {
        kind,
        id: row.id,
        title: String(row.name ?? ""),
        detail:
          [row.exam_date ? String(row.exam_date) : null, className]
            .filter(Boolean)
            .join(" · ") || null,
        archivedAt: row.archived_at,
      };
    }
  }
}

const SELECT: Record<ArchiveKind, string> = {
  student: "id, full_name, student_number, archived_at",
  class: "id, name, archived_at",
  guardian: "id, full_name, archived_at",
  exam: "id, name, exam_date, archived_at, classes(name)",
};

async function loadKind(
  organizationId: string,
  kind: ArchiveKind
): Promise<ArchivedItem[]> {
  const { data, error } = await supabase
    .from(TABLE[kind])
    .select(SELECT[kind])
    .eq("organization_id", organizationId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(ARCHIVE_PAGE_CAP);

  if (error) {
    throw failure(error, "Arşiv listesi alınamadı.");
  }
  return ((data ?? []) as unknown as Row[]).map(row =>
    mapArchivedRow(kind, row)
  );
}

export async function loadArchive(
  organizationId: string
): Promise<ArchiveListing> {
  const [student, klass, guardian, exam] = await Promise.all([
    loadKind(organizationId, "student"),
    loadKind(organizationId, "class"),
    loadKind(organizationId, "guardian"),
    loadKind(organizationId, "exam"),
  ]);
  return { student, class: klass, guardian, exam };
}

/**
 * Geri almada çakışma: arşivdeyken aynı adla yeni bir sınıf ya da aynı ad ve
 * tarihli yeni bir sınav açılmış olabilir (etkin kayıtlarda tekil).
 */
export function translateRestoreError(
  kind: ArchiveKind,
  error: unknown
): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code === "23505" && kind === "class") {
    return "Aynı adla etkin bir sınıf var. Önce o sınıfın adını değiştirin, sonra bunu geri alın.";
  }
  if (code === "23505" && kind === "exam") {
    return "Aynı ad ve tarihle etkin bir sınav var. Önce onun adını değiştirin, sonra bunu geri alın.";
  }
  if (code === "42501") {
    return "Bu kaydı geri almak için yetkiniz yok veya şifre değişimi bekleniyor.";
  }
  return userFacingErrorText(error) ?? "Kayıt geri alınamadı.";
}

export async function restoreArchived(
  organizationId: string,
  kind: ArchiveKind,
  id: string
): Promise<void> {
  const { data, error } = await supabase
    .from(TABLE[kind])
    .update({ archived_at: null })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("id");

  if (error) {
    throw new Error(translateRestoreError(kind, error));
  }
  // K-14: sıfır satır etkileyen yazma "oldu" demez.
  if (!data || data.length === 0) {
    throw new Error("Kayıt bulunamadı veya geri alınamadı.");
  }
}
