import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CredentialsPanel } from "@/components/credentials/CredentialsPanel";
import { OrganizationClosureSection } from "./OrganizationClosureSection";
import { describeContent, totalContentRows } from "./organizationContent";
import { useOrganizationStats } from "./platformQueries";
import {
  deleteOrganization,
  resetAdminPassword,
  type OrganizationCredentials,
  type PlatformOrganization,
} from "./platformService";

/**
 * Kurum profili.
 *
 * Ekran üç şeyi bilinçli olarak AYIRIYOR:
 *
 *   1. **Kurum** — kap: kod, kısa ad, kuruluş, yapısal sayılar
 *   2. **Kurum yöneticisi** — kurumun içindeki bir kişi ve ona ait işlem
 *   3. **Tehlikeli işlemler** — kurumu yok eden işlem, görsel olarak uzakta
 *
 * Önceki hâlde ilk ikisi iç içeydi: satır "kurum" diyordu ama tek işlem
 * yöneticinin şifresiydi. Bu, kurumu ve içindeki kişiyi tek şeymiş gibi
 * gösteriyordu. Tehlikesi somut: yöneticisi ayrılan bir kurumda kişiyi
 * kaldırmak isteyen biri, gördüğü tek silme düğmesine basıp kurumun tamamını
 * yok edebilirdi.
 *
 * Bugün kurumlar boş olduğu için o düğme zararsız hissettiriyor ve alışkanlık
 * öyle oturuyor. v1.2'de öğrenci, not ve ödeme geldiğinde aynı düğme aynı
 * yerde duruyor olacak.
 */
