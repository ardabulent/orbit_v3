import { supabase } from "@/lib/supabaseClient";
import type { ScheduleItem } from "@/components/education/types";
import { isoToWeekDay } from "./weekDays";

/**
 * Ders programı servis katmanı (v1.3-01 · B parçası).
 *
 * `schedule_entries` tablosunu gerçek Supabase sorgusuna bağlar.
 *
 * **Açık organization_id süzgeci (K-24 / v1.4-13 R2):** Sorguda açıkça
 * `organization_id` filtresi yer alır; RLS ve servis katmanı birlikte korur.
 *
 * **Arşiv filtresi zorunludur:** `archived_at is null` filtresi uygulanır.
 *
 * **Sıralama açık yazılır:** Gün (day_of_week), sonra başlangıç saati (starts_at)
 * artan sırada sıralanır.
 *
 * **Öğretmen adı çözümü (#231):** `class_staff_names` RPC fonksiyonu üzerinden
 * yapılır. `profiles` tablosuna doğrudan sorgu atılmaz; çünkü `profiles` aynı
 * satırda `recovery_email`, `phone` ve şifre kilidi durumunu taşır ve RLS
 * sütun gizleyemez (#228). Ad çözülemezse alan `null` kalır; uydurma dizge
 * üretilmez (K-22).
 *
 * **Tip dürüstlüğü (K-03 & K-22):**
 * - Gün ISO 8601'dir (1..7); `isoToWeekDay()` tek kaynaktır (K-06).
 * - Ders adı: `subject_id` doluysa dersten, boşsa `title` sütunundan gelir.
 * - Süre: `ends_at - starts_at`'ten türetilir; `ends_at` boşsa süre üretilmez (null).
 * - `tone`: Servis tone üretmez; görsel bir Tailwind stili olup arayüzde nötr varsayılan uygulanır.
 */

/**
 * Programın toplam tavanı (2026-10-03). Eskiden 200'dü ve sorgu "gün, saat"
 * sırasıyla tek seferde çekiliyordu: kurumda 200'den fazla ders olunca
 * BÜTÜN sınıfların haftanın son günleri ekrandan kayboluyordu; süzgeçler
 * yalnız inen satırları süzdüğü için o derslere hiçbir yoldan ulaşılamıyordu.
 * Şablon ataması (#417) bu sınırı kolayca aşar: 10 sınıf × 30 ders = 300.
 * 5000 ≈ 50 sınıf × 100 ders; satırlar küçük, sayfa sayfa iner.
 *
 * Adı bilinçli olarak `DEFAULT_…_LIMIT` değil: o adlar TEK sorguluk tavandır
 * ve `postgrestLimits.test.ts` onları sunucu tavanının altında tutar. Bu bir
 * toplamdır; tek istek `SCHEDULE_PAGE_SIZE`'ı aşmaz.
 */
export const SCHEDULE_TOTAL_CAP = 5000;

/**
 * Sayfa boyu sunucu tavanının (`POSTGREST_MAX_ROWS`) ALTINDA olmak zorunda:
 * eşit olsaydı ve üretimdeki tavan bir gün düşürülseydi her sayfa eksik
 * gelir, döngü onu "son sayfa" sanıp durur, program sessizce kesilirdi.
 * Kapı: `postgrestLimits.test.ts`.
 */
const SCHEDULE_PAGE_SIZE = 500;

export type ScheduleListResult = {
  rows: ScheduleItem[];
  truncated: boolean;
};

export type RawScheduleRow = {
  id: string;
  day_of_week: number;
  starts_at: string;
  ends_at?: string | null;
  title?: string | null;
  room?: string | null;
  class_id: string;
  subject_id?: string | null;
  membership_id?: string | null;
  classes?:
    | { id?: string; name: string; archived_at?: string | null }
    | { id?: string; name: string; archived_at?: string | null }[]
    | null;
  subjects?:
    | { id?: string; name: string; archived_at?: string | null }
    | { id?: string; name: string; archived_at?: string | null }[]
    | null;
};

export function extractClassName(classes: unknown): string | null {
  if (!classes) return null;
  const clsObj = Array.isArray(classes) ? classes[0] : classes;
  if (!clsObj || typeof clsObj !== "object") return null;
  const cls = clsObj as { name?: string; archived_at?: string | null };
  if (cls.archived_at !== null && cls.archived_at !== undefined) {
    return null;
  }
  return cls.name?.trim() || null;
}

