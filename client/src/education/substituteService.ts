import { supabase } from "@/lib/supabaseClient";

/**
 * Vekil öğretmen atamaları (`substitute_assignments`, `20261005000000`).
 *
 * Vekillik süresince vekil, izinli öğretmenin sınıflarının öğretmenidir;
 * yetkiyi veritabanı verir (`current_user_teaches_class`). Bu modül yalnız
 * kaydı okur, açar ve iptal eder. Kişiler sonradan değiştirilemez (sütun
 * yetkisi) — başka biri vekil olacaksa kayıt iptal edilip yenisi açılır.
 */

export type SubstituteAssignment = {
  id: string;
  organizationId: string;
  absentMembershipId: string;
  substituteMembershipId: string;
  /** "YYYY-MM-DD", kurum saatiyle; iki uç dahil. */
  startsOn: string;
  endsOn: string;
  note: string | null;
  archivedAt: string | null;
  createdAt?: string;
};

export type SubstituteListResult = {
  rows: SubstituteAssignment[];
  truncated: boolean;
};

export type CreateSubstituteInput = {
  organizationId: string;
  absentMembershipId: string;
  substituteMembershipId: string;
  startsOn: string;
  endsOn: string;
  note?: string | null;
};

export const DEFAULT_SUBSTITUTE_LIMIT = 200;

type RawSubstituteRow = {
  id: string;
  organization_id: string;
  absent_membership_id: string;
  substitute_membership_id: string;
  starts_on: string;
  ends_on: string;
  note: string | null;
  archived_at: string | null;
  created_at?: string;
};

const COLUMNS =
  "id, organization_id, absent_membership_id, substitute_membership_id, starts_on, ends_on, note, archived_at, created_at";

function mapSubstitute(row: RawSubstituteRow): SubstituteAssignment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    absentMembershipId: row.absent_membership_id,
    substituteMembershipId: row.substitute_membership_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    note: row.note?.trim() || null,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

/**
 * Kurumun iptal edilmemiş vekillikleri, en yeni başlangıç önce.
 *
 * - Açık `organization_id` süzgeci (K-19).
 * - Açık üst sınır ve `truncated` (K-03).
 * - Hata fırlatılır, boş liste dönülmez (K-22).
 */
export async function loadSubstitutes(
  organizationId: string,
  limit = DEFAULT_SUBSTITUTE_LIMIT
): Promise<SubstituteListResult> {
  if (!organizationId) {
    return { rows: [], truncated: false };
  }

  const { data, error } = await supabase
    .from("substitute_assignments")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("starts_on", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(translateSubstituteError(error));
  }

  const rows = ((data ?? []) as RawSubstituteRow[]).map(mapSubstitute);
  return { rows, truncated: rows.length === limit };
}

/**
 * Yeni vekillik açar (yalnız yönetici — RLS).
 *
 * ⚠️ Yüke `id` KONMAZ; sütun yetkisi de izin vermez (K-00).
 */
export async function createSubstitute(
  input: CreateSubstituteInput
): Promise<SubstituteAssignment> {
  const note = input.note?.trim() || null;
  const { data, error } = await supabase
    .from("substitute_assignments")
    .insert({
      organization_id: input.organizationId,
      absent_membership_id: input.absentMembershipId,
      substitute_membership_id: input.substituteMembershipId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      note,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    throw new Error(translateSubstituteError(error));
  }

  return mapSubstitute(data as RawSubstituteRow);
}

/**
 * Vekilliği iptal eder (arşiv). Yetki o an kapanır.
 * Sıfır satır etkilenirse hata fırlatır (K-14).
 */
export async function cancelSubstitute(
  organizationId: string,
  substituteId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("substitute_assignments")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", substituteId)
    .is("archived_at", null)
    .select("id");

  if (error) {
    throw new Error(translateSubstituteError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Vekillik bulunamadı veya iptal yetkiniz yok.");
  }
}

/**
 * Veritabanı hatasını kullanıcı cümlesine çevirir; ham ayrıntı basılmaz
 * (K-23). Kodlar göçteki kurallardan: tarih/kişi denetimi (23514), kurum
 * sınırı (23503), uygunluk (ORB03), yetki (42501).
 */
export function translateSubstituteError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  if (code === "23514") {
    if (message.includes("distinct_people")) {
      return "Öğretmen kendi yerine vekil olamaz.";
    }
    if (message.includes("dates")) {
      return "Bitiş tarihi başlangıçtan önce olamaz.";
    }
    return "Girilen bilgiler geçerli değil.";
  }
  if (code === "ORB03") {
    return "Vekillik yalnız öğretmenler arasında yapılabilir.";
  }
  if (code === "23503") {
    return "Seçilen öğretmen bu kurumda bulunamadı.";
  }
  if (code === "42501") {
    return "Bu işlem için yetkiniz yok.";
  }
  return "Vekillik kaydedilemedi. Lütfen tekrar deneyin.";
}
