import { supabase } from "@/lib/supabaseClient";

/**
 * Kurum denetim kaydı servisi (#149, v1.2-12).
 *
 * `audit_events` Faz E'den beri yazılıyor ama **hiçbir istemci kodu okumuyordu**.
 * Politika (`audit_events_select_admin`) var olmayan bir okuyucu için yazılmıştı.
 * Bu modül o okuyucudur.
 *
 * Neden önemli: "Rol, atama ve bağlantı üç ayrı kavramdır" kararı, yönetici-veli
 * çıkar çatışmasının karşılığını **erişimi kısıtlamak değil izlenebilirlik**
 * olarak koymuştu — "kaydın kim tarafından yapıldığı görünmelidir". Yazma tarafı
 * vardı, görünme tarafı yoktu; karar yarım uygulanmış duruyordu.
 *
 * **Kapsam sorgulanmıyor.** `organization_id` filtresi bilinçli olarak yok: RLS
 * zaten yalnızca çağıranın kurumunun satırlarını döndürüyor. Burada ikinci kez
 * filtrelemek, v1.2-10'da kaldırılan çift kaynağın aynısı olurdu (K-06).
 */

export type AuditActor =
  | { kind: "member"; name: string }
  | { kind: "outside" }
  | { kind: "system" }
  | { kind: "unresolved" };

export type OrganizationAuditEvent = {
  id: number;
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  /** Etkilenen kaydın sunucuda kurulan adı; kurulamadıysa `null` (K-03). */
  label: string | null;
  /** Güncellemede değişen alanların ADLARI — değerleri asla gelmez. */
  changed: string[];
};

type AuditRow = {
  id: number;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  label: string | null;
  changed: string[] | null;
};

/** Denetim Kaydı süzgeci (karar 2026-09-29). Boş alan = süzme yok. */
export type AuditActionKind =
  "created" | "updated" | "archived" | "restored" | "other";

export type AuditFilters = {
  actorUserId: string | null;
  actionKind: AuditActionKind | null;
  entityType: string | null;
  /** İstanbul günü, "YYYY-MM-DD". */
  from: string | null;
  to: string | null;
};

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  actorUserId: null,
  actionKind: null,
  entityType: null,
  from: null,
  to: null,
};

export const AUDIT_ACTION_KIND_LABELS: Record<AuditActionKind, string> = {
  created: "Ekleme",
  updated: "Değiştirme",
  archived: "Arşivleme",
  restored: "Geri yükleme",
  other: "Diğer (hesap, şifre, kurum)",
};

/**
 * Aktörü dört durumdan birine çözer.
 *
 * Dört olmasının sebebi K-09: "okunamadı" ile "yok" aynı cevap değildir ve
 * ikisini tek bir `string | null` alanında tutmak, ekranı yanlış konuşmaya
 * zorlar. Burada üç ayrı bilinmezlik var ve üçü farklı şeyler söylüyor:
 *
 *   * `system`   — kaydın aktörü hiç yazılmamış (`actor_user_id is null`).
 *   * `outside`  — isim sorgusu **başarılı** ama bu kimlik dönmedi. Bu bir
 *     tahmin değil **mantıksal kesinlik**: `profiles_select_organization_admin`
 *     tam olarak yöneticinin kendi kurumundaki kişileri döndürür, dolayısıyla
 *     dönmemesi "bu kişi bu kurumun üyesi değil" demektir. Pratikte kurumu
 *     kuran platform operatörü.
 *   * `unresolved` — isim sorgusu **başarısız**. Burada hiçbir şey iddia
 *     edilemez; ekran "kurum dışı" derse yalan söylemiş olur.
 */
export function resolveAuditActor(
  actorUserId: string | null,
  names: Map<string, string> | null
): AuditActor {
  if (actorUserId === null) {
    return { kind: "system" };
  }

  if (names === null) {
    return { kind: "unresolved" };
  }

  const name = names.get(actorUserId);

  return name === undefined ? { kind: "outside" } : { kind: "member", name };
}

