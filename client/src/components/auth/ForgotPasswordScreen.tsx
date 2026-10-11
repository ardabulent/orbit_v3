import { useState } from "react";
import { isDemoMode } from "@/auth/runtime";
import type { FormEvent } from "react";
import { Link } from "wouter";
import { ChevronRight, MailCheck } from "lucide-react";
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
  onRequest: (email: string) => Promise<void>;
  demoMode: boolean;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onRequest(email);
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
        description="Girdiğiniz adrese ait kayıtlı ve doğrulanmış bir kurtarma e-postası bulunuyorsa şifre belirleme bağlantısı iletilecektir."
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
              Şifre sıfırlama bağlantısı yalnızca sistemde kayıtlı ve
              doğrulanmış kurtarma adresi bulunan hesaplara gönderilir. Giriş
              numarasıyla oturum açan üyeler yeni geçici şifre için kurum
              yöneticisine başvurmalıdır.
            </p>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Şifrenizi mi unuttunuz?"
      description="Kurum hesabınızın e-posta adresini girin. Şifrenizi belirleyebilmeniz için bir bağlantı gönderelim. Hesabınıza kayıtlı bir e-posta adresi yoksa şifrenizi buradan sıfırlayamazsınız; kurum yöneticinize başvurun."
      footer={
        <Link href="/" className="font-bold text-blue-600">
          Giriş ekranına dön
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <AuthField label="E-posta adresi">
          <input
            value={email}
            onChange={event => setEmail(event.target.value)}
            type="email"
            required
            autoComplete="email"
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
