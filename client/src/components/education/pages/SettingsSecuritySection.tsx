import * as React from "react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import { IDLE_TIMEOUT_MS } from "@/auth/idleTimeout";
import {
  accountLinkKeys,
  formatLinkCode,
  issueAccountLinkCode,
  linkAccounts,
  useLinkedAccounts,
} from "@/auth/accountLinkService";
import { roleMeta } from "@/components/education/roleMeta";
import { ChangePasswordCard } from "./ChangePasswordCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const TIMEOUT_OPTIONS = [
  { ms: 15 * 60 * 1000, label: "15 dakika" },
  { ms: 30 * 60 * 1000, label: "30 dakika" },
  { ms: 60 * 60 * 1000, label: "1 saat" },
  { ms: 240 * 60 * 1000, label: "4 saat" },
] as const;

function formatIdleTimeout(ms: number): string {
  const match = TIMEOUT_OPTIONS.find(opt => opt.ms === ms);
  if (match) return match.label;
  const minutes = Math.round(ms / (60 * 1000));
  return `${minutes} dakika`;
}

/**
 * Seçicide gösterilecek etiketler.
 *
 * Geçerli süre listede yoksa başa eklenir: Radix Select, `value`'suna karşılık
 * gelen bir öğe bulamazsa hiçbir şey çizmez. `IDLE_TIMEOUT_MS` bir gün listede
 * olmayan bir değere çekilirse ekran, süreyi yanlış değil **boş** gösterirdi —
 * sessizce bozulan bir güvenlik bilgisi.
 */
function timeoutLabels(activeLabel: string): string[] {
  const labels: string[] = TIMEOUT_OPTIONS.map(option => option.label);
  return labels.includes(activeLabel) ? labels : [activeLabel, ...labels];
}

