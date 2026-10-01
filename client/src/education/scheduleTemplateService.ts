import { supabase } from "@/lib/supabaseClient";
import type { IsoWeekDay } from "./weekDays";

/**
 * Ders programı şablonu servis katmanı (2026-10-01).
 *
 * Kullanıcı geri bildirimi: "ders programı bir program oluşturup sınıflara
 * atama şeklinde olmalı." Haftalık tablo bir kez çizilir
 * (`schedule_templates` + `schedule_template_slots`) ve
 * `apply_schedule_template` ile çok sınıfa KOPYALANIR — şablon sonradan
 * değişse sınıfların programı değişmez.
 *
 * Atama iki adımdır: önce ön izleme (`dryRun: true`, hiçbir şey yazılmaz),
 * sonra kayıt. Ön izlemede öğretmensiz kalacak dersler (`unassigned`)
 * listelenir; ekran kaydetmeden önce "emin misiniz?" diye sorar.
 *
 * Yetki: tablolar ve fonksiyonlar yalnız kurum yöneticisine açıktır (RLS +
 * açık 42501). Buradaki hiçbir kontrol güvenlik sınırı değildir.
 */

export type TemplateSlot = {
  dayOfWeek: IsoWeekDay;
  /** "HH:MM" */
  startsAt: string;
  /** "HH:MM" ya da null */
  endsAt: string | null;
  subjectId: string;
};

export type ScheduleTemplate = {
  id: string;
  name: string;
  updatedAt: string;
  slots: TemplateSlot[];
};

export type ApplyMode = "replace" | "fill";

export type UnassignedReason = "no_teacher" | "teacher_busy";

export type ApplyResult = {
  saved: boolean;
  classes: {
    classId: string;
    className: string;
    added: number;
    archived: number;
    skipped: number;
  }[];
  unassigned: {
    className: string;
    dayOfWeek: IsoWeekDay;
    startsAt: string;
    subjectName: string;
    reason: UnassignedReason;
  }[];
};

type RawSlot = {
  day_of_week: number;
  starts_at: string;
  ends_at: string | null;
  subject_id: string;
};

type RawTemplate = {
  id: string;
  name: string;
  updated_at: string;
  schedule_template_slots: RawSlot[] | null;
};

const hhmm = (value: string) => value.slice(0, 5);

/** Kurumun etkin şablonları, ada göre sıralı; kutular gün ve saate göre. */
export async function loadScheduleTemplates(
  organizationId: string
): Promise<ScheduleTemplate[]> {
  const { data, error } = await supabase
    .from("schedule_templates")
    .select(
      "id, name, updated_at, schedule_template_slots(day_of_week, starts_at, ends_at, subject_id)"
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .is("schedule_template_slots.archived_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(translateTemplateError(error));
  }

  return ((data ?? []) as RawTemplate[]).map(row => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    slots: (row.schedule_template_slots ?? [])
      .map(slot => ({
        dayOfWeek: slot.day_of_week as IsoWeekDay,
        startsAt: hhmm(slot.starts_at),
        endsAt: slot.ends_at ? hhmm(slot.ends_at) : null,
        subjectId: slot.subject_id,
      }))
      .sort(
        (a, b) =>
          a.dayOfWeek - b.dayOfWeek || a.startsAt.localeCompare(b.startsAt)
      ),
  }));
}

/** Şablonu ve bütün kutularını tek işlemde yazar; şablon kimliğini döner. */
export async function saveScheduleTemplate(input: {
  organizationId: string;
  templateId: string | null;
  name: string;
  slots: TemplateSlot[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_schedule_template", {
    p_organization_id: input.organizationId,
    p_template_id: input.templateId,
    p_name: input.name.trim(),
    p_slots: input.slots.map(slot => ({
      day_of_week: slot.dayOfWeek,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      subject_id: slot.subjectId,
    })),
  });

  if (error) {
    throw new Error(translateTemplateError(error));
  }

  return data as string;
}

/**
 * Şablonu sınıflara atar. `dryRun: true` yalnız ne olacağını hesaplar ve
 * hiçbir şey yazmaz; ekran ön izlemeyi bununla gösterir.
 */
export async function applyScheduleTemplate(input: {
  templateId: string;
  classIds: string[];
  mode: ApplyMode;
  dryRun: boolean;
}): Promise<ApplyResult> {
  const { data, error } = await supabase.rpc("apply_schedule_template", {
    p_template_id: input.templateId,
    p_class_ids: input.classIds,
    p_mode: input.mode,
    p_dry_run: input.dryRun,
  });

  if (error) {
    throw new Error(translateTemplateError(error));
  }

  return mapApplyResult(data);
}

export function mapApplyResult(raw: unknown): ApplyResult {
  const value = (raw ?? {}) as {
    saved?: boolean;
    classes?: {
      class_id: string;
      class_name: string;
      added: number;
      archived: number;
      skipped: number;
    }[];
    unassigned?: {
      class_name: string;
      day_of_week: number;
      starts_at: string;
      subject_name: string;
      reason: UnassignedReason;
    }[];
  };
  return {
    saved: value.saved === true,
    classes: (value.classes ?? []).map(c => ({
      classId: c.class_id,
      className: c.class_name,
      added: c.added,
      archived: c.archived,
      skipped: c.skipped,
    })),
    unassigned: (value.unassigned ?? []).map(u => ({
      className: u.class_name,
      dayOfWeek: u.day_of_week as IsoWeekDay,
      startsAt: hhmm(u.starts_at),
      subjectName: u.subject_name,
      reason: u.reason,
    })),
  };
}

/** Sınıfın bütün etkin derslerini arşivler; kaç ders kaldırıldığını döner. */
export async function clearClassSchedule(classId: string): Promise<number> {
  const { data, error } = await supabase.rpc("clear_class_schedule", {
    p_class_id: classId,
  });

  if (error) {
    throw new Error(translateTemplateError(error));
  }

  return Number(data ?? 0);
}

/**
 * Şablonu arşivler (silmez). Daha önce atandığı sınıfların programı
 * değişmez — atama bir kopyadır. Sıfır satır etkilenirse hata (K-14).
 */
export async function archiveScheduleTemplate(
  organizationId: string,
  templateId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("schedule_templates")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", templateId)
    .is("archived_at", null)
    .select("id");

  if (error) {
    throw new Error(translateTemplateError(error));
  }
  if (!data || data.length === 0) {
    throw new Error("Şablon bulunamadı veya işlem yetkiniz yok.");
  }
}

export function translateTemplateError(error: unknown): string {
  const { code, message } = (error ?? {}) as {
    code?: string;
    message?: string;
  };
  if (code === "42501") {
    return "Bu işlem için kurum yöneticisi yetkisi gerekiyor.";
  }
  if (code === "P0002") {
    return "Şablon ya da sınıf bulunamadı; sayfayı yenileyip tekrar deneyin.";
  }
  // Fonksiyonlar 22023 ile Türkçe ve kullanıcıya gösterilebilir bir sebep
  // yazar (ör. "Aynı gün ve saatte iki ders olamaz").
  if (code === "22023" && message) {
    return message;
  }
  if (code === "23505") {
    return "Aynı gün ve saatte iki ders olamaz.";
  }
  if (code === "23503") {
    return "Seçilen ders ya da sınıf arşivlenmiş görünüyor.";
  }
  return "Şablon işlemi tamamlanamadı. Lütfen tekrar deneyin.";
}
