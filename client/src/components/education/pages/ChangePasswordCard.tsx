import { useState } from "react";
import { Check, KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { changeOwnPassword } from "@/auth/passwordChange";
import { evaluatePassword } from "@/auth/passwordPolicy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Ayarlar → Güvenlik → "Şifremi değiştir" (karar 2026-09-29). Mevcut şifre
 * + yeni şifre iki kez. Kurallar ilk girişteki ekranla aynı kaynaktan
 * (`passwordPolicy`). Başarıda alanlar temizlenir; şifre hiçbir yerde
 * tutulmaz.
 */
export function ChangePasswordCard({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirmation("");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await changeOwnPassword({
        currentPassword: current,
        newPassword: next,
        confirmation,
      });
      reset();
      setOpen(false);
      toast.success("Şifreniz değiştirildi", {
        description: "Bir sonraki girişte yeni şifrenizi kullanın.",
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Şifre değiştirilemedi."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-slate-700" />
          <div>
            <p className="text-[13px] font-extrabold text-slate-900">Şifre</p>
            <p className="text-[11px] text-slate-500">
              Şifrenizin başkasında olduğunu düşünüyorsanız hemen değiştirin.
            </p>
          </div>
        </div>
        {!open ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className="text-[12px] font-bold">Şifremi değiştir</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-4 grid max-w-md gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="mevcut-sifre">Mevcut şifre</Label>
            <Input
              id="mevcut-sifre"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="yeni-sifre">Yeni şifre</Label>
            <Input
              id="yeni-sifre"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={e => setNext(e.target.value)}
              required
            />
          </div>
          <ul className="grid gap-1 text-[11px]">
            {evaluatePassword(next).map(rule => (
              <li
                key={rule.id}
                className={`flex items-center gap-1.5 ${rule.satisfied ? "text-emerald-700" : "text-slate-500"}`}
              >
                {rule.satisfied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {rule.label}
              </li>
            ))}
          </ul>
          <div className="grid gap-1.5">
            <Label htmlFor="yeni-sifre-tekrar">Yeni şifre (tekrar)</Label>
            <Input
              id="yeni-sifre-tekrar"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-[12px] font-bold text-rose-600">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span className="text-[12px] font-bold">Şifreyi değiştir</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="h-9 rounded-lg border border-slate-200 px-4 text-slate-700 hover:bg-slate-50"
            >
              <span className="text-[12px] font-bold">Vazgeç</span>
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
