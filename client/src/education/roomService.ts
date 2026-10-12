import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";

/**
 * Derslikler (2026-10-12, ROADMAP v1.5-15).
 *
 * Derslik kurumun kaydıdır; ders programı onu kimliğiyle seçer (serbest metin
 * "A-101" ile "A101"i ayrı yer sayıyordu). Aynı saatte iki derse verilmesini
 * veritabanı engeller (`enforce_room_is_free`, ORB07) ve sebebi Türkçe söyler.
 * "Paylaşılabilir" derslik (Online, Bahçe) bu kuralın dışındadır.
 *
 * Yazma yetkisi yalnız yöneticide; kontrol veritabanında (RLS).
 */

export type Room = {
  id: string;
  name: string;
  shareable: boolean;
  archivedAt: string | null;
};

export const ROOM_NAME_MAX = 60;
const ROOM_LIMIT = 300;

type RawRoom = {
  id: string;
  name: string;
  shareable: boolean;
  archived_at: string | null;
};

const mapRoom = (row: RawRoom): Room => ({
  id: row.id,
  name: row.name.trim(),
  shareable: row.shareable,
  archivedAt: row.archived_at,
});

function codeOf(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

export function translateRoomError(error: unknown): string {
  const code = codeOf(error);
  if (code === "23505") {
    return "Bu adla bir derslik zaten var. Farklı bir ad girin.";
  }
  if (code === "23514") {
    return `Derslik adı 1 ile ${ROOM_NAME_MAX} karakter arasında olmalı.`;
  }
  if (code === "42501") {
    return "Derslikleri yalnız kurum yöneticisi düzenleyebilir.";
  }
  // ORB03 (kullanımdaki derslik kapatılamaz) ve ORB07 (paylaşım kapatılırken
  // çakışma) veritabanının kendi Türkçe cümlesiyle gelir.
  return userFacingErrorText(error) ?? "Derslik işlemi yapılamadı.";
}

export async function loadRooms(
  organizationId: string,
  options?: { includeArchived?: boolean }
): Promise<Room[]> {
  if (!organizationId) return [];
  let query = supabase
    .from("rooms")
    .select("id, name, shareable, archived_at")
    .eq("organization_id", organizationId);
  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }
  const { data, error } = await query
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .limit(ROOM_LIMIT);
  if (error) {
    throw new Error(translateRoomError(error));
  }
  return ((data ?? []) as RawRoom[]).map(mapRoom);
}

export async function createRoom(input: {
  organizationId: string;
  name: string;
  shareable: boolean;
}): Promise<Room> {
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      organization_id: input.organizationId,
      name: input.name.trim(),
      shareable: input.shareable,
    })
    .select("id, name, shareable, archived_at")
    .single();
  if (error) {
    throw new Error(translateRoomError(error));
  }
  return mapRoom(data as RawRoom);
}

async function updateRoomRow(
  roomId: string,
  patch: { name?: string; shareable?: boolean; archived_at?: string | null }
): Promise<void> {
  const { data, error } = await supabase
    .from("rooms")
    .update(patch)
    .eq("id", roomId)
    .select("id");
  if (error) {
    throw new Error(translateRoomError(error));
  }
  // K-14: sıfır satır etkileyen yazma "oldu" demez.
  if (!data || data.length === 0) {
    throw new Error("Derslik bulunamadı veya güncellenemedi.");
  }
}

export function updateRoom(
  roomId: string,
  input: { name: string; shareable: boolean }
): Promise<void> {
  return updateRoomRow(roomId, {
    name: input.name.trim(),
    shareable: input.shareable,
  });
}

export function archiveRoom(roomId: string): Promise<void> {
  return updateRoomRow(roomId, { archived_at: new Date().toISOString() });
}

export function restoreRoom(roomId: string): Promise<void> {
  return updateRoomRow(roomId, { archived_at: null });
}
