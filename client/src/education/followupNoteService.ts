import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";

/**
 * Takip notu ve görüşme kaydı (ana plan 4.10c, karar 2026-11-24).
 *
 * Yönetici ve öğrenciyi okutan öğretmen görür ve yazar; yalnız yazan ya da
 * yönetici düzeltir/arşivler. Öğrenci ve veli görmez. Yetki RLS'te ve liste
 * fonksiyonunda (`student_followup_notes_list`); `canEdit` yalnız kullanıcı
 * deneyimidir. Not metni kişisel veridir: log'a ve analitiğe yazılmaz.
 */

export const NOTE_KINDS = [
  "observation",
  "student_meeting",
  "guardian_meeting",
] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  observation: "Gözlem",
  student_meeting: "Öğrenci görüşmesi",
  guardian_meeting: "Veli görüşmesi",
};

export const NOTE_BODY_MAX = 2000;

export type FollowupNote = {
  id: string;
  kind: NoteKind;
  occurredOn: string;
  body: string;
  authorName: string;
  isMine: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FollowupNoteInput = {
  kind: NoteKind;
  occurredOn: string;
  body: string;
};

const isNoteKind = (value: unknown): value is NoteKind =>
  typeof value === "string" &&
  (NOTE_KINDS as readonly string[]).includes(value);

function translateNoteError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;
  if (code === "42501") {
    return "Bu not için yetkiniz yok.";
  }
  if (code === "23514") {
    // Tarih kuralının Türkçe metni veritabanından gelir; gövde kuralı değil.
    return (
      userFacingErrorText(error) ||
      "Not boş olamaz ve en fazla 2000 karakter olabilir."
    );
  }
  return userFacingErrorText(error) || "Notlar işlenirken bir hata oluştu.";
}

export function validateNoteInput(
  input: FollowupNoteInput,
  today: string
): string | null {
  const body = input.body.trim();
  if (!body) return "Not boş olamaz.";
  if (body.length > NOTE_BODY_MAX) {
    return `Not en fazla ${NOTE_BODY_MAX} karakter olabilir.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return "Tarih seçin.";
  if (input.occurredOn > today) return "Görüşme tarihi bugünden ileri olamaz.";
  return null;
}

export async function loadFollowupNotes(
  studentId: string
): Promise<FollowupNote[]> {
  const { data, error } = await supabase.rpc("student_followup_notes_list", {
    p_student_id: studentId,
  });
  if (error) {
    throw new Error(translateNoteError(error));
  }
  const notes: FollowupNote[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    if (typeof row.id !== "string" || !isNoteKind(row.kind)) continue;
    notes.push({
      id: row.id,
      kind: row.kind,
      occurredOn: String(row.occurred_on ?? ""),
      body: String(row.body ?? ""),
      authorName: String(row.author_name ?? "Kurum üyesi"),
      isMine: row.is_mine === true,
      canEdit: row.can_edit === true,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    });
  }
  return notes;
}

export async function createFollowupNote(
  organizationId: string,
  studentId: string,
  input: FollowupNoteInput
): Promise<void> {
  const { error } = await supabase.from("student_followup_notes").insert({
    organization_id: organizationId,
    student_id: studentId,
    kind: input.kind,
    occurred_on: input.occurredOn,
    body: input.body.trim(),
  });
  if (error) {
    throw new Error(translateNoteError(error));
  }
}

/** Satır güncellenmediyse (yetki yok) sessiz geçmez: hata verir. */
async function updateNote(
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { data, error } = await supabase
    .from("student_followup_notes")
    .update(patch)
    .eq("id", id)
    .select("id");
  if (error) {
    throw new Error(translateNoteError(error));
  }
  if (!data || data.length === 0) {
    throw new Error("Bu notu yalnız yazan ya da yönetici değiştirebilir.");
  }
}

export function updateFollowupNote(id: string, input: FollowupNoteInput) {
  return updateNote(id, {
    kind: input.kind,
    occurred_on: input.occurredOn,
    body: input.body.trim(),
  });
}

export function archiveFollowupNote(id: string) {
  return updateNote(id, { archived_at: new Date().toISOString() });
}
