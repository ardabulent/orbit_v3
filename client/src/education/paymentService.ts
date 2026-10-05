import { supabase } from "@/lib/supabaseClient";
import type { PaymentRow } from "@/components/education/types";
import { formatTrDate } from "./trDate";
import { readAllPages, PagedReadError } from "@/lib/pagedRead";

/**
 * Ödeme servis katmanı (v1.3-01 · E parçası).
 *
 * `payment_plans` ve `installments` tablolarını gerçek Supabase servisine bağlar.
 *
 * =========================================================================
 * ⛔ Veritabanı fonksiyonları (RPC) kullanılır, istemcide sayım yapılmaz
 * =========================================================================
 *
 * `Student.payment` ve ödeme ekranının durum rozeti "vadesi geçmiş ödenmemiş taksit
 * var mı" sorusunun cevabıdır. `installments` tablosundan satır çekip istemcide
 * saymaya kalkışılırsa sessiz bir satır tavanı (limit) konmak zorunda kalınır.
 *
 * C parçasında aynı tuzak engelleyici bulgu oldu (v1.3-12): tavan aşıldığında
 * vadesi geçmiş taksit görülemez ve sistem borçlu bir öğrenciyi "Güncel"
 * gösterirdi. Veliye "borcunuz yok" demek geri alınması güç bir hatadır (K-03).
 *
 * =========================================================================
 * ⛔ Neden security definer DEĞİL — Ödeme en dar kapsamlı veridir
 * =========================================================================
 *
 * `payment_plans` ve `installments` üzerindeki RLS ödemeyi yalnızca yöneticiye
 * ve veliye açar (v1.2-06 kararı: "ödeme, kurum ile aile arasındadır ve öğretmenin
 * işi değildir"). Öğretmen ve öğrencinin kendisi ödeme verisini göremez.
 *
 * Çağıranın hakları geçerli kalır: öğretmen ve öğrenci boş küme alır.
 * Boş küme kesinlikle "Güncel"e çevrilmez; rozet hiç çizilmez (K-22).
 *
 * =========================================================================
 * Sayılar PostgREST'ten DİZGE gelir
 * =========================================================================
 *
 * PostgREST numeric ve bigint sütunlarını JSON'a string olarak koyar ("1500.00", "1").
 * Değerler `Number(...)` ile çevrilir.
 *
 * =========================================================================
 * Durum kuralı — İki değer, üç değil (Arda Bülent kararı 2026-09-09)
 * =========================================================================
 *
 * overdue_count > 0  → "Takip gerekli"
 * overdue_count = 0  → "Güncel"
 * satır yok          → undefined (rozet çizilmez)
 *
 * Demo'daki "Hatırlatma gerekli" ve "Gecikme riski" üretimde çizilmez.
 */

/**
 * Listenin toplam tavanı (2026-10-05). Eskiden tek sorguda 100'dü; 300
 * öğrencili kurumda liste eksik kalıyordu. Artık sayfa sayfa
 * (`lib/pagedRead.ts`) bu tavana kadar okunur.
 */
export const PAYMENT_TOTAL_CAP = 5000;

export type LoadPaymentsOptions = {
  limit?: number;
  studentId?: string;
  search?: string;
};

export type PaymentListResult = {
  rows: PaymentRow[];
  truncated: boolean;
};

export type RawPaymentPlanRow = {
  id: string;
  name: string;
  student_id: string;
  total_amount?: number | string;
  archived_at?: string | null;
  created_at?: string;
  students?: { full_name: string } | { full_name: string }[] | null;
};

export type PaymentPlanSummary = {
  planId: string;
  overdueCount: number;
  nextDueDate: string | null;
  nextDueAmount: number | null;
  installmentCount?: number;
  paidCount?: number;
  scheduledAmount?: number;
  paidAmount?: number;
};

export type PaymentOverviewCounts = {
  collectedThisMonth: number;
  upcomingCount: number;
  overdueCount: number;
};

/**
 * Tutarı Türk Lirası para birimi formatına çevirir (ör. 7200 -> "₺7.200").
 * Demo ve üretim arayüzlerinde tek formatlayıcı olarak kullanılır (K-06).
 */
export function formatCurrency(amount: number): string {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "";
  }
  const formatted = new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(amount);
  return `₺${formatted}`;
}

/**
 * İlişkili öğrenci kaydından öğrenci adını güvenle çıkarır.
 */
