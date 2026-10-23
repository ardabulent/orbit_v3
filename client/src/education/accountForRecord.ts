import type { IssuedCredentials } from "@/components/credentials/IssuedCredentials";
import { createMember } from "@/organization/memberService";
import { linkGuardianAccount } from "./guardianService";
import { linkStudentAccount } from "./studentService";

/**
 * Var olan bir öğrenci ya da veli KAYDINA giriş hesabı açar ve bağlar
 * (2026-10-23, ana plan 1.7).
 *
 * Önceden hesap yalnız "Yeni öğrenci" akışında, kayıtla birlikte açılabiliyordu.
 * Excel'le aktarılan ya da hesapsız eklenen öğrenciye sonradan hesap açmanın
 * yolu yoktu; "Giriş hesabı ata" penceresi "Ayarlar → Üyeler'den açın" diyordu
 * ama oradaki "Üye ekle" yalnız öğretmen açar.
 *
 * İki adım, "Yeni öğrenci" akışındaki hesap adımıyla aynı kurallar:
 *   1. hesap aç (`create-member`) — başarısızsa fırlatır, hiçbir şey olmamıştır
 *   2. kayda bağla — başarısız olsa bile giriş bilgisi DÖNER: geçici şifre
 *      yalnız bir kez üretilir, kaybolmamalı. Hesap boşta kalır ve aynı
 *      penceredeki listeden atanabilir; ekran bunu açıkça söyler (K-14).
 *
 * Yetki kararı sunucudadır (Edge Function + `link_*_account` RPC); bu modül
 * yalnız sırayı yürütür.
 */

export type AccountRecordKind = "student" | "guardian";

export type OpenAccountInput = {
  kind: AccountRecordKind;
  recordId: string;
  fullName: string;
  /** Öğrencinin şubesi; velinin şubesi yoktur — o zaman kurum geneli. */
  branchId: string | null;
};

export type OpenAccountResult = {
  credentials: IssuedCredentials;
  linked: boolean;
  /** `linked` false ise neden ve kullanıcının ne yapacağı. */
  message?: string;
};

export type OpenAccountDeps = {
  createMember: typeof createMember;
  linkStudentAccount: typeof linkStudentAccount;
  linkGuardianAccount: typeof linkGuardianAccount;
};

const defaultDeps: OpenAccountDeps = {
  createMember,
  linkStudentAccount,
  linkGuardianAccount,
};

const MANUAL_HINT =
  'Hesap boşta duruyor; aynı satırdaki "Giriş hesabı ata" listesinden atayabilirsiniz.';

export async function openAccountForRecord(
  input: OpenAccountInput,
  idempotencyKey: string,
  deps: OpenAccountDeps = defaultDeps
): Promise<OpenAccountResult> {
  const credentials = await deps.createMember(
    {
      fullName: input.fullName.trim(),
      role: input.kind === "student" ? "student" : "parent",
      branchId: input.branchId,
    },
    idempotencyKey
  );

  if (!credentials.membershipId) {
    return {
      credentials,
      linked: false,
      message: `Sunucu hesabın kimliğini döndürmedi. ${MANUAL_HINT}`,
    };
  }

  try {
    if (input.kind === "student")
      await deps.linkStudentAccount(input.recordId, credentials.membershipId);
    else
      await deps.linkGuardianAccount(input.recordId, credentials.membershipId);
    return { credentials, linked: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Bilinmeyen hata.";
    return {
      credentials,
      linked: false,
      message: `Hesap açıldı ama bağlanamadı: ${reason} ${MANUAL_HINT}`,
    };
  }
}