const ENTITY_LABELS: Record<string, string> = {
  organization: "Kurum",
  organization_membership: "Üyelik",
  branch: "Şube",
  student: "Öğrenci",
  guardian: "Veli",
  student_guardian: "Öğrenci–Veli Bağı",
  class: "Sınıf",
  class_enrollment: "Sınıf Kaydı",
  class_teacher: "Sınıf Öğretmeni",
  subject: "Ders",
  schedule_entry: "Ders Programı",
  substitute_assignment: "Vekil Öğretmen",
  attendance_session: "Yoklama Oturumu",
  attendance_record: "Yoklama Kaydı",
  exam: "Sınav",
  exam_section: "Sınav Bölümü",
  exam_result: "Sınav Sonucu",
  exam_section_result: "Bölüm Sonucu",
  homework: "Ödev",
  homework_submission: "Ödev Teslimi",
  feed_post: "Duyuru",
  payment_plan: "Ödeme Planı",
  installment: "Taksit",
};

/**
 * Tetikleyicinin (`audit_row_change`) yazdığı standart eylemler. Liste elle
 * tutulur ve bilerek türetilmez: `attendance_record.created` gibi hiç
 * yazılmayan bir eylem için etiket UYDURULMAZ (hacim kısıtı, §4.12). Burada
 * olmayan eylem ekranda ham koduyla görünür (K-03).
 */
const TRIGGER_ACTIONS: Record<string, string[]> = {
  branch: ["created", "updated", "archived", "restored"],
  student: ["created", "updated", "archived", "restored"],
  guardian: ["created", "updated", "archived", "restored"],
  student_guardian: ["created", "archived", "restored"],
  class: ["created", "updated", "archived", "restored"],
  class_enrollment: ["created", "archived", "restored"],
  class_teacher: ["created", "updated", "archived", "restored"],
  subject: ["created", "updated", "archived", "restored"],
  schedule_entry: ["created", "updated", "archived", "restored"],
  substitute_assignment: ["created", "updated", "archived", "restored"],
  attendance_session: ["created", "updated", "archived", "restored"],
  attendance_record: ["updated"],
  exam: ["created", "updated", "archived", "restored"],
  exam_section: ["created", "updated", "archived", "restored"],
  exam_result: ["created", "updated", "archived", "restored"],
  exam_section_result: ["created", "updated", "archived", "restored"],
  homework: ["created", "updated", "archived", "restored"],
  homework_submission: ["created", "archived", "restored"],
  feed_post: ["created", "updated", "archived", "restored"],
  payment_plan: ["created", "updated", "archived", "restored"],
  installment: ["created", "updated", "archived", "restored"],
};

const VERB_LABELS: Record<string, string> = {
  created: "eklendi",
  updated: "güncellendi",
  archived: "arşivlendi",
  restored: "geri yüklendi",
};

/**
 * `action` değerlerinin Türkçe karşılıkları.
 *
 * ⚠️ Özel eylemler Edge Function'lardaki dize sabitlerinin **ikizidir**
 * (K-06). Orada yeni bir eylem yazıldığında burası güncellenmezse ekran ham
 * kodu gösterir — uydurma bir etiket üretmez (K-03). Bozulma biçimi bilinçli
 * seçildi: ham kod çirkin ama doğru, uydurulmuş etiket güzel ama yanlış olurdu.
 */
const ACTION_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(TRIGGER_ACTIONS).flatMap(([entity, verbs]) =>
      verbs.map(verb => [
        `${entity}.${verb}`,
        `${ENTITY_LABELS[entity]} ${VERB_LABELS[verb]}`,
      ])
    )
  ),
  "organization.bootstrap": "Kurum kuruldu",
  "membership.created": "Üye eklendi",
  "membership.removed": "Üyelik kaldırıldı",
  "membership.role_changed": "Üyenin rolü değişti",
  "membership.password_reset": "Şifre sıfırlandı",
  "student.account_linked": "Öğrenci hesabı bağlandı",
  "student.account_unlinked": "Öğrenci hesap bağı çözüldü",
  "guardian.account_linked": "Veli hesabı bağlandı",
  "guardian.account_unlinked": "Veli hesap bağı çözüldü",
  "person.accounts_linked": "Kişinin hesapları birleştirildi",
  "person.account_switched": "Hesap değiştirildi",
  "account_link.severed": "Hesap bağı koparıldı",
  "class_enrollment.created": "Sınıfa öğrenci kaydedildi",
  "class_enrollment.archived": "Öğrencinin sınıf kaydı sonlandırıldı",
  "class_enrollment.restored": "Öğrencinin sınıf kaydı geri yüklendi",
  "attendance_session.created": "Yoklama oturumu açıldı",
  "attendance_session.updated": "Yoklama oturumu güncellendi",
  "attendance_session.archived": "Yoklama oturumu arşivlendi",
  "attendance_session.restored": "Yoklama oturumu geri yüklendi",
  "attendance_record.updated": "Yoklama kaydı güncellendi",
  "exam_result.created": "Sınav sonucu eklendi",
  "exam_result.updated": "Sınav sonucu güncellendi",
  "feed_post.created": "Duyuru paylaşıldı",
};