export function extractStudentName(students: unknown): string {
  if (!students) return "";
  if (Array.isArray(students)) {
    return students[0]?.full_name || "";
  }
  if (typeof students === "object" && "full_name" in students) {
    return (students as { full_name: string }).full_name || "";
  }
  return "";
}

/**
 * Veritabanı plan satırını ve özetini arayüz satırına (PaymentRow) eşler.
 *
 * Taksiti hiç olmayan planda next_due_date ve next_due_amount null döner.
 * Boş sütunlara "0" ya da "—" yazılmaz, boş dizge bırakılır (K-22).
 */
export function mapPaymentRow(
  plan: RawPaymentPlanRow,
  summary?: PaymentPlanSummary
): PaymentRow {
  const studentName = extractStudentName(plan.students);

  let due = "";
  if (summary?.nextDueDate) {
    due = formatTrDate(summary.nextDueDate);
  }

  let amount = "";
  if (summary?.nextDueAmount !== null && summary?.nextDueAmount !== undefined) {
    amount = formatCurrency(summary.nextDueAmount);
  }

  let status: PaymentRow["status"] = undefined;
  if (summary) {
    status = summary.overdueCount > 0 ? "Takip gerekli" : "Güncel";
  }

  const row: PaymentRow = {
    id: plan.id,
    studentId: plan.student_id,
    student: studentName,
    plan: plan.name,
    due,
    amount,
    totalAmount: Number(plan.total_amount) || 0,
    status,
  };
  // Özet yoksa (yetki/hata) ilerleme alanları hiç yazılmaz — sıfır uydurulmaz.
  if (summary) {
    row.overdueCount = summary.overdueCount;
    row.nextDueDate = summary.nextDueDate;
    if (summary.installmentCount !== undefined) {
      row.installmentCount = summary.installmentCount;
      row.paidCount = summary.paidCount;
      row.scheduledAmount = summary.scheduledAmount;
      row.paidAmount = summary.paidAmount;
    }
  }
  return row;
}

/**
 * Plan ID'leri için vadesi geçmiş taksit sayısı ve en erken ödenmemiş taksiti tek seferde çeker.
 *
 * ⛔ installments tablosuna doğrudan sorgu atılmaz; sayım ve sıralama
 * `payment_plan_summaries` veritabanı fonksiyonunda yapılır (K-03).
 */
export async function loadPaymentPlanSummaries(
  planIds: string[]
): Promise<Map<string, PaymentPlanSummary>> {
  const uniqueIds = Array.from(
    new Set(planIds.filter(id => Boolean(id) && typeof id === "string"))
  );
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("payment_plan_summaries", {
    target_plan_ids: uniqueIds,
  });

  if (error || !data) {
    // Fail-closed (K-04): Veritabanı hatasında uydurma özet üretilmez
    return new Map();
  }

  const resultMap = new Map<string, PaymentPlanSummary>();

  for (const row of data as {
    plan_id: string;
    overdue_count: number | string;
    next_due_date: string | null;
    next_due_amount: number | string | null;
    installment_count?: number | string | null;
    paid_count?: number | string | null;
    scheduled_amount?: number | string | null;
    paid_amount?: number | string | null;
  }[]) {
    const planId = row.plan_id;
    if (!planId) continue;

    const overdueCount = Number(row.overdue_count);
    let nextDueAmount: number | null = null;
    if (row.next_due_amount !== null && row.next_due_amount !== undefined) {
      const parsedAmount = Number(row.next_due_amount);
      if (!Number.isNaN(parsedAmount)) {
        nextDueAmount = parsedAmount;
      }
    }

    const summary: PaymentPlanSummary = {
      planId,
      overdueCount: Number.isNaN(overdueCount) ? 0 : overdueCount,
      nextDueDate: row.next_due_date || null,
      nextDueAmount,
    };
    // Dört yeni sütun (`20261010000000`): bigint/numeric dizge gelebilir.
    if (row.installment_count !== undefined && row.installment_count !== null) {
      summary.installmentCount = Number(row.installment_count) || 0;
      summary.paidCount = Number(row.paid_count) || 0;
      summary.scheduledAmount = Number(row.scheduled_amount) || 0;
      summary.paidAmount = Number(row.paid_amount) || 0;
    }
    resultMap.set(planId, summary);
  }

  return resultMap;
}

