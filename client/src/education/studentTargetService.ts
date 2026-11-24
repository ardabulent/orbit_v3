import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";

/**
 * Hedef net (ana plan 4.10b, karar 2026-11-24): `student_targets`.
 *
 * Öğrenciyi görebilen okur (yönetici, okutan öğretmen, öğrencinin kendisi,
 * velisi); yalnız yönetici ve okutan öğretmen yazar. Yetki RLS'te — ekrandaki
 * düzenleme alanı yalnız kullanıcı deneyimidir. Hedef kaldırma, değeri
 * boşaltmaktır: satır kalır, denetim kaydına iz düşer.
 */

export type StudentTarget = {
  /** Boşsa toplam hedef. */
  subjectId?: string;
  subjectName?: string;
  targetNet: number;
};

export type StudentTargetChange = {
  subjectId?: string;
  /** `null` hedefi kaldırır. */
  targetNet: number | null;
};

export const TARGET_NET_MAX = 200;

function translateTargetError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;
  if (code === "42501") {
    return "Bu öğrencinin hedefini değiştirme yetkiniz yok.";
  }
  if (code === "23514") {
    return `Hedef 0 ile ${TARGET_NET_MAX} net arasında olmalı.`;
  }
  return userFacingErrorText(error) || "Hedefler kaydedilemedi.";
}

/** Öğrencinin geçerli hedefleri; toplam hedef önce. */
export async function loadStudentTargets(
  studentId: string
): Promise<StudentTarget[]> {
  const { data, error } = await supabase
    .from("student_targets")
    .select("subject_id, target_net, subjects(name)")
    .eq("student_id", studentId)
    .not("target_net", "is", null);
  if (error) {
    throw new Error(translateTargetError(error));
  }
  const targets: StudentTarget[] = [];
  for (const row of (data ?? []) as {
    subject_id?: string | null;
    target_net?: number | string | null;
    subjects?: { name?: string | null } | null;
  }[]) {
    const targetNet = Number(row.target_net);
    if (!Number.isFinite(targetNet)) continue;
    targets.push(
      row.subject_id
        ? {
            subjectId: row.subject_id,
            subjectName: row.subjects?.name?.trim() || "Ders",
            targetNet,
          }
        : { targetNet }
    );
  }
  return targets.sort(
    (a, b) =>
      (a.subjectId ? 1 : 0) - (b.subjectId ? 1 : 0) ||
      (a.subjectName ?? "").localeCompare(b.subjectName ?? "", "tr")
  );
}

/** Değişen hedefler tek istekte; "son değiştiren" alanını veritabanı doldurur. */
export async function saveStudentTargets(
  organizationId: string,
  studentId: string,
  changes: StudentTargetChange[]
): Promise<void> {
  if (changes.length === 0) return;
  for (const change of changes) {
    if (
      change.targetNet !== null &&
      (!Number.isFinite(change.targetNet) ||
        change.targetNet < 0 ||
        change.targetNet > TARGET_NET_MAX)
    ) {
      throw new Error(`Hedef 0 ile ${TARGET_NET_MAX} net arasında olmalı.`);
    }
  }
  const { error } = await supabase.from("student_targets").upsert(
    changes.map(change => ({
      organization_id: organizationId,
      student_id: studentId,
      subject_id: change.subjectId ?? null,
      target_net: change.targetNet,
    })),
    { onConflict: "student_id,subject_id" }
  );
  if (error) {
    throw new Error(translateTargetError(error));
  }
}