/** Süzgeçte seçilebilen kayıt türleri, Türkçe ada göre sıralı. */
export const AUDIT_ENTITY_OPTIONS = Object.entries(ENTITY_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((x, y) => x.label.localeCompare(y.label, "tr"));

/**
 * Değişen alan adlarının Türkçesi. Değerler hiç gelmez; yalnız ad. Bilinmeyen
 * alan ham adıyla görünür (K-03).
 */
const FIELD_LABELS: Record<string, string> = {
  full_name: "Ad soyad",
  phone: "Telefon",
  student_number: "Öğrenci numarası",
  auth_user_id: "Hesap bağlantısı",
  branch_id: "Şube",
  is_default: "Varsayılan şube",
  name: "Ad",
  title: "Başlık",
  description: "Açıklama",
  program: "Program",
  capacity: "Kontenjan",
  mentor_membership_id: "Rehber öğretmen",
  membership_id: "Öğretmen",
  absent_membership_id: "Gelmeyen öğretmen",
  substitute_membership_id: "Vekil öğretmen",
  class_id: "Sınıf",
  subject_id: "Ders",
  student_id: "Öğrenci",
  guardian_id: "Veli",
  session_id: "Yoklama oturumu",
  session_date: "Tarih",
  starts_at: "Başlangıç saati",
  day_of_week: "Gün",
  room: "Derslik",
  starts_on: "Başlangıç günü",
  ends_on: "Bitiş günü",
  status: "Durum",
  exam_id: "Sınav",
  section_id: "Bölüm",
  exam_date: "Sınav tarihi",
  max_score: "Tam puan",
  net_penalty: "Yanlış cezası",
  question_count: "Soru sayısı",
  score: "Puan / net",
  correct: "Doğru",
  wrong: "Yanlış",
  homework_id: "Ödev",
  due_date: "Tarih",
  submissions_recorded_at: "Teslim işaretlemesi",
  audience: "Hedef kitle",
  pinned: "Sabitleme",
  plan_id: "Ödeme planı",
  total_amount: "Toplam tutar",
  amount: "Tutar",
  sequence_no: "Taksit sırası",
  paid_at: "Ödeme",
};

export function describeAuditField(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function describeAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function describeAuditEntity(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

/**
 * Kaydın zamanını okunur hâle getirir; çözülemeyen bir tarihte **hiçbir şey**
 * göstermez (K-03). `NaN` veya "Invalid Date" basmaktansa boş bırakmak doğru.
 */
export function formatAuditMoment(value: string): string | null {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * İsimleri ayrı sorguluyor.
 *
 * Gömülü join (`profiles(...)`) burada çalışmaz: `audit_events.actor_user_id`
 * `auth.users`'a bakıyor, `public.profiles`'a değil; PostgREST ilişkiyi göremez.
 * Aynı gerekçe `platformService.loadDisplayNames`'te de yazılı.
 *
 * Hata durumunda **boş harita değil `null`** dönüyor. Boş harita dönseydi
 * çağıran, "sorgu başarılı ama kimse bulunamadı" ile "sorgu başarısız"ı
 * ayırt edemez ve herkesi "kurum dışı" ilan ederdi.
 */
async function loadMemberNames(
  userIds: string[]
): Promise<Map<string, string> | null> {
  const unique = userIds.filter(
    (value, index) => userIds.indexOf(value) === index
  );

  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", unique);

  if (error) {
    return null;
  }

  return new Map((data ?? []).map(row => [row.id, row.display_name]));
}

/**
 * "Kim yaptı" süzgecinin seçenekleri: yöneticinin görebildiği kişiler
 * (`profiles_select_organization_admin` — kendi kurumundakiler), ada göre.
 */
export async function loadAuditActors(): Promise<
  { id: string; name: string }[]
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");

  if (error) {
    throw new Error("Kişi listesi yüklenemedi.");
  }

  return (data ?? [])
    .filter(row => Boolean(row.display_name))
    .map(row => ({ id: row.id, name: row.display_name }));
}

export type AuditPage<T> = {
  rows: T[];
  /** Sonraki sayfanın imleci. `null` ise liste GERÇEKTEN bitti. */
  nextCursor: number | null;
};

export const DEFAULT_AUDIT_LIMIT = 50;

/**
 * Kurumun denetim kaydından bir sayfa okur (v1.3-06).
 *
 * **İmleç `id` üzerindedir, `created_at` değil.** `created_at` varsayılanı
 * `now()` ve `now()` işlem başlangıç zamanıdır; aynı işlemde yazılan olaylar
 * birebir aynı damgayı taşır ve zaman damgası imleci onları sessizce atlardı
 * (`DECISION_LOG` — "Denetim kaydının imleci saat değil sıra numarasıdır").
 *
 * ⚠️ **`organization_id` süzmesi RLS'e ek olarak AÇIKÇA yazılıyor** ve bu bir
 * güvenlik önlemi değil, bir **indeks** meselesi. Kapsam zaten RLS'ten geliyor;
 * ama RLS koşulu `current_user_has_membership(...)` bir **fonksiyon çağrısıdır**,
 * sabit üzerinde bir eşitlik değil. Planlayıcı onu indeks koşuluna çeviremiyor.
 *
 * Canlıda ölçüldü (2026-09-09, `enable_seqscan = off` ile zorlanarak):
 *
 *     süzme YOKken → Index Scan Backward using audit_events_pkey
 *                    Filter: current_user_has_membership(...)
 *     süzme VARken → Index Scan using audit_events_org_id_desc_idx
 *                    Index Cond: (organization_id = ... AND id < ...)
 *
 * Yani açık süzme olmadan `(organization_id, id desc)` indeksi hiç
 * kullanılmıyor; sorgu birincil anahtarı geriye tarayıp RLS fonksiyonunu
 * **her satırda** çalıştırıyor. Tablo kurumlar arası büyüdükçe küçük bir
 * kurumun 51 satırını bulmak sınırsız sayıda satır taramak demek.
 */
export async function loadOrganizationAuditEvents(
  organizationId: string,
  limit = DEFAULT_AUDIT_LIMIT,
  cursor?: number | null,
  filters: AuditFilters = EMPTY_AUDIT_FILTERS
): Promise<AuditPage<OrganizationAuditEvent>> {
  // `organization_audit_feed` (2026-09-29): süzgeç sunucuda uygulanır ve
  // `metadata` istemciye hiç inmez — yalnız kaydın adı ve değişen alanların
  // adları gelir. Sıra ve imleç yine `id`, kurum kimliği yine açıkça gider
  // (yukarıdaki dizin notu fonksiyonun içinde de geçerli).
  const { data, error } = await supabase.rpc("organization_audit_feed", {
    p_organization_id: organizationId,
    p_limit: limit + 1,
    p_before_id: cursor ?? null,
    p_actor_user_id: filters.actorUserId,
    p_action_kind: filters.actionKind,
    p_entity_type: filters.entityType,
    p_from: filters.from,
    p_to: filters.to,
  });

  if (error) {
    throw new Error("Denetim kaydı yüklenemedi.");
  }

  const rawRows = (data ?? []) as AuditRow[];
  const hasMore = rawRows.length > limit;
  const slicedRows = hasMore ? rawRows.slice(0, limit) : rawRows;
  const nextCursor =
    hasMore && slicedRows.length > 0
      ? slicedRows[slicedRows.length - 1].id
      : null;

  const actorIds = slicedRows
    .map(row => row.actor_user_id)
    .filter((value): value is string => Boolean(value));

  const names = await loadMemberNames(actorIds);

  const rows = slicedRows.map(row => ({
    id: row.id,
    actor: resolveAuditActor(row.actor_user_id, names),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
    label: row.label ?? null,
    changed: row.changed ?? [],
  }));

  return {
    rows,
    nextCursor,
  };
}