/**
 * Aktif kurumun ödeme planlarını listeler ve özetleriyle birleştirir (v1.3-01 · E parçası).
 *
 * Açık `organization_id` süzgeci şarttır (§4.12, #249).
 * Arşiv filtresi zorunludur: `archived_at is null`.
 */
export async function loadPayments(
  organizationId: string,
  options?: LoadPaymentsOptions
): Promise<PaymentListResult> {
  const limit = options?.limit ?? PAYMENT_TOTAL_CAP;

  const page = (from: number, to: number) => {
    let query = supabase
      .from("payment_plans")
      .select(
        `
      id,
      name,
      student_id,
      total_amount,
      students ( full_name ),
      archived_at,
      created_at
    `
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    if (options?.studentId) {
      query = query.eq("student_id", options.studentId);
    }

    if (options?.search) {
      const trimmed = options.search.trim();
      if (trimmed.length > 0) {
        query = query.ilike("name", `%${trimmed}%`);
      }
    }

    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
  };

  let rawRows: RawPaymentPlanRow[];
  let truncated: boolean;
  try {
    ({ rows: rawRows, truncated } = await readAllPages<RawPaymentPlanRow>(
      page,
      limit
    ));
  } catch (err) {
    if (err instanceof PagedReadError) {
      throw new Error("Ödeme listesi yüklenemedi.", { cause: err });
    }
    throw err;
  }
  const planIds = rawRows.map(row => row.id).filter(Boolean);

  const summaries = await loadPaymentPlanSummaries(planIds);
  const rows = rawRows.map(row => mapPaymentRow(row, summaries.get(row.id)));

  return { rows, truncated };
}

/**
 * Öğrencilerin ödeme durumlarını toplu olarak çeker (v1.3-01e · 3.B & 3.C).
 *
 * `student_payment_summaries` veritabanı fonksiyonu üzerinden tek sorgu atılır (K-06).
 * İstemcide satır sayımı ve tavan filtreleri yapılmaz.
 *
 * Satır dönmesi "görülebilir bir ödeme planı var" demektir:
 * - overdue_count > 0  → "Takip gerekli"
 * - overdue_count = 0  → "Güncel"
 * - Planı olmayan veya yetkisi olmayan öğrenci çıktıda yer almaz (undefined, K-22).
 */
export async function loadStudentPaymentStatuses(
  studentIds: string[]
): Promise<Map<string, "Güncel" | "Takip gerekli">> {
  const uniqueIds = Array.from(
    new Set(studentIds.filter(id => Boolean(id) && typeof id === "string"))
  );
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("student_payment_summaries", {
    target_student_ids: uniqueIds,
  });

  if (error || !data) {
    // Fail-closed (K-04): Veritabanı hatasında durum üretilmez
    return new Map();
  }

  const resultMap = new Map<string, "Güncel" | "Takip gerekli">();

  for (const row of data as {
    student_id: string;
    overdue_count: number | string;
  }[]) {
    const studentId = row.student_id;
    if (!studentId) continue;

    const overdueCount = Number(row.overdue_count);
    if (Number.isNaN(overdueCount)) continue;

    const status = overdueCount > 0 ? "Takip gerekli" : "Güncel";
    resultMap.set(studentId, status);
  }

  return resultMap;
}

/**
 * Ödeme ekranının yönetici istatistik sayılarını çeker (v1.3-01e · 3.E).
 *
 * `payment_overview_counts` veritabanı fonksiyonu kullanılır.
 * Fonksiyon görebildiği taksit olmayan veya yetkisi olmayan çağırana
 * HİÇ SATIR döndürmez (having count(*) > 0).
 *
 * Boş satır kümesinde null döner; sıfırlar uydurulmaz (K-03, K-22).
 */
export async function loadPaymentOverviewCounts(): Promise<PaymentOverviewCounts | null> {
  const { data, error } = await supabase.rpc("payment_overview_counts");

  if (error || !data) {
    return null;
  }

  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0] as {
    collected_this_month?: number | string | null;
    upcoming_count?: number | string | null;
    overdue_count?: number | string | null;
  };

  if (!row) {
    return null;
  }

  const collected = Number(row.collected_this_month ?? 0);
  const upcoming = Number(row.upcoming_count ?? 0);
  const overdue = Number(row.overdue_count ?? 0);

  return {
    collectedThisMonth: Number.isNaN(collected) ? 0 : collected,
    upcomingCount: Number.isNaN(upcoming) ? 0 : upcoming,
    overdueCount: Number.isNaN(overdue) ? 0 : overdue,
  };
}