/** Ders adını arşiv durumuna BAKMADAN okur. Yalnız `resolveLessonTitle` kullanır. */
function readSubjectName(subjects: unknown): string | null {
  const subObj = Array.isArray(subjects) ? subjects[0] : subjects;
  if (!subObj || typeof subObj !== "object") return null;
  return ((subObj as { name?: string }).name ?? "").trim() || null;
}

export function extractSubjectName(subjects: unknown): string | null {
  if (!subjects) return null;
  const subObj = Array.isArray(subjects) ? subjects[0] : subjects;
  if (!subObj || typeof subObj !== "object") return null;
  const subject = subObj as { name?: string; archived_at?: string | null };
  if (subject.archived_at !== null && subject.archived_at !== undefined) {
    return null;
  }
  return subject.name?.trim() || null;
}

/**
 * Ders adını belirler (v1.3-01b · 2.B.2).
 *
 * Migration kuralı: `subject_id` doluysa ad dersten okunur; boşsa `title`
 * sütunundan. İkisi birden dolu olabilir ve ad iki yerde tutulmaz (K-06).
 */
export function resolveLessonTitle(
  subjectId: string | null | undefined,
  subjects: unknown,
  title: string | null | undefined
): string {
  if (subjectId) {
    // Arşiv durumuna BAKILMAZ ve bu bilinçli. Migration kuralı istisnasız:
    // "dolu olan `subject_id` ise ad dersten okunur". Arşivlenmek adı silmez;
    // geçmişte planlanmış bir dersin adı hâlâ o derstir.
    //
    // Arşivlenmişi eleyip `title`a düşseydik bir delik açılırdı: şema kısıtı
    // `subject_id is not null or title is not null` olduğu için `subject_id`
    // dolu bir satırda `title` BOŞ olabilir — ve ekranda ADSIZ bir ders satırı
    // çizilirdi.
    const subjectName = readSubjectName(subjects);
    if (subjectName) return subjectName;
  }
  return title?.trim() || "";
}

/**
 * Saat dizesini HH:MM biçiminde kırpar (ör. "09:00:00" -> "09:00").
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

/**
 * Ders süresini starts_at ve ends_at zamanlarından dakika cinsinden türetir (v1.3-01b · 2.B.4).
 *
 * `ends_at` boş ise kesinlikle süre üretilmez (null döner, K-22).
 */
export function calculateDuration(
  startsAt: string,
  endsAt?: string | null
): string | null {
  if (!endsAt) return null;
  const [startH, startM] = startsAt.split(":").map(Number);
  const [endH, endM] = endsAt.split(":").map(Number);
  if (
    Number.isNaN(startH) ||
    Number.isNaN(startM) ||
    Number.isNaN(endH) ||
    Number.isNaN(endM)
  ) {
    return null;
  }
  const diffMinutes = endH * 60 + endM - (startH * 60 + startM);
  if (diffMinutes <= 0) return null;
  return `${diffMinutes} dk`;
}

/**
 * Görüntülenen sınıfların öğretmen/vekil adlarını tek seferde çözer (v1.3-01b · 2.B.3).
 *
 * `profiles` tablosuna doğrudan sorgu gitmez; `class_staff_names` RPC kullanılır (#231).
 */
export async function loadStaffNames(
  classIds: string[]
): Promise<Map<string, string>> {
  const unique = classIds.filter(
    (id, index) => Boolean(id) && classIds.indexOf(id) === index
  );
  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("class_staff_names", {
    target_class_ids: unique,
  });

  if (error || !data) {
    return new Map();
  }

  const result = new Map<string, string>();
  for (const row of data as {
    class_id: string;
    membership_id: string;
    display_name: string;
  }[]) {
    if (row.membership_id && row.display_name) {
      result.set(row.membership_id, row.display_name);
    }
  }
  return result;
}

export function mapScheduleRow(
  row: RawScheduleRow,
  staffNames: Map<string, string>
): ScheduleItem | null {
  const day = isoToWeekDay(row.day_of_week);
  if (!day) return null;

  const title = resolveLessonTitle(row.subject_id, row.subjects, row.title);
  const group = extractClassName(row.classes);
  const teacher = row.membership_id
    ? (staffNames.get(row.membership_id) ?? null)
    : null;
  const room = row.room?.trim() || null;
  const time = formatTime(row.starts_at);
  const duration = calculateDuration(row.starts_at, row.ends_at);

  return {
    id: row.id,
    day,
    time,
    title,
    group,
    teacher,
    room,
    duration,
    classId: row.class_id,
    subjectId: row.subject_id ?? null,
    membershipId: row.membership_id ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? null,
    dayOfWeek: row.day_of_week,
    // tone: Servis tone üretmez (v1.3-01b · 2.C). Ekranda nötr varsayılan uygulanır.
  };
}

