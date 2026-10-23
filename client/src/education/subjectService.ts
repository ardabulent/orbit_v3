import { supabase } from "@/lib/supabaseClient";

export type Subject = {
  id: string;
  organizationId: string;
  name: string;
  archivedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SubjectDetail = {
  id: string;
  name: string;
};

export type SubjectListResult = {
  rows: Subject[];
  truncated: boolean;
};

export type LoadSubjectsOptions = {
  includeArchived?: boolean;
  limit?: number;
};

export type CreateSubjectInput = {
  organizationId: string;
  name: string;
};

export type UpdateSubjectInput = {
  name: string;
};

export const DEFAULT_SUBJECT_LIMIT = 100;

type RawSubjectRow = {
  id: string;
  organization_id: string;
  name: string;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
};

function mapSubject(row: RawSubjectRow): Subject {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name.trim(),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Kurumun derslerini yükler.
 *
 * - Açık `organization_id` süzgeci taşır (K-19 / multi-tenant izolasyonu).
 * - Varsayılan olarak arşivlenmemiş dersleri getirir (`includeArchived` ile tümü).
 * - Açık `.limit()` ve `truncated` bayrağı döner (sessiz kesilme engeli / K-03).
 * - ⚠️ Hata durumunda boş dizi dönmez; hata fırlatır (K-22).
 */
export async function loadSubjects(
  organizationId: string,
  options?: LoadSubjectsOptions
): Promise<SubjectListResult> {
  if (!organizationId) {
    return { rows: [], truncated: false };
  }

  const limit = options?.limit ?? DEFAULT_SUBJECT_LIMIT;

  let query = supabase
    .from("subjects")
    .select("id, organization_id, name, archived_at, created_at, updated_at")
    .eq("organization_id", organizationId);

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(translateSubjectError(error));
  }

  const rawRows = (data ?? []) as RawSubjectRow[];
  const rows = rawRows.map(mapSubject);

  return {
    rows,
    truncated: rows.length === limit,
  };
}

/**
 * Yeni bir ders oluşturur (yalnızca kurum yöneticisi / RLS).
 *
 * ⚠️ Yüke asla `id` KONMAZ — kimlik veritabanının işidir (#287 / K-00).
 */
export async function createSubject(
  input: CreateSubjectInput
): Promise<Subject> {
  const payload = {
    organization_id: input.organizationId,
    name: input.name.trim(),
  };

  const { data, error } = await supabase
    .from("subjects")
    .insert(payload)
    .select("id, organization_id, name, archived_at, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(translateSubjectError(error));
  }

  return mapSubject(data as RawSubjectRow);
}

/**
 * Ders adını günceller (yalnızca kurum yöneticisi / RLS).
 *
 * ⚠️ Yüke asla `id` veya `organization_id` KONMAZ.
 * Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function updateSubject(
  organizationId: string,
  subjectId: string,
  input: UpdateSubjectInput
): Promise<Subject> {
  const payload = {
    name: input.name.trim(),
  };

  const { data, error } = await supabase
    .from("subjects")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", subjectId)
    .select("id, organization_id, name, archived_at, created_at, updated_at");

  if (error) {
    throw new Error(translateSubjectError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ders bulunamadı veya güncelleme yetkiniz yok.");
  }

  return mapSubject(data[0] as RawSubjectRow);
}

/**
 * Dersi arşivler (kapatır).
 *
 * ⚠️ DELETE yoktur; arşiv deseni geçerlidir.
 * Canlı öğretmen ataması veya program satırı olan ders veritabanı tetikleyicisi (`ORB03`)
 * tarafından engellenir.
 * Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function archiveSubject(
  organizationId: string,
  subjectId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("subjects")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", subjectId)
    .is("archived_at", null)
    .select("id");

  if (error) {
    throw new Error(translateSubjectError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ders bulunamadı veya işlem yetkiniz yok.");
  }
}

/**
 * Arşivlenmiş bir dersi yeniden açar (geri yükler).
 *
 * Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function restoreSubject(
  organizationId: string,
  subjectId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("subjects")
    .update({ archived_at: null })
    .eq("organization_id", organizationId)
    .eq("id", subjectId)
    .not("archived_at", "is", null)
    .select("id");

  if (error) {
    throw new Error(translateSubjectError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ders bulunamadı veya işlem yetkiniz yok.");
  }
}

/**
 * Ders veritabanı ve RLS hatalarını Türkçe insan dostu mesajlara dönüştürür.
 *
 * 🔴 ORB03: Canlı öğretmen ataması veya program satırı olan ders kapatılamaz.
 * Real PostgREST error gövdesindeki `details` (çoğul) alanını ayrıştırır.
 * Sayılar okunur ve anlamlı bir cümle kurulur; ham `details` basılmaz (K-23).
 * Geçmiş kayıtlar (sınav, ödev, yoklama) için kesinlikle uyarı üretilmez (sunucu öyle demiyor).
 */
export function translateSubjectError(error: unknown): string {
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

  if (!code && message) {
    for (const known of ["ORB03", "23505", "23514", "42501"]) {
      if (message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "ORB03") {
    const atamaMatch = details?.match(/atama=(\d+)/i);
    const programMatch = details?.match(/program=(\d+)/i);

    const atama = atamaMatch ? parseInt(atamaMatch[1], 10) : 0;
    const program = programMatch ? parseInt(programMatch[1], 10) : 0;

    if (atama > 0 && program > 0) {
      return `Bu ders kapatılamaz: ${atama} öğretmen ataması ve ${program} ders programı satırında kullanılıyor. Önce bu dersin öğretmen atamalarını ve program satırlarını kaldırın.`;
    }
    if (atama > 0) {
      return `Bu ders kapatılamaz: ${atama} öğretmen atamasında kullanılıyor. Önce bu dersin öğretmen atamalarını kaldırın.`;
    }
    if (program > 0) {
      return `Bu ders kapatılamaz: ${program} ders programı satırında kullanılıyor. Önce bu dersin program satırlarını kaldırın.`;
    }

    return "Bu ders kapatılamaz: hâlâ okutuluyor.";
  }

  if (code === "23505") {
    return "Bu isimde aktif bir ders zaten var (büyük/küçük harf fark etmez). Lütfen farklı bir ders adı seçin.";
  }

  if (code === "23514") {
    return "Ders adı 1 ile 80 karakter arasında olmalıdır.";
  }

  if (code === "42501") {
    return "Bu işlem için kurum yöneticisi yetkisi gerekiyor.";
  }

  return "Ders işlemi gerçekleştirilemedi. Lütfen tekrar deneyin.";
}
