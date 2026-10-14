import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  confirmRecoveryCode,
  removeRecoveryEmail,
  sendRecoveryCode,
} from "@/auth/recoveryService";
import { settingsKeys } from "@/settings/settingsQueries";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step =
  { kind: "view" } | { kind: "email" } | { kind: "code"; email: string };

const primaryButton =
  "inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-[11px] font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Kurtarma e-postası (2026-10-13, #118). Adres ancak o adrese giden 6 haneli
 * kod geri girilince kaydedilir; şifresini unutan kişi giriş ekranında
 * numarasını yazınca sıfırlama bağlantısı buraya gelir.
 */
export function RecoveryEmailCard({
  current,
  disabled,
}: {
  current: string | null;
  disabled: boolean;
}) {
  const { identity, refreshIdentity } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ kind: "view" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    if (identity?.userId) {
      await queryClient.invalidateQueries({
        queryKey: settingsKeys.profileContact(identity.userId),
      });
    }
    await refreshIdentity();
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "İşlem tamamlanamadı."
      );
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      const address = email.trim();
      await sendRecoveryCode(address);
      setCode("");
      setStep({ kind: "code", email: address });
    });

  const confirm = (target: string) =>
    run(async () => {
      const saved = await confirmRecoveryCode(code);
      if (!saved) {
        setMessage("Kod hatalı. E-postadaki 6 haneli kodu kontrol edin.");
        return;
      }
      await refresh();
      setStep({ kind: "view" });
      setEmail("");
      toast.success("Kurtarma e-postası kaydedildi", {
        description: `Şifrenizi unutursanız bağlantı ${target} adresine gelecek.`,
      });
    });

  const remove = () =>
    run(async () => {
      await removeRecoveryEmail();
      await refresh();
      toast.success("Kurtarma e-postası kaldırıldı");
    });

  return (
    <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <Label className="text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
        Kurtarma e-postası
      </Label>

      {step.kind === "view" ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {current ? (
            <p className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
              <MailCheck className="h-4 w-4 text-emerald-600" aria-hidden />
              {current}
              <span className="text-[11px] font-semibold text-emerald-700">
                doğrulandı
              </span>
            </p>
          ) : (
            <p className="text-[12px] leading-5 text-slate-500">
              Şifrenizi unutursanız sıfırlama bağlantısı bu adrese gönderilir.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => {
                setMessage(null);
                setEmail(current ?? "");
                setStep({ kind: "email" });
              }}
              className={current ? secondaryButton : primaryButton}
            >
              {current ? "Değiştir" : "E-posta ekle"}
            </button>
            {current ? (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => void remove()}
                className={secondaryButton}
              >
                Kaldır
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {step.kind === "email" ? (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={event => {
            event.preventDefault();
            void send();
          }}
        >
          <Input
            type="email"
            value={email}
            autoComplete="email"
            placeholder="ornek@gmail.com"
            onChange={event => setEmail(event.target.value)}
            className="h-9 min-w-[220px] flex-1 text-[13px]"
            aria-label="Kurtarma e-postası"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className={primaryButton}
          >
            {busy ? "Gönderiliyor" : "Doğrulama kodu gönder"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep({ kind: "view" })}
            className={secondaryButton}
          >
            Vazgeç
          </button>
        </form>
      ) : null}

      {step.kind === "code" ? (
        <form
          className="mt-2"
          onSubmit={event => {
            event.preventDefault();
            void confirm(step.email);
          }}
        >
          <p className="text-[12px] leading-5 text-slate-600">
            <span className="font-bold">{step.email}</span> adresine 6 haneli
            bir kod gönderdik. Gelen kutusunda yoksa Spam klasörüne bakın. Kod
            15 dakika geçerlidir.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Input
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
              className="h-9 w-[120px] text-center text-[15px] font-bold tracking-[.3em]"
              aria-label="Doğrulama kodu"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className={primaryButton}
            >
              {busy ? "Doğrulanıyor" : "Doğrula ve kaydet"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void send()}
              className={secondaryButton}
            >
              Kodu yeniden gönder
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep({ kind: "view" })}
              className={secondaryButton}
            >
              Vazgeç
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className="mt-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}