export function SettingsSecuritySection() {
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const activeTimeoutLabel = formatIdleTimeout(IDLE_TIMEOUT_MS);

  const isAdmin = identity?.membership?.role === "admin";
  const recoveryChannel = identity?.recoveryChannel ?? "unresolved";

  const linkedAccountsQuery = useLinkedAccounts({
    userId: identity?.userId,
  });
  const linkedAccounts = linkedAccountsQuery.data ?? [];

  // Kod üretme state'i (yalnızca React state'i — hiçbir yerde saklanmaz)
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Kod girme state'i
  const [inputCode, setInputCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleIssueCode = async () => {
    if (isDemoMode) {
      toast.info("Demo modunda kod üretilemez.");
      return;
    }
    setIsIssuing(true);
    setLinkSuccess(null);
    setLinkError(null);
    try {
      const code = await issueAccountLinkCode();
      setIssuedCode(code);
      setCopied(false);
      toast.success("Bağlama kodu üretildi.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Bağlama kodu üretilemedi.";
      toast.error(message);
    } finally {
      setIsIssuing(false);
    }
  };

  const handleCopyCode = async () => {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(formatLinkCode(issuedCode));
      setCopied(true);
      toast.success("Bağlama kodu panoya kopyalandı.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Pano kopyalama başarısız oldu.");
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoMode) {
      toast.info("Demo modunda hesap bağlanamaz.");
      return;
    }
    if (!inputCode.trim()) return;

    setIsLinking(true);
    setLinkSuccess(null);
    setLinkError(null);

    try {
      await linkAccounts(inputCode);
      setInputCode("");
      setLinkSuccess("Hesaplarınız bağlandı.");
      toast.success("Hesaplarınız bağlandı.");
      await queryClient.invalidateQueries({ queryKey: accountLinkKeys.all });
    } catch (err) {
      // ⚠️ Servis çevirir ve new Error(çeviri) fırlatır; ekran err.message okur ve ikinci kez çevirmez.
      const message = err instanceof Error ? err.message : "Hesap bağlanamadı.";
      setLinkError(message);
      toast.error(message);
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[18px] font-extrabold text-slate-900">
          Güvenlik Tercihleri
        </h2>
        <button
          type="button"
          disabled
          className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-[11px] font-bold text-white shadow-[0_8px_16px_rgba(15,23,42,.12)] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Değişiklikleri Kaydet
        </button>
      </div>

      {recoveryChannel === "missing" ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-[12px] leading-5 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold text-amber-900">
              Hesabınıza kayıtlı bir kurtarma e-postası bulunmuyor
            </p>
            <p className="mt-1 text-amber-800">
              {isAdmin
                ? "Şifrenizi unutmanız durumunda kendi başınıza sıfırlama yapamazsınız; yeni geçici şifre için platform operatörüne başvurmanız gerekir."
                : "Şifrenizi unutmanız durumunda kendi başınıza sıfırlama yapamazsınız; yeni geçici şifre için kurum yöneticinize başvurmanız gerekir."}
            </p>
          </div>
        </div>
      ) : recoveryChannel === "unresolved" ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-[12px] leading-5 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold text-amber-900">
              Kurtarma bilgisi doğrulanamadı
            </p>
            <p className="mt-1 text-amber-800">
              Güvenlik ve kurtarma bilgileriniz şu anda okunamıyor. Lütfen
              sayfayı yenileyin veya daha sonra tekrar deneyin.
            </p>
          </div>
        </div>
      ) : recoveryChannel === "configured" ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-[12px] leading-5 text-emerald-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold text-emerald-900">
              Kurtarma e-postası tanımlı
            </p>
            <p className="mt-1 text-emerald-800">
              Şifrenizi unuttuğunuzda sıfırlama bağlantısı bu adrese gönderilir
              ({identity?.recoveryEmail}).
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 max-w-xs">
        <Label className="text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
          Oturum zaman aşımı
        </Label>
        <Select value={activeTimeoutLabel} disabled>
          <SelectTrigger disabled className="mt-1.5 h-9 w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeoutLabels(activeTimeoutLabel).map(label => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3">
          <div>
            <p className="text-[12px] font-extrabold text-slate-800">
              İki aşamalı doğrulama
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Girişte ikinci doğrulama adımı iste.
            </p>
          </div>
          <Switch disabled checked={false} />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3">
          <div>
            <p className="text-[12px] font-extrabold text-slate-800">
              Yeni cihaz bildirimleri
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Farklı bir cihazdan giriş yapıldığında bildirim gönder.
            </p>
          </div>
          <Switch disabled checked={false} />
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <span>
          <strong>Bu bölümdeki tercihler henüz işlemiyor.</strong> Oturum zaman
          aşımı herkes için 30 dakikadır ve buradan değiştirilemez; iki aşamalı
          doğrulama ile yeni cihaz bildirimleri de henüz kurulmadı. Yukarıdaki
          kurtarma durumu gerçek bilgidir.
        </span>
      </p>

      {/* Şifremi değiştir (2026-09-29) */}
      <ChangePasswordCard disabled={isDemoMode} />

      {/* Hesaplarım arasında geçiş (v1.4-17; ad 2026-09-30) */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-slate-700" />
          <h3 className="font-display text-[16px] font-extrabold text-slate-900">
            Hesaplarım arasında geçiş
          </h3>
        </div>
        <p className="mt-1 text-[12px] text-slate-500">
          Birden fazla hesabınız varsa (ör. hem öğretmen hem veli hesabınız)
          onları birleştirip üst çubuktaki "Hesap Değiştir" ile şifre girmeden
          geçiş yapabilirsiniz. Veli ile öğrenciyi birbirine bağlamak burada
          değil, Öğrenciler sekmesinde yapılır.
        </p>

        {/* Mevcut Durum */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Bağlı Hesap Durumu
          </p>
          {linkedAccountsQuery.isLoading ? (
            <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Bağlı hesaplar kontrol ediliyor…</span>
            </div>
          ) : linkedAccounts.length < 2 ? (
            <div className="mt-2">
              <p className="text-[13px] font-bold text-slate-800">
                Henüz bağlı hesabınız yok.
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Aşağıdaki adımları takip ederek başka bir hesabınızı buraya
                bağlayabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-[12px] text-slate-600">
                Bu kişi kaydına bağlı <strong>{linkedAccounts.length}</strong>{" "}
                hesap bulunuyor:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {linkedAccounts.map(acc => {
                  const roleLabel = roleMeta[acc.role]?.label || acc.role;
                  return (
                    <div
                      key={acc.userId}
                      className={`flex items-center justify-between rounded-lg border p-2.5 text-[12px] ${
                        acc.isCurrent
                          ? "border-slate-300 bg-white font-semibold text-slate-900 shadow-xs"
                          : "border-slate-200 bg-white/70 text-slate-700"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{roleLabel}</span>
                          {acc.isCurrent && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-700">
                              Bu Hesap
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-slate-500">
                          {acc.organizationName}
                        </p>
                      </div>
                      {acc.isCurrent && (
                        <Check className="h-4 w-4 shrink-0 text-slate-700" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* İki yön, tek ekranda */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Kod üret */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-600" />
              <h4 className="text-[13px] font-bold text-slate-800">
                Bağlama Kodu Üret
              </h4>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Bu hesabı diğer hesabınıza bağlamak için tek kullanımlık bir kod
              alın.
            </p>

            <div className="mt-3">
              <button
                type="button"
                onClick={handleIssueCode}
                disabled={isIssuing || isDemoMode}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[11px] font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isIssuing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <KeyRound className="h-3 w-3" />
                )}
                <span>{issuedCode ? "Yeni Kod Al" : "Kod Üret"}</span>
              </button>
            </div>

            {issuedCode && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[16px] font-extrabold tracking-widest text-slate-900">
                    {formatLinkCode(issuedCode)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-100"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copied ? "Kopyalandı" : "Kopyala"}</span>
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">
                  Bu kod <strong>10 dakika</strong> geçerlidir,{" "}
                  <strong>tek kullanımlıktır</strong> ve{" "}
                  <strong>yeni kod almak eskisini geçersiz kılar</strong>. Sayfa
                  yenilendiğinde ekrandan kaybolur.
                </p>
              </div>
            )}
          </div>

          {/* Kod gir */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-slate-600" />
              <h4 className="text-[13px] font-bold text-slate-800">
                Bağlama Kodu Gir
              </h4>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Diğer hesabınızdan aldığınız bağlama kodunu girerek hesapları
              bağlayın.
            </p>

            <form onSubmit={handleLinkSubmit} className="mt-3 space-y-2.5">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  disabled={isLinking || isDemoMode}
                  className="font-mono uppercase tracking-wider text-[13px]"
                />
                <button
                  type="submit"
                  disabled={!inputCode.trim() || isLinking || isDemoMode}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-[11px] font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isLinking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  <span>Bağla</span>
                </button>
              </div>

              {linkSuccess && (
                <p className="rounded-md bg-emerald-50 p-2 text-[11px] font-semibold text-emerald-800">
                  {linkSuccess}
                </p>
              )}

              {linkError && (
                <p className="rounded-md bg-rose-50 p-2 text-[11px] font-semibold text-rose-800">
                  {linkError}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
