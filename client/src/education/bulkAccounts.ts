import type { IssuedCredentials } from "@/components/credentials/IssuedCredentials";
import { supabase } from "@/lib/supabaseClient";
import {
  memberErrorMessage,
  readFunctionErrorCode,
} from "@/organization/memberService";

/**
 * Toplu giriş hesabı açma (2026-10-23, ana plan 1.8) — `create-members-bulk`.
 *
 * Öğrenciler 10'arlı partilerle, SIRAYLA gönderilir: sunucu bir çağrıda en çok
 * 10 öğrenci kabul eder ve sıralı gitmek, kardeşlerin ortak velisinin ikinci
 * partide "zaten hesabı var" olarak görülmesini sağlar (ikinci hesap açılmaz).
 * Bir parti başarısız olursa durulur: o ana kadar açılan hesapların giriş
 * bilgisi kaybolmamalı, sonuç ekranı ne açıldığını ve neyin kaldığını söyler.
 *
 * Yetki sunucuda: fonksiyon kayıtları çağıranın RLS'iyle okur, yalnız hesabı
 * olmayan kayda hesap açar.
 */
export const BULK_BATCH_SIZE = 10;

export type BulkAccountItem = {
  kind: "student" | "guardian";
  recordId: string;
  fullName: string;
  forStudent?: string;
  status:
    "created" | "already_has_account" | "not_found" | "failed" | "skipped";
  linked?: boolean;
  credentials?: IssuedCredentials;
  error?: string;
};

export type BulkAccountsResult = {
  items: BulkAccountItem[];
  /** Durulan partideki hata; null ise bütün partiler işlendi. */
  stoppedWith: string | null;
  processedStudents: number;
};

export type InvokeBulk = (
  studentIds: string[],
  includeGuardians: boolean,
  idempotencyKey: string
) => Promise<BulkAccountItem[]>;

type RawItem = {
  kind?: unknown;
  recordId?: unknown;
  fullName?: unknown;
  forStudent?: unknown;
  status?: unknown;
  linked?: unknown;
  login_number?: unknown;
  temporary_password?: unknown;
  error?: unknown;
};

const STATUSES = new Set([
  "created",
  "already_has_account",
  "not_found",
  "failed",
  "skipped",
]);

export function mapBulkItem(raw: RawItem): BulkAccountItem | null {
  if (
    (raw.kind !== "student" && raw.kind !== "guardian") ||
    typeof raw.recordId !== "string" ||
    typeof raw.status !== "string" ||
    !STATUSES.has(raw.status)
  )
    return null;
  const item: BulkAccountItem = {
    kind: raw.kind,
    recordId: raw.recordId,
    fullName: typeof raw.fullName === "string" ? raw.fullName : "",
    status: raw.status as BulkAccountItem["status"],
  };
  if (typeof raw.forStudent === "string") item.forStudent = raw.forStudent;
  if (typeof raw.error === "string") item.error = raw.error;
  if (item.status === "created") {
    item.linked = raw.linked === true;
    if (
      typeof raw.login_number === "string" &&
      typeof raw.temporary_password === "string"
    )
      item.credentials = {
        loginNumber: raw.login_number,
        temporaryPassword: raw.temporary_password,
        passwordLockSet: true,
      };
  }
  return item;
}

const invokeBulk: InvokeBulk = async (studentIds, includeGuardians, key) => {
  const { data, error } = await supabase.functions.invoke(
    "create-members-bulk",
    {
      body: { studentIds, includeGuardians },
      headers: { "Idempotency-Key": key },
    }
  );
  if (error)
    throw new Error(
      memberErrorMessage(
        await readFunctionErrorCode(error),
        "Hesaplar açılamadı. Tekrar deneyin."
      )
    );
  const payload = (data as { data?: { items?: unknown; replayed?: unknown } })
    ?.data;
  if (payload?.replayed === true)
    // Aynı parti daha önce işlenmiş: şifreler yeniden gösterilemez.
    throw new Error(
      "Bu parti zaten işlenmişti; açılan hesapların şifresi yeniden gösterilemez. Gerekirse öğrenci satırından şifreyi sıfırlayın."
    );
  return (Array.isArray(payload?.items) ? payload.items : [])
    .map(item => mapBulkItem(item as RawItem))
    .filter((item): item is BulkAccountItem => item !== null);
};

export async function openAccountsInBulk(
  studentIds: string[],
  includeGuardians: boolean,
  onProgress: (processedStudents: number) => void,
  deps: { invoke: InvokeBulk; newKey: () => string } = {
    invoke: invokeBulk,
    newKey: () => crypto.randomUUID(),
  }
): Promise<BulkAccountsResult> {
  const items: BulkAccountItem[] = [];
  let processedStudents = 0;
  for (let start = 0; start < studentIds.length; start += BULK_BATCH_SIZE) {
    const batch = studentIds.slice(start, start + BULK_BATCH_SIZE);
    try {
      items.push(
        ...(await deps.invoke(batch, includeGuardians, deps.newKey()))
      );
    } catch (err) {
      return {
        items,
        processedStudents,
        stoppedWith: err instanceof Error ? err.message : "Bilinmeyen hata.",
      };
    }
    processedStudents += batch.length;
    onProgress(processedStudents);
  }
  return { items, processedStudents, stoppedWith: null };
}
