import { supabase } from "@/lib/supabaseClient";
import { searchPattern } from "./turkishSearch";
import { readAllPages, PagedReadError } from "@/lib/pagedRead";

/**
 * Veli ve öğrenci–veli bağı servis katmanı (v1.4-10 · #275).
 *
 * `guardians` ve `student_guardians` tablolarını Supabase sorgularına ve RPC çağrılarına bağlar.
 *
 * =========================================================================
 * Şemanın kısıtları ve kuralları
 * =========================================================================
 *
 * 1. Açık `organization_id` süzgeci şarttır (ROADMAP §4.12, #249).
 * 2. `id` ve `auth_user_id` `authenticated` için salt okunurdur.
 *    Kayıt yüküne (`createGuardian`, `updateGuardian`) KESİNLİKLE konmaz.
 *    Hesap bağlama/koparma yalnız `link_guardian_account` ve `unlink_guardian_account`
 *    RPC'leri üzerinden yapılır.
 * 3. UPDATE yetkisi yalnız 3 sütundadır: `full_name`, `phone`, `archived_at`.
 *    Başka sütun SET edilemez.
 * 4. Silme yoktur: arşiv deseni (`archived_at`) kullanılır.
 * 5. Telefon zorunlu değildir (K-03). Biçim doğrulaması bilerek yoktur;
 *    ülke kodu, sabit hat ve yurt dışı numaraları meşrudur.
 *    Boş veya yalnız boşluklardan oluşan telefonlar veritabanına `null` yazılır;
 *    boş dize `""` kısıta takılır (`guardians_phone_check`).
 * 6. `student_guardians` bağ koparma işlemi `archived_at` zaman damgası koyar;
 *    satır silmez. Sıfır satır etkileyen yazma işlemleri hata fırlatır (K-14).
 */

/**
 * Listenin toplam tavanı (2026-10-05). Eskiden tek sorguda 100'dü; 300
 * öğrencili kurumda liste eksik kalıyordu. Artık sayfa sayfa
 * (`lib/pagedRead.ts`) bu tavana kadar okunur.
 */
export const GUARDIAN_TOTAL_CAP = 5000;

export type Guardian = {
  id: string;
  fullName: string;
  phone?: string | null;
  hasAccount: boolean;
  authUserId?: string | null;
  studentCount: number;
  studentNames?: string[];
};

export type GuardianListResult = {
  rows: Guardian[];
  truncated: boolean;
};

export type LoadGuardiansOptions = {
  limit?: number;
  search?: string;
};

export type RawGuardianRow = {
  id: string;
  organization_id: string;
  full_name: string;
  phone?: string | null;
  auth_user_id?: string | null;
  archived_at?: string | null;
  student_guardians?:
    | {
        id: string;
        archived_at: string | null;
        students?:
          | { id: string; full_name: string; archived_at?: string | null }
          | { id: string; full_name: string; archived_at?: string | null }[]
          | null;
      }[]
    | null;
};

export type CreateGuardianInput = {
  organizationId: string;
  fullName: string;
  phone?: string | null;
};

export type UpdateGuardianInput = {
  fullName?: string;
  phone?: string | null;
};

export type StudentGuardianLink = {
  id: string;
  organizationId: string;
  studentId: string;
  guardianId: string;
  guardian?: {
    id: string;
    fullName: string;
    phone?: string | null;
    hasAccount: boolean;
  };
};

export const GUARDIAN_ERROR_MESSAGES: Record<string, string> = {
  "23503": "Veli veya üyelik kaydı bulunamadı ya da arşivlenmiş.",
  "23505":
    "Bu kayıt veya bağ zaten mevcut. Aynı veli aynı öğrenciye aktifken birden fazla kez bağlanamaz.",
  "23514": "Veli bilgileri doğrulanamadı.",
  "42501":
    "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor.",
  ORB03:
    "Bu üyelik bir veli kaydına bağlanamaz. Lütfen aynı kurumda rolü veli olan başka bir üyelik seçin.",
  ORB04:
    "Bu veli kaydı veya hesap zaten başka bir bağa sahip. Önce mevcut bağı çözün.",
};