type View = "overview" | "reset-confirm" | "credentials" | "delete-confirm";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function OrganizationProfileDialog({
  organization,
  onClose,
  onChanged,
}: {
  organization: PlatformOrganization | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [view, setView] = useState<View>("overview");
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] =
    useState<OrganizationCredentials | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const { data: stats = null, isLoading: statsLoading } = useOrganizationStats(
    organization?.id
  );

  // Farklı bir kuruma geçildiğinde diyalog içindeki kullanıcı durumları
  // sıfırlanır; kalsaydı operatör bir kurumun ekranında önceki kurumun
  // geçici şifresini görebilirdi. İstatistikler ise React Query'nin kurum
  // kimliği içeren anahtarı (`platformKeys.organizationStats`) tarafından
  // korunur (K-19).
  const [prevOrgId, setPrevOrgId] = useState<string | null>(
    organization?.id ?? null
  );

  if (organization && organization.id !== prevOrgId) {
    setPrevOrgId(organization.id);
    setView("overview");
    setCredentials(null);
    setConfirmName("");
  }

  if (!organization) {
    return null;
  }

  const close = () => {
    if (submitting) return;
    setView("overview");
    setCredentials(null);
    setConfirmName("");
    onClose();
  };

  const handleReset = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      setCredentials(await resetAdminPassword(organization.id));
      setView("credentials");
    } catch (error) {
      toast.error("Şifre üretilemedi", {
        description:
          error instanceof Error ? error.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const result = await deleteOrganization(organization.id, confirmName);

      toast.success("Kurum silindi", {
        description: `${result.organizationName} ve bağlı ${result.deletedMemberships} üyelik, ${result.deletedBranches} şube kaydı kaldırıldı.`,
      });

      if (result.protectedIdentities > 0) {
        // Sessiz kalmamalı: operatör "tüm kullanıcılar silindi" sanıp korunmuş
        // bir hesabın varlığından habersiz kalmasın.
        toast.info("Bazı hesaplar korundu", {
          description: `${result.protectedIdentities} üyenin hesabı silinmedi çünkü platform operatörlüğü veya başka bir kurumda üyeliği var. Bu kurumla ilişkileri kaldırıldı.`,
        });
      }

      if (result.orphanedUsers > 0) {
        toast.warning("Bazı hesaplar silinemedi", {
          description: `${result.orphanedUsers} kullanıcı hesabı kaldırılamadı. Geliştirme ekibine bildirin.`,
        });
      }

      onChanged();
      onClose();
    } catch (error) {
      toast.error("Kurum silinemedi", {
        description:
          error instanceof Error ? error.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const nameMatches = confirmName.trim() === organization.name.trim();
  // İçerik varken silme sunucuda reddedilir (ORB01); düğme baştan kapalı ve
  // yol gösteriliyor (ana plan 2.5).
  const contentLines = describeContent(stats?.content);
  const contentTotal = totalContentRows(contentLines);
  const adminLoginNumber = organization.code ? `${organization.code}1000` : "—";

  if (view === "credentials" && credentials) {
    return (
      <Dialog open onOpenChange={next => (next ? undefined : close())}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Yeni şifre üretildi</DialogTitle>
            <DialogDescription>Bu ekran bir kez gösterilir.</DialogDescription>
          </DialogHeader>

          <CredentialsPanel
            subjectLabel="Kurum"
            subjectName={organization.name}
            organizationCode={credentials.organizationCode}
            credentials={credentials}
            onDone={() => {
              setCredentials(null);
              setView("overview");
              setConfirmName("");
              onClose();
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (view === "reset-confirm") {
    return (
      <Dialog open onOpenChange={next => (next ? undefined : close())}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Yeni geçici şifre üret</DialogTitle>
            <DialogDescription>
              {organization.name} kurumunun yöneticisi için yeni bir geçici
              şifre üretilecek.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-[12px] leading-5 text-muted-foreground">
            <p>
              Yöneticinin mevcut şifresi <strong>geçersiz olacak</strong>.
              Halihazırda giriş yapabiliyorsa bu işlemi yapmayın.
            </p>
            <p>
              Kurumun verisine dokunulmaz; yalnızca bu kişinin giriş bilgisi
              yenilenir.
            </p>
            <p>
              İşlem denetim kaydına yazılır ve kimin yaptığı görünür. Şifrenin
              kendisi hiçbir yere kaydedilmez.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setView("overview")}
              disabled={submitting}
              className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            >
              Geri
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-300"
            >
              {submitting ? "Üretiliyor…" : "Yeni şifre üret"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (view === "delete-confirm") {
    return (
      <Dialog open onOpenChange={next => (next ? undefined : close())}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Kurumu sil</DialogTitle>
            <DialogDescription>
              Bu işlem <strong>geri alınamaz</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-[12px] leading-5">
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              <p className="font-bold">
                {organization.name} kurumundan silinecekler
              </p>

              {/*
                Somut sayı gösteriliyor. "Tüm kullanıcılar" gibi soyut bir ifade
                operatörü, ne kadar şey yok ettiğini bilmeden onaylamaya zorlar.
                Sayı okunamazsa sıfır DEĞİL uyarı gösteriliyor: "silinecek hesap
                yok" diye okunup dolu bir kurum silinmesin.
              */}
              {statsLoading ? (
                <p className="mt-1.5">Sayılar getiriliyor…</p>
              ) : stats ? (
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  <li>
                    <strong>{stats.memberCount}</strong> kullanıcı hesabı ve
                    üyeliği
                  </li>
                  <li>
                    <strong>{stats.branchCount}</strong> şube kaydı
                  </li>
                  <li>
                    <strong>{stats.auditEventCount}</strong> kurum denetim kaydı
                  </li>
                </ul>
              ) : (
                <p className="mt-1.5 font-bold">
                  Sayılar okunamadı. Kaç kaydın silineceği bilinmiyor — emin
                  değilseniz vazgeçin.
                </p>
              )}
            </div>

            {contentTotal > 0 ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                Kurumda <strong>{contentTotal}</strong> içerik kaydı var (
                {contentLines
                  .slice(0, 3)
                  .map(line => `${line.rows} ${line.label}`)
                  .join(", ")}
                {contentLines.length > 3 ? ", …" : ""}). Bu hâliyle silinemez:
                önce kurumu kapatın, 30 gün sonra boşaltın.
              </p>
            ) : null}

            <p className="text-muted-foreground">
              Platform operatörlüğü veya başka bir kurumda üyeliği olan
              kişilerin hesapları <strong>silinmez</strong>; yalnızca bu kurumla
              ilişkileri kalkar.
            </p>

            <p className="text-muted-foreground">
              Kurum kodu <span className="font-mono">{organization.code}</span>{" "}
              yeniden kullanılmaz. Silme işlemi platform denetim kaydına
              yazılır.
            </p>

            <div className="grid gap-2 pt-1">
              <Label htmlFor="confirm-name">
                Onaylamak için kurum adını yazın
              </Label>
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={event => setConfirmName(event.target.value)}
                placeholder={organization.name}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setView("overview")}
              disabled={submitting}
              className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            >
              Geri
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!nameMatches || submitting || contentTotal > 0}
              title={
                contentTotal > 0
                  ? "Kurumda içerik var; önce boşaltın"
                  : nameMatches
                    ? undefined
                    : "Kurum adını birebir yazın"
              }
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-rose-500 disabled:opacity-40"
            >
              {submitting ? "Siliniyor…" : "Kurumu kalıcı olarak sil"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={next => (next ? undefined : close())}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{organization.name}</DialogTitle>
          <DialogDescription>
            Kurum kabı yönetimi. Kurumun içeriği burada görünmez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
              Kurum
            </h3>
            <dl className="mt-2 grid gap-2.5 rounded-xl bg-muted/60 p-4 text-[12px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Kurum kodu</dt>
                <dd className="font-mono font-bold">
                  {organization.code ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Kısa ad</dt>
                <dd className="font-mono">{organization.slug}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Kuruluş</dt>
                <dd>{formatDate(organization.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Kullanıcı · şube</dt>
                <dd className="font-bold">
                  {statsLoading
                    ? "…"
                    : stats
                      ? `${stats.memberCount} · ${stats.branchCount}`
                      : "okunamadı"}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              Yalnızca sayılar görünür. Kurumun kişi listesi, notları ve ödemesi
              operatöre kapalıdır.
            </p>
          </section>

          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
              Kurum yöneticisi
            </h3>
            <div className="mt-2 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Giriş numarası</span>
                <span className="font-mono font-bold">{adminLoginNumber}</span>
              </div>

              <button
                type="button"
                onClick={() => setView("reset-confirm")}
                className="mt-3 w-full rounded-xl border border-border px-4 py-2.5 text-left text-[12px] transition hover:bg-muted"
              >
                <span className="font-bold">Yeni geçici şifre üret</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Yönetici şifresini kaybettiyse. Kurum verisine dokunmaz.
                </span>
              </button>

              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                Kurumun diğer kullanıcılarını kurum yöneticisi kendi panelinden
                yönetir; operatör o listeyi görmez.
              </p>
            </div>
          </section>

          {/*
            Silme, kurum ve yönetici bölümlerinin İÇİNDE değil; ayrı bir başlık
            altında ve görsel olarak uzakta. Amaç, kişiyle ilgili bir iş yapmaya
            gelen birinin kazayla buraya uzanmasını zorlaştırmak.
          */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[.14em] text-rose-600 dark:text-rose-400">
              Tehlikeli işlemler
            </h3>
            <OrganizationClosureSection
              organization={organization}
              stats={stats}
              statsLoading={statsLoading}
              onChanged={onChanged}
            />
            <button
              type="button"
              onClick={() => setView("delete-confirm")}
              className="mt-2 w-full rounded-xl border border-rose-300 px-4 py-2.5 text-left text-[12px] text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              <span className="font-bold">Kurumu sil</span>
              <span className="mt-0.5 block text-[11px] opacity-80">
                Kurum, kullanıcı hesapları ve şubeleri kalıcı olarak silinir.
                İçerik kaydı olan kurum önce kapatılıp boşaltılmalı. Yöneticiyi
                değiştirmek için bu işlemi kullanmayın.
              </span>
            </button>
          </section>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={close}
            className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-muted-foreground transition hover:bg-muted"
          >
            Kapat
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