export async function loadSchedule(
  organizationId: string,
  limit = SCHEDULE_TOTAL_CAP
): Promise<ScheduleListResult> {
  if (!organizationId) {
    return { rows: [], truncated: false };
  }

  // Sayfa sayfa: sunucu tek yanıtta en çok `max_rows` satır döner. Sıralamada
  // `id` eşitlik bozucu; o olmadan aynı gün ve saatteki satırlar sayfalar
  // arasında yer değiştirip bir satır iki kez, bir başkası hiç gelmeyebilirdi.
  const rawRows: RawScheduleRow[] = [];
  while (rawRows.length < limit) {
    const from = rawRows.length;
    const to = Math.min(from + SCHEDULE_PAGE_SIZE, limit) - 1;
    const page = await loadSchedulePage(organizationId, from, to);
    rawRows.push(...page);
    if (page.length < to - from + 1) break;
  }

  const classIds = Array.from(
    new Set(rawRows.map(r => r.class_id).filter(Boolean))
  );

  const staffNames = await loadStaffNames(classIds);
  const rows = rawRows
    .map(r => mapScheduleRow(r, staffNames))
    .filter((item): item is ScheduleItem => item !== null);

  return {
    rows,
    // ⚠️ Ölçüt HAM satır sayısıdır, eşlenmiş satır sayısı değil. `mapScheduleRow`
    // geçersiz gün numarasında satır düşürebiliyor; `rows.length` üzerinden
    // hesaplasaydık, sorgu tam limite dayanmışken bir satır elendiği anda
    // kesilme bandı SESSİZCE çizilmezdi — sözleşmenin yasakladığı şeyin ta
    // kendisi (`DECISION_LOG` — "kesildiği söylenmeden hiçbir liste kesilmez").
    truncated: rawRows.length === limit,
  };
}

async function loadSchedulePage(
  organizationId: string,
  from: number,
  to: number
): Promise<RawScheduleRow[]> {
  const { data, error } = await supabase
    .from("schedule_entries")
    .select(
      `
      id,
      day_of_week,
      starts_at,
      ends_at,
      title,
      room,
      class_id,
      subject_id,
      membership_id,
      classes ( id, name, archived_at ),
      subjects ( id, name, archived_at )
    `
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("day_of_week", { ascending: true })
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error("Ders programı yüklenemedi.");
  }

  return (data ?? []) as RawScheduleRow[];
}

export type CreateScheduleEntryInput = {
  organizationId: string;
  classId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt?: string | null;
  subjectId?: string | null;
  title?: string | null;
  membershipId?: string | null;
  room?: string | null;
};

export type UpdateScheduleEntryInput = {
  dayOfWeek?: number;
  startsAt?: string;
  endsAt?: string | null;
  subjectId?: string | null;
  title?: string | null;
  membershipId?: string | null;
  room?: string | null;
};

/**
 * Yeni bir ders programı satırı oluşturur (yalnızca kurum yöneticisi / RLS).
 *
 * ⚠️ Yüke asla `id` KONMAZ — kimlik veritabanının işidir (#287 / K-00).
 * Migration kuralı: `subject_id` doluysa ad dersten okunur; `title`'ı ona yazma.
 */
export async function createScheduleEntry(
  input: CreateScheduleEntryInput
): Promise<{ id: string }> {
  const payload: {
    organization_id: string;
    class_id: string;
    day_of_week: number;
    starts_at: string;
    ends_at?: string | null;
    subject_id?: string | null;
    title?: string | null;
    membership_id?: string | null;
    room?: string | null;
  } = {
    organization_id: input.organizationId,
    class_id: input.classId,
    day_of_week: input.dayOfWeek,
    starts_at: input.startsAt,
  };

  if (input.endsAt !== undefined) {
    payload.ends_at = input.endsAt || null;
  }
  if (input.room !== undefined) {
    payload.room = input.room?.trim() || null;
  }
  if (input.membershipId !== undefined) {
    payload.membership_id = input.membershipId || null;
  }

  if (input.subjectId) {
    payload.subject_id = input.subjectId;
    payload.title = null;
  } else {
    payload.subject_id = null;
    payload.title = input.title?.trim() || null;
  }

  const { data, error } = await supabase
    .from("schedule_entries")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(translateScheduleError(error));
  }

  return { id: data.id };
}