/**
 * Veritabanı ve RPC hata kodlarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 * Ham hata kodları arayüze sızdırılmaz.
 */
export function translateGuardianError(error: unknown): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  let message = "";

  if (typeof error === "object" && error !== null) {
    if (
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
    ) {
      code = (error as { code: string }).code;
    }
    if (
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    ) {
      message = (error as { message: string }).message;
    }
  } else if (error instanceof Error) {
    message = error.message;
    for (const known of [
      "42501",
      "23505",
      "23514",
      "23503",
      "ORB03",
      "ORB04",
    ]) {
      if (error.message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "23514") {
    if (message.includes("guardians_phone_check")) {
      return "Telefon numarası en az 7, en fazla 30 karakter olmalıdır.";
    }
    if (message.includes("guardians_full_name_check")) {
      return "Veli adı 1 ile 120 karakter arasında olmalıdır.";
    }
    return "Girilen bilgiler kısıtları karşılamıyor (ad 1–120 karakter, telefon varsa 7–30 karakter).";
  }

  if (code && GUARDIAN_ERROR_MESSAGES[code]) {
    return GUARDIAN_ERROR_MESSAGES[code];
  }

  if (message && !message.includes("PGRST") && !message.includes("PostgREST")) {
    return message;
  }

  return "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.";
}

export function extractActiveStudentNames(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  const names: string[] = [];

  for (const link of links) {
    if (!link || typeof link !== "object") continue;
    if (link.archived_at !== null && link.archived_at !== undefined) continue;

    const s = link.students;
    if (!s || typeof s !== "object") continue;
    const sObj = Array.isArray(s) ? s[0] : s;
    if (
      !sObj ||
      (sObj.archived_at !== null && sObj.archived_at !== undefined)
    ) {
      continue;
    }
    if (
      typeof sObj.full_name === "string" &&
      sObj.full_name.trim().length > 0
    ) {
      names.push(sObj.full_name.trim());
    }
  }

  return names;
}

export function mapGuardianRow(row: RawGuardianRow): Guardian {
  const studentNames = extractActiveStudentNames(row.student_guardians);
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone ?? null,
    hasAccount: Boolean(row.auth_user_id),
    authUserId: row.auth_user_id ?? null,
    studentCount: studentNames.length,
    studentNames,
  };
}

/**
 * Aktif kurumun veli listesini yükler.
 * Açık `organization_id` süzgeci taşır ve arşivlenmemiş velileri alfabetik sıralar.
 */