// =========================================================================
// v1.4-06 Ödeme Planı ve Taksit Yönetimi (Yazma & Detay Yolları)
// =========================================================================

export type Installment = {
  id: string;
  organizationId: string;
  planId: string;
  sequenceNo: number;
  dueDate: string;
  amount: number;
  paidAt?: string | null;
  archivedAt?: string | null;
  createdAt?: string;
};

export type CreatePaymentPlanInput = {
  organizationId: string;
  studentId: string;
  name: string;
  totalAmount: number;
};

export type UpdatePaymentPlanInput = {
  name?: string;
  totalAmount?: number;
};

export type CreateInstallmentInput = {
  organizationId: string;
  planId: string;
  sequenceNo: number;
  dueDate: string;
  amount: number;
};

export type UpdateInstallmentInput = {
  amount?: number;
  dueDate?: string;
};

export const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  "23503": "Öğrenci veya ödeme planı kaydı bulunamadı.",
  "23505":
    "Bu plana ait aynı sıra numarasına sahip aktif bir taksit zaten mevcut.",
  "23514": "Girilen ödeme veya taksit bilgileri kısıtları karşılamıyor.",
  "42501":
    "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor.",
};

/**
 * Veritabanı ve PostgREST hata kodlarını kullanıcı dostu Türkçe mesajlara dönüştürür.
 * Ham hata kodları kullanıcı arayüzüne sızdırılmaz.
 */