/**
 * Mevcut bir ders programı satırını günceller (yalnızca kurum yöneticisi / RLS).
 *
 * ⚠️ Yüke asla `id`, `organization_id` veya `class_id` KONMAZ.
 * `class_id` UPDATE yetkisinde yoktur; bir program satırını başka sınıfa taşımak
 * onu düzeltmek değil, başka bir satır yapmaktır.
 * Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function updateScheduleEntry(
  organizationId: string,
  entryId: string,
  input: UpdateScheduleEntryInput
): Promise<void> {
  const payload: {
    day_of_week?: number;
    starts_at?: string;
    ends_at?: string | null;
    subject_id?: string | null;
    title?: string | null;
    membership_id?: string | null;
    room?: string | null;
  } = {};

  if (input.dayOfWeek !== undefined) {
    payload.day_of_week = input.dayOfWeek;
  }
  if (input.startsAt !== undefined) {
    payload.starts_at = input.startsAt;
  }
  if (input.endsAt !== undefined) {
    payload.ends_at = input.endsAt || null;
  }
  if (input.room !== undefined) {
    payload.room = input.room?.trim() || null;
  }
  if (input.membershipId !== undefined) {
    payload.membership_id = input.membershipId || null;
  }

  if (input.subjectId !== undefined) {
    if (input.subjectId) {
      payload.subject_id = input.subjectId;
      payload.title = null;
    } else {
      payload.subject_id = null;
      if (input.title !== undefined) {
        payload.title = input.title?.trim() || null;
      }
    }
  } else if (input.title !== undefined) {
    payload.title = input.title?.trim() || null;
  }

  const { data, error } = await supabase
    .from("schedule_entries")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", entryId)
    .is("archived_at", null)
    .select("id");

  if (error) {
    throw new Error(translateScheduleError(error));
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Ders programı kaydı bulunamadı veya güncelleme yetkiniz yok."
    );
  }
}

/**
 * Ders programı satırını arşivler (kaldırır).
 *
 * ⚠️ DELETE yoktur; arşiv deseni geçerlidir.
 * Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function archiveScheduleEntry(
  organizationId: string,
  entryId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("schedule_entries")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", entryId)
    .is("archived_at", null)
    .select("id");

  if (error) {
    throw new Error(translateScheduleError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ders programı kaydı bulunamadı veya işlem yetkiniz yok.");
  }
}

/**
 * Ders programı veritabanı ve RLS hatalarını Türkçe insan dostu mesajlara dönüştürür.
 *
 * 🔴 23505 çakışması:
 * - schedule_entries_class_slot_idx: Bu saatte sınıfın başka bir dersi var.
 * - schedule_entries_teacher_slot_idx: Bu saatte öğretmenin başka bir dersi var.
 */
export function translateScheduleError(error: unknown): string {
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
    for (const known of ["23505", "23514", "23503", "42501"]) {
      if (message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "23505") {
    if (
      message.includes("schedule_entries_class_slot_idx") ||
      details?.includes("class_id")
    ) {
      return "Bu saatte sınıfın başka bir dersi bulunuyor.";
    }
    if (
      message.includes("schedule_entries_teacher_slot_idx") ||
      details?.includes("membership_id")
    ) {
      return "Bu saatte öğretmenin başka bir dersi bulunuyor.";
    }
    return "Bu saatte çakışan bir ders programı kaydı var.";
  }

  if (code === "23514") {
    if (message.includes("schedule_entries_time_check")) {
      return "Bitiş saati başlangıç saatinden sonra olmalıdır.";
    }
    if (message.includes("schedule_entries_label_check")) {
      return "Ders seçilmeli veya bir ders başlığı girilmelidir.";
    }
    if (message.includes("schedule_entries_title_check")) {
      return "Ders başlığı 1 ile 120 karakter arasında olmalıdır.";
    }
    if (message.includes("schedule_entries_day_check")) {
      return "Geçerli bir gün seçilmelidir (Pazartesi-Pazar).";
    }
    return "Girilen ders programı bilgileri kurallara uygun değil.";
  }

  if (code === "23503") {
    return "Seçilen sınıf, ders veya öğretmen bulunamadı ya da arşivlenmiş.";
  }

  if (code === "42501") {
    return "Bu işlem için kurum yöneticisi yetkisi gerekiyor.";
  }

  return "Ders programı işlemi gerçekleştirilemedi. Lütfen tekrar deneyin.";
}
