import { useState } from "react";
import { isDemoMode } from "@/auth/runtime";
import type { FormEvent } from "react";
import { Link } from "wouter";
import { ChevronRight, MailCheck } from "lucide-react";
import { isRecoveryIdentifier } from "@/auth/recoveryService";
import {
  AuthField,
  AuthShell,
  authButtonClassName,
  authInputClassName,
} from "./AuthShell";

export function ForgotPasswordScreen({
  onRequest,
  demoMode,
}: {
  onRequest: (identifier: string) => Promise<void>;
  demoMode: boolean;
}) {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isRecoveryIdentifier(identifier)) {
      setError("Giriş numaranızı (8 hane) ya da e-posta adresinizi yazın.");
      return;
    }

    setLoading(true);

    try {
      await onRequest(identifier);
      setSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Şifre sıfırlama e-postası gönderilemedi."
      );
    } finally {
      setLoading(false);
    }
  };

  // `isDemoMode` derleme sabiti: üretimde dal elenir, demo şifresi pakete
  // girmez (B12, 2026-10-11).
  if (isDemoMode && demoMode) {
    return (
      <AuthShell
        title="Şifre sıfırlama"
        description="Bu ekran yalnızca canlı ortamda çalışır. Demo modunda tüm hesaplar demo123 şifresini kullanır."
        footer={
          <Link href="/" className="font-bold text-blue-600">
            Giriş ekranına dön
          </Link>
        }
      >
        <p className="rounded-xl bg-slate-50 p-4 text-[12px] leading-5 text-slate-600">
          Yerel geliştirme ve önizleme derlemeleri demo modundadır; kimlik
          doğrulama sunucusuna bağlanmaz.
        </p>
      </AuthShell>
    );
  }

  if (sent) {
    return (
      <AuthShell
        title="Sıfırlama isteği alındı"
        description="Hesabınızda doğrulanmış bir kurtarma e-postası varsa şifre belirleme bağlantısı birkaç dakika içinde o adrese gelecek."
        footer={
          <Link href="/" className="font-bold text-blue-600">
            Giriş ekranına dön
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/75 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div className="text-[12px] leading-5 text-blue-950">
            <p className="font-bold text-blue-900">İstek işleme alındı</p>
            <p className="mt-1 text-blue-800">
              Gelen kutunuzda yoksa Spam klasörüne de bakın. Bağlantı bir saat
              geçerlidir. Kurtarma e-postası eklemediyseniz e-posta gelmez; yeni
              geçici şifre için kurum yöneticinize başvurun.
            </p>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Şifrenizi mi unuttunuz?"
      description="Giriş numaranızı ya da e-posta adresinizi yazın. Şifrenizi belirlemeniz için kurtarma e-postanıza bir bağlantı gönderelim. Ayarlar'dan kurtarma e-postası eklemediyseniz yeni geçici şifre için kurum yöneticinize başvurun."
      footer={
        <Link href="/" className="font-bold text-blue-600">
          Giriş ekranına dön
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <AuthField label="Giriş numarası veya e-posta">
          <input
            value={identifier}
            onChange={event => setIdentifier(event.target.value)}
            type="text"
            required
            autoComplete="username"
            className={authInputClassName}
          />
        </AuthField>

        {error ? (
          <p className="rounded-xl bg-rose-50 p-3 text-[12px] leading-5 text-rose-700">
            {error}
          </p>
        ) : null}

        <button disabled={loading} className={authButtonClassName}>
          {loading ? "Gönderiliyor" : "Sıfırlama bağlantısı gönder"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </form>
    </AuthShell>
  );
}
