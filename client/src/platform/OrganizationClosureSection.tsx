import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeContent, totalContentRows } from "./organizationContent";
import { platformKeys } from "./platformQueries";
import {
  closeOrganization,
  purgeOrganization,
  reopenOrganization,
  type OrganizationStats,
  type PlatformOrganization,
} from "./platformService";

/**
 * Kurum kapatma ve boşaltma (2026-10-25, ana plan 2.5).
 *
 * Ayrılan kurum iki adımda boşaltılır: önce **kapatılır** (kullanıcılar
 * kilitlenir, veri durur, geri açılabilir), kapanıştan 30 gün sonra
 * **boşaltılır** (içerik kalıcı silinir). Ardından "Kurumu sil" hesapları ve
 * kabı kaldırır. Bütün kurallar sunucuda; bu ekran yalnız durumu ve sırayı
 * gösterir. Kapanış durumu, diyaloğa açılırken verilen kurum satırından değil
 * sayaçtan okunur: satır diyalog açıkken eskir.
 */
type Step = "idle" | "close-confirm" | "purge-confirm";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function OrganizationClosureSection({
  organization,
  stats,
  statsLoading,
  onChanged,
}: {
  organization: PlatformOrganization;
  stats: OrganizationStats | null;
  statsLoading: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: platformKeys.organizationStats(organization.id),
      }),
      queryClient.invalidateQueries({ queryKey: platformKeys.auditEvents() }),
    ]);
    onChanged();
  };

  const run = async (action: () => Promise<string>, failTitle: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      toast.success(await action());
      setStep("idle");
      setConfirmCode("");
      await refresh();
    } catch (error) {
      toast.error(failTitle, {
        description:
          error instanceof Error ? error.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (statsLoading) {
    return <p className="mt-2 text-[11px] text-muted-foreground">Durum…</p>;
  }

  if (!stats) {
    // Durum bilinmeden kapatma/boşaltma düğmesi çizilmez (K-04).
    return (
      <p className="mt-2 text-[11px] font-bold text-rose-700 dark:text-rose-300">
        Kurumun durumu okunamadı; kapatma ve boşaltma şu an gösterilmiyor.
      </p>
    );
  }

  const content = describeContent(stats.content);
  const total = totalContentRows(content);
  const closedAt = stats.closedAt;
  const purgeAt = stats.purgeAvailableAt;
  const purgeReady = Boolean(purgeAt && new Date(purgeAt) <= new Date());
  const codeMatches =
    organization.code !== null &&
    confirmCode.trim() === String(organization.code);

  if (!closedAt) {
    if (step !== "close-confirm") {
      return (
        <button
          type="button"
          onClick={() => setStep("close-confirm")}
          className="mt-2 w-full rounded-xl border border-amber-300 px-4 py-2.5 text-left text-[12px] text-amber-800 transition hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10"
        >
          <span className="font-bold">Kurumu kapat</span>
          <span className="mt-0.5 block text-[11px] opacity-80">
            Ayrılan kurum için ilk adım. Kullanıcılar giremez, veri durur; geri
            açılabilir.
          </span>
        </button>
      );
    }

    return (
      <div className="mt-2 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[12px] leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-bold">{organization.name} kapatılacak</p>
        <ul className="list-inside list-disc space-y-0.5">
          <li>Kurumun hiçbir kullanıcısı giriş yapıp veri göremez.</li>
          <li>Veri silinmez; kurum yeniden açılabilir.</li>
          <li>
            Kapanıştan <strong>30 gün</strong> sonra kurum boşaltılabilir.
          </li>
        </ul>
        <p>
          Kapattıktan sonra kurum yöneticisi verisini indiremez. Önce
          <strong> Ayarlar → Veri Yönetimi</strong>'nden dışa aktarmasını
          isteyin.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setStep("idle")}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-[12px] font-bold transition hover:bg-amber-100 disabled:opacity-50 dark:hover:bg-amber-500/20"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                await closeOrganization(organization.id);
                return "Kurum kapatıldı";
              }, "Kurum kapatılamadı")
            }
            disabled={submitting}
            className="rounded-xl bg-amber-600 px-4 py-2 text-[12px] font-extrabold text-white transition hover:bg-amber-500 disabled:opacity-40"
          >
            {submitting ? "Kapatılıyor…" : "Kurumu kapat"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[12px] leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-bold">Kurum kapalı · {formatDate(closedAt)}</p>
        <p>
          {total > 0
            ? `${total} içerik kaydı duruyor. `
            : "Kurumda içerik kaydı kalmadı; kurum silinebilir. "}
          {total > 0 && purgeAt
            ? purgeReady
              ? "Bekleme süresi doldu, boşaltılabilir."
              : `${formatDate(purgeAt)} tarihinden sonra boşaltılabilir.`
            : null}
        </p>
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              await reopenOrganization(organization.id);
              return "Kurum yeniden açıldı";
            }, "Kurum yeniden açılamadı")
          }
          disabled={submitting}
          className="mt-2 rounded-lg border border-amber-400 px-3 py-1.5 text-[11px] font-bold transition hover:bg-amber-100 disabled:opacity-50 dark:hover:bg-amber-500/20"
        >
          Yeniden aç
        </button>
      </div>

      {total > 0 && step !== "purge-confirm" ? (
        <button
          type="button"
          onClick={() => setStep("purge-confirm")}
          disabled={!purgeReady}
          title={
            purgeReady ? undefined : "Kapanıştan 30 gün geçmeden boşaltılamaz"
          }
          className="w-full rounded-xl border border-rose-300 px-4 py-2.5 text-left text-[12px] text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
        >
          <span className="font-bold">Kurumu boşalt</span>
          <span className="mt-0.5 block text-[11px] opacity-80">
            Öğrenci, not, yoklama, ödeme ve diğer bütün kayıtlar kalıcı olarak
            silinir.
          </span>
        </button>
      ) : null}

      {step === "purge-confirm" ? (
        <div className="space-y-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-[12px] leading-5 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          <p className="font-bold">
            {organization.name} boşaltılacak — geri alınamaz
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {content.map(line => (
              <li key={line.table}>
                <strong>{line.rows}</strong> {line.label}
              </li>
            ))}
            <li>
              <strong>{stats.auditEventCount}</strong> kurum denetim kaydı
            </li>
          </ul>
          <p>
            Hesaplar, üyelikler ve şubeler kalır; onları ardından "Kurumu sil"
            kaldırır. Boşaltma, tablo başına sayılarla platform denetim kaydına
            yazılır.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="purge-confirm-code">
              Onaylamak için kurum kodunu yazın
            </Label>
            <Input
              id="purge-confirm-code"
              inputMode="numeric"
              value={confirmCode}
              onChange={event => setConfirmCode(event.target.value)}
              placeholder={organization.code ? String(organization.code) : ""}
              autoComplete="off"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setConfirmCode("");
              }}
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-[12px] font-bold transition hover:bg-rose-100 disabled:opacity-50 dark:hover:bg-rose-500/20"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  const result = await purgeOrganization(
                    organization.id,
                    Number(confirmCode.trim())
                  );
                  return `Kurum boşaltıldı: ${result.deletedTotal} içerik kaydı silindi`;
                }, "Kurum boşaltılamadı")
              }
              disabled={!codeMatches || submitting}
              title={codeMatches ? undefined : "Kurum kodunu birebir yazın"}
              className="rounded-xl bg-rose-600 px-4 py-2 text-[12px] font-extrabold text-white transition hover:bg-rose-500 disabled:opacity-40"
            >
              {submitting ? "Boşaltılıyor…" : "Kalıcı olarak boşalt"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