export function translatePaymentError(error: unknown): string {
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
    for (const known of ["42501", "23505", "23514", "23503"]) {
      if (error.message.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "23505") {
    if (message.includes("installments") || message.includes("sequence")) {
      return "Bu plana ait aynı sıra numarasına sahip aktif bir taksit zaten mevcut.";
    }
    if (message.includes("payment_plans")) {
      return "Bu ödeme planı zaten mevcut.";
    }
    return PAYMENT_ERROR_MESSAGES["23505"];
  }

  if (code === "23514") {
    if (message.includes("installments_amount_check")) {
      return "Taksit tutarı sıfırdan büyük olmalıdır.";
    }
    if (message.includes("installments_sequence_check")) {
      return "Taksit sıra numarası 1 veya daha büyük olmalıdır.";
    }
    if (message.includes("payment_plans_name_check")) {
      return "Plan adı 1 ile 160 karakter arasında olmalıdır.";
    }
    if (message.includes("payment_plans_total_check")) {
      return "Plan toplam tutarı negatif olamaz.";
    }
    return "Girilen bilgiler kısıtları karşılamıyor (tutar > 0, sıra no >= 1, plan adı 1–160 karakter).";
  }

  if (code && PAYMENT_ERROR_MESSAGES[code]) {
    return PAYMENT_ERROR_MESSAGES[code];
  }

  if (message && !message.includes("PGRST") && !message.includes("PostgREST")) {
    return message;
  }

  return "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.";
}

/**
 * Planı ve ödenmemiş taksitlerinin tamamını TEK işlemde kaydeder
 * (`save_payment_plan`, 2026-09-30 — tek ekran). Yeni planda `planId` boş;
 * var olan planda ödenmiş taksitlere dokunulmaz, ödenmemişler yeni listeyle
 * değiştirilir. Taksit toplamı (ödenmişler dahil) paket tutarına eşit
 * değilse sunucu reddeder ve hiçbir şey yazılmaz.
 */
export async function savePaymentPlan(input: {
  organizationId: string;
  planId: string | null;
  studentId: string | null;
  name: string;
  totalAmount: number;
  installments: { dueDate: string; amount: number }[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_payment_plan", {
    p_organization_id: input.organizationId,
    p_plan_id: input.planId,
    p_student_id: input.studentId,
    p_name: input.name.trim(),
    p_total_amount: Number(input.totalAmount),
    p_installments: input.installments.map(row => ({
      due_date: row.dueDate,
      amount: Number(row.amount),
    })),
  });

  if (error) {
    throw new Error(translatePaymentError(error));
  }

  return data as string;
}

/**
 * Bir ödeme planını arşivler (`archived_at` ile, satır silmez).
 * İki parçalı açık imza (`organizationId, planId`) taşır (§4.12).
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function archivePaymentPlan(
  organizationId: string,
  planId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("payment_plans")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", planId)
    .select("id");

  if (error) {
    throw new Error(translatePaymentError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ödeme planı bulunamadı veya arşivlenemedi.");
  }
}

/**
 * Arşivlenmiş bir ödeme planını geri yükler (`archived_at: null`).
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function restorePaymentPlan(
  organizationId: string,
  planId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("payment_plans")
    .update({ archived_at: null })
    .eq("organization_id", organizationId)
    .eq("id", planId)
    .select("id");

  if (error) {
    throw new Error(translatePaymentError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Ödeme planı bulunamadı veya geri yüklenemedi.");
  }
}

/**
 * Bir plana ait aktif taksitleri yükler.
 * Açık `organization_id` ve `plan_id` süzgeçleri taşır.
 * `archived_at is null` ile arşivlenmiş taksitler hesaba katılmaz.
 */
export async function loadPlanInstallments(
  organizationId: string,
  planId: string
): Promise<Installment[]> {
  const { data, error } = await supabase
    .from("installments")
    .select(
      `
      id,
      organization_id,
      plan_id,
      sequence_no,
      due_date,
      amount,
      paid_at,
      archived_at,
      created_at
    `
    )
    .eq("organization_id", organizationId)
    .eq("plan_id", planId)
    .is("archived_at", null)
    .order("sequence_no", { ascending: true })
    .order("due_date", { ascending: true });

  if (error) {
    throw new Error(translatePaymentError(error));
  }

  return (data ?? []).map(row => ({
    id: row.id,
    organizationId: row.organization_id,
    planId: row.plan_id,
    sequenceNo: Number(row.sequence_no),
    dueDate: row.due_date,
    amount: Number(row.amount),
    paidAt: row.paid_at ?? null,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
  }));
}

/**
 * Birden çok planın aktif taksitleri tek sorguda (veli görünümü,
 * 2026-09-29): plan kimliğine göre, sıra numarasıyla. Kapsam RLS'te — veli
 * yalnız çocuğunun planlarının taksitlerini görür.
 */
export async function loadInstallmentsForPlans(
  organizationId: string,
  planIds: string[]
): Promise<Map<string, Installment[]>> {
  const ids = [...new Set(planIds.filter(Boolean))];
  const result = new Map<string, Installment[]>();
  if (!organizationId || ids.length === 0) return result;

  const { data, error } = await supabase
    .from("installments")
    .select(
      "id, organization_id, plan_id, sequence_no, due_date, amount, paid_at, archived_at, created_at"
    )
    .eq("organization_id", organizationId)
    .in("plan_id", ids)
    .is("archived_at", null)
    .order("sequence_no", { ascending: true })
    .order("due_date", { ascending: true });

  if (error) {
    throw new Error(translatePaymentError(error));
  }

  for (const row of data ?? []) {
    const item: Installment = {
      id: row.id,
      organizationId: row.organization_id,
      planId: row.plan_id,
      sequenceNo: Number(row.sequence_no),
      dueDate: row.due_date,
      amount: Number(row.amount),
      paidAt: row.paid_at ?? null,
      archivedAt: row.archived_at ?? null,
      createdAt: row.created_at,
    };
    const list = result.get(item.planId);
    if (list) list.push(item);
    else result.set(item.planId, [item]);
  }
  return result;
}

/**
 * Bir taksiti ödendi olarak işaretler (`paid_at` zaman damgası koyar).
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function markInstallmentPaid(
  organizationId: string,
  installmentId: string,
  paidAt?: string
): Promise<void> {
  const { data, error } = await supabase
    .from("installments")
    .update({ paid_at: paidAt || new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", installmentId)
    .select("id");

  if (error) {
    throw new Error(translatePaymentError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Taksit bulunamadı veya ödendi olarak işaretlenemedi.");
  }
}

/**
 * Bir taksitin ödeme işaretini geri alır (`paid_at: null`).
 * Sıfır satır etkileyen yazma hata fırlatır (K-14).
 */
export async function unmarkInstallmentPaid(
  organizationId: string,
  installmentId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("installments")
    .update({ paid_at: null })
    .eq("organization_id", organizationId)
    .eq("id", installmentId)
    .select("id");

  if (error) {
    throw new Error(translatePaymentError(error));
  }

  if (!data || data.length === 0) {
    throw new Error("Taksit bulunamadı veya ödeme işareti kaldırılamadı.");
  }
}