export async function loadGuardians(
  organizationId: string,
  options?: LoadGuardiansOptions
): Promise<GuardianListResult> {
  const limit = options?.limit ?? GUARDIAN_TOTAL_CAP;

  const page = (from: number, to: number) => {
    let query = supabase
      .from("guardians")
      .select(
        `
      id,
      organization_id,
      full_name,
      phone,
      auth_user_id,
      archived_at,
      student_guardians (
        id,
        archived_at,
        students (
          id,
          full_name,
          archived_at
        )
      )
    `
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    const term = options?.search?.trim();
    if (term) {
      // Türkçe arama (2026-10-03): `search_key` = search_fold(ad + telefon).
      query = query.ilike("search_key", searchPattern(term));
    }

    return query
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
  };

  try {
    const { rows: rawRows, truncated } = await readAllPages<RawGuardianRow>(
      page,
      limit
    );
    return { rows: rawRows.map(mapGuardianRow), truncated };
  } catch (err) {
    if (err instanceof PagedReadError) {
      throw new Error("Veli listesi yüklenemedi.", { cause: err });
    }
    throw err;
  }
}

/**
 * Yeni bir veli kaydı oluşturur.
 * `id` ve `auth_user_id` KESİNLİKLE yüke konmaz.
 */
export async function createGuardian(
  input: CreateGuardianInput
): Promise<{ id: string }> {
  const payload: {
    organization_id: string;
    full_name: string;
    phone?: string | null;
  } = {
    organization_id: input.organizationId,
    full_name: input.fullName.trim(),
  };

  if (input.phone !== undefined) {
    const trimmed = input.phone?.trim();
    payload.phone = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  const { data, error } = await supabase
    .from("guardians")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(translateGuardianError(error));
  }

  return data;
}

/**
 * Mevcut bir veli kaydını günceller.
 * `id`, `auth_user_id` ve `organization_id` KESİNLİKLE yüke konmaz.
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function updateGuardian(
  organizationId: string,
  guardianId: string,
  input: UpdateGuardianInput
): Promise<void> {
  const payload: {
    full_name?: string;
    phone?: string | null;
  } = {};

  if (input.fullName !== undefined) {
    payload.full_name = input.fullName.trim();
  }

  if (input.phone !== undefined) {
    const trimmed = input.phone?.trim();
    payload.phone = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  const { data, error } = await supabase
    .from("guardians")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", guardianId)
    .select("id");

  if (error) {
    throw new Error(translateGuardianError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Veli kaydı bulunamadı veya güncellenemedi.");
  }
}

/**
 * Bir veli kaydını arşivler (archived_at ile).
 * Açık iki parçalı imza taşır (`organizationId`, `guardianId`).
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function archiveGuardian(
  organizationId: string,
  guardianId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("guardians")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", guardianId)
    .select("id");

  if (error) {
    throw new Error(translateGuardianError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Veli kaydı bulunamadı veya arşivlenemedi.");
  }
}

/**
 * Arşivlenmiş bir veli kaydını geri yükler.
 * Açık iki parçalı imza taşır (`organizationId`, `guardianId`).
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function restoreGuardian(
  organizationId: string,
  guardianId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("guardians")
    .update({ archived_at: null })
    .eq("organization_id", organizationId)
    .eq("id", guardianId)
    .select("id");

  if (error) {
    throw new Error(translateGuardianError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Veli kaydı bulunamadı veya geri yüklenemedi.");
  }
}

/**
 * Veli kaydına giriş hesabı bağlar (RPC çağrısı).
 */
export async function linkGuardianAccount(
  guardianId: string,
  membershipId: string
): Promise<void> {
  const { error } = await supabase.rpc("link_guardian_account", {
    target_guardian_id: guardianId,
    target_membership_id: membershipId,
  });

  if (error) {
    throw new Error(translateGuardianError(error));
  }
}

/**
 * Veli kaydının giriş hesabı bağını çözer (RPC çağrısı).
 */
export async function unlinkGuardianAccount(guardianId: string): Promise<void> {
  const { error } = await supabase.rpc("unlink_guardian_account", {
    target_guardian_id: guardianId,
  });

  if (error) {
    throw new Error(translateGuardianError(error));
  }
}

/**
 * Bir öğrencinin aktif veli bağlarını yükler.
 * Açık `organization_id` ve `student_id` süzgeci taşır.
 */
export async function loadStudentGuardianLinks(
  organizationId: string,
  studentId: string
): Promise<StudentGuardianLink[]> {
  const { data, error } = await supabase
    .from("student_guardians")
    .select(
      `
      id,
      organization_id,
      student_id,
      guardian_id,
      archived_at,
      guardians (
        id,
        full_name,
        phone,
        auth_user_id,
        archived_at
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .is("archived_at", null);

  if (error) {
    throw new Error("Öğrenci–veli bağları yüklenemedi.");
  }

  type RawLinkRow = {
    id: string;
    organization_id: string;
    student_id: string;
    guardian_id: string;
    archived_at: string | null;
    guardians?:
      | {
          id: string;
          full_name: string;
          phone?: string | null;
          auth_user_id?: string | null;
          archived_at?: string | null;
        }
      | {
          id: string;
          full_name: string;
          phone?: string | null;
          auth_user_id?: string | null;
          archived_at?: string | null;
        }[]
      | null;
  };

  const rawRows = (data ?? []) as unknown as RawLinkRow[];

  return rawRows
    .map(row => {
      const g = Array.isArray(row.guardians)
        ? (row.guardians[0] ?? null)
        : (row.guardians ?? null);
      return {
        id: row.id,
        organizationId: row.organization_id,
        studentId: row.student_id,
        guardianId: row.guardian_id,
        guardian: g
          ? {
              id: g.id,
              fullName: g.full_name,
              phone: g.phone ?? null,
              hasAccount: Boolean(g.auth_user_id),
              archivedAt: g.archived_at,
            }
          : null,
      };
    })
    .filter(row => {
      if (!row.guardian) return false;
      return (
        row.guardian.archivedAt === null ||
        row.guardian.archivedAt === undefined
      );
    })
    .map(row => ({
      id: row.id,
      organizationId: row.organizationId,
      studentId: row.studentId,
      guardianId: row.guardianId,
      guardian: row.guardian
        ? {
            id: row.guardian.id,
            fullName: row.guardian.fullName,
            phone: row.guardian.phone,
            hasAccount: row.guardian.hasAccount,
          }
        : undefined,
    }));
}

/**
 * Bir öğrenci ile veli arasında bağ kurar.
 * Daha önce arşivlenmiş bir bağ varsa onu canlandırır; yoksa yeni satır ekler.
 */
export async function linkStudentGuardian(
  organizationId: string,
  studentId: string,
  guardianId: string
): Promise<{ id: string }> {
  // Mevcut bir bağ (aktif veya arşivli) olup olmadığını kontrol et
  const { data: existing, error: existingErr } = await supabase
    .from("student_guardians")
    .select("id, archived_at")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("guardian_id", guardianId)
    .maybeSingle();

  if (existingErr) {
    throw new Error(translateGuardianError(existingErr));
  }

  if (existing) {
    if (existing.archived_at === null) {
      throw new Error("Bu veli bu öğrenciye zaten bağlı.");
    }
    // Arşivlenmiş bağı geri canlandır
    const { data: updated, error: updateErr } = await supabase
      .from("student_guardians")
      .update({ archived_at: null })
      .eq("organization_id", organizationId)
      .eq("id", existing.id)
      .select("id");

    if (updateErr) {
      throw new Error(translateGuardianError(updateErr));
    }

    if (!updated || updated.length === 0) {
      throw new Error("Öğrenci–veli bağı geri yüklenemedi.");
    }

    return { id: existing.id };
  }

  // Yeni bağ satırı ekle
  const { data, error } = await supabase
    .from("student_guardians")
    .insert({
      organization_id: organizationId,
      student_id: studentId,
      guardian_id: guardianId,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(translateGuardianError(error));
  }

  return data;
}

/**
 * Öğrenci–veli bağını koparır (arşivler). Satır KESİNLİKLE silinmez.
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function unlinkStudentGuardian(
  organizationId: string,
  linkId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("student_guardians")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", linkId)
    .select("id");

  if (error) {
    throw new Error(translateGuardianError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Öğrenci–veli bağı bulunamadı veya koparılamadı.");
  }
}

/**
 * Koparılmış (arşivlenmiş) bir öğrenci–veli bağını geri yükler (Geri al tostu için).
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function restoreStudentGuardianLink(
  organizationId: string,
  linkId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("student_guardians")
    .update({ archived_at: null })
    .eq("organization_id", organizationId)
    .eq("id", linkId)
    .select("id");

  if (error) {
    throw new Error(translateGuardianError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Öğrenci–veli bağı bulunamadı veya geri yüklenemedi.");
  }
}
