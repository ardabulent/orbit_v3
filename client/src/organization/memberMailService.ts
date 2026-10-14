import { supabase } from "@/lib/supabaseClient";
import { userFacingErrorText } from "@/lib/userFacingError";

/**
 * Üyelerin e-posta durumu (2026-10-14, göç 20261103000000).
 *
 * Kurum yöneticisi Ayarlar → Üyeler'de her üyenin kurtarma adresi olup
 * olmadığını ve son e-postanın (kurtarma kodu / şifre sıfırlama) sonucunu
 * görür. Adresin kendisi dönmez. Yetki SQL'de: tam yetkili yönetici kurumu,
 * şube yöneticisi şubesini görür; diğer roller boş liste alır.
 */

export type MailKind = "recovery_code" | "password_reset";
export type MailStatus = "queued" | "sent" | "failed";

export type MemberMailStatus = {
  hasRecoveryEmail: boolean;
  lastKind: MailKind | null;
  lastStatus: MailStatus | null;
  lastReason: string | null;
  lastAt: string | null;
};

type Row = {
  membership_id: string;
  has_recovery_email: boolean;
  last_kind: MailKind | null;
  last_status: MailStatus | null;
  last_reason: string | null;
  last_at: string | null;
};

export async function loadMemberMailStatus(): Promise<
  Map<string, MemberMailStatus>
> {
  const { data, error } = await supabase.rpc("member_email_status");
  if (error) {
    throw new Error(
      userFacingErrorText(error) ?? "Üyelerin e-posta durumu alınamadı."
    );
  }
  return new Map(
    ((data ?? []) as Row[]).map(row => [
      row.membership_id,
      {
        hasRecoveryEmail: row.has_recovery_email,
        lastKind: row.last_kind,
        lastStatus: row.last_status,
        lastReason: row.last_reason,
        lastAt: row.last_at,
      },
    ])
  );
}

const KIND_LABEL: Record<MailKind, string> = {
  recovery_code: "Doğrulama kodu",
  password_reset: "Şifre sıfırlama",
};

/** Başarısızlık sebebinin yöneticiye söylenecek hâli. */
export function mailFailureText(reason: string | null): string {
  if (!reason) return "gönderilemedi";
  if (reason === "link_failed") return "bağlantı üretilemedi";
  if (/^smtp_53\d/.test(reason)) return "e-posta hesabı şifresi reddedildi";
  if (reason.startsWith("smtp_timeout"))
    return "e-posta sunucusuna ulaşılamadı";
  return "gönderilemedi";
}

/** Tablodaki tek satırlık özet: "Şifre sıfırlama · 14 Eki 09:51 · gönderildi". */
export function describeLastMail(status: MemberMailStatus): {
  text: string;
  tone: "ok" | "bad" | "muted";
} | null {
  if (!status.lastKind || !status.lastStatus || !status.lastAt) return null;
  const when = new Date(status.lastAt).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const head = `${KIND_LABEL[status.lastKind]} · ${when}`;
  if (status.lastStatus === "sent") {
    return { text: `${head} · gönderildi`, tone: "ok" };
  }
  if (status.lastStatus === "failed") {
    return {
      text: `${head} · ${mailFailureText(status.lastReason)}`,
      tone: "bad",
    };
  }
  return { text: `${head} · gönderiliyor`, tone: "muted" };
}
