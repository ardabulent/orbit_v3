import { useEffect, useMemo, useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { CredentialsPanel } from "@/components/credentials/CredentialsPanel";
import type { IssuedCredentials } from "@/components/credentials/IssuedCredentials";
import { DEMO_TEMPORARY_PASSWORD } from "@/components/credentials/IssuedCredentials";
import { useAuth } from "@/auth/useAuth";
import { useSettingsBranches } from "@/settings/settingsQueries";
import {
  createMember,
  resolveBranchSelection,
  type CreatableMemberRole,
} from "@/organization/memberService";
import { roleMeta } from "../roleMeta";

const MEMBER_ROLES: CreatableMemberRole[] = ["teacher", "student", "parent"];

export function MemberCreateDialog({
  open,
  onOpenChange,
  onDone,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  organizationId: string;
}) {
  const { demoMode } = useAuth();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<CreatableMemberRole>("teacher");
  const [selectedBranchKey, setSelectedBranchKey] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const {
    data: branchList = [],
    isLoading: branchQueryLoading,
    error: branchQueryError,
  } = useSettingsBranches(organizationId, { enabled: open });

  const branches = useMemo(
    () => (demoMode ? [] : branchList),
    [demoMode, branchList]
  );
  const branchLoading = !demoMode && open && branchQueryLoading;
  const branchError =
    !demoMode && open && branchQueryError ? branchQueryError.message : null;

  // Şube seçimi varsayılan şubeden ön-dolar (v1.4-09 · #284)
  useEffect(() => {
    if (!open || selectedBranchKey || branches.length === 0) {
      return;
    }
    const defaultBranch =
      branches.find(
        b => b.isDefault ?? (b as { is_default?: boolean }).is_default
      ) ?? (branches.length === 1 ? branches[0] : undefined);
    if (defaultBranch) {
      setSelectedBranchKey(defaultBranch.id);
    }
  }, [open, selectedBranchKey, branches]);

  /**
   * Aynı gönderimin tekrarını sunucuya tanıtan anahtar (v1.2-17).
   *
   * **`ref`te durmasının sebebi tam olarak bu:** kullanıcı hata alıp düğmeye
   * yeniden bastığında anahtar DEĞİŞMEMELİ, yoksa sunucu iki ayrı istek görür
   * ve aynı kişi için ikinci bir hesap açılır. State olsaydı her render'da
   * yeniden üretme riski doğardı.
   *
   * Başarıda ve diyalog kapanışında sıfırlanıyor: bir sonraki üye gerçekten
   * yeni bir istektir.
   */
  const idempotencyKeyRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(
    null
  );

  const reset = () => {
    setFullName("");
    setRole("teacher");
    setSelectedBranchKey("");
    setError(null);
    setCredentials(null);
    // Diyalog kapandı: bundan sonrası yeni bir istektir, eski anahtar
    // taşınırsa bir sonraki üye "zaten işlenmiş" diye reddedilirdi.
    idempotencyKeyRef.current = null;
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) {
      return;
    }
    // Üye oluşturulduktan sonra pencere "Tamam" dışında bir yolla (X,
    // dışarı tıklama, Esc) kapatılırsa da `onDone` çalışır: listeler
    // yalnız "Tamam"da tazeleniyordu ve yeni hesap "Hesap bağla" listesine
    // düşmüyordu (ROADMAP §4.23 C-02/C-05).
    if (!next && credentials) {
      reset();
      onDone();
      return;
    }
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const defaultBranch =
    branches.find(
      b => b.isDefault ?? (b as { is_default?: boolean }).is_default
    ) ?? (branches.length === 1 ? branches[0] : undefined);

  const effectiveBranchKey = selectedBranchKey || defaultBranch?.id || "";
  const resolvedBranchId = resolveBranchSelection(effectiveBranchKey);
  const nameValidationError =
    fullName.trim().length < 2 ? "Ad-soyad en az iki karakter olmalı." : null;
  const branchValidationError =
    resolvedBranchId === undefined
      ? "Lütfen bir şube veya kurum geneli seçin."
      : null;
  const formValidationError = nameValidationError ?? branchValidationError;

  const handleSubmit = async () => {
    if (
      formValidationError ||
      submitting ||
      branchError ||
      branchLoading ||
      resolvedBranchId === undefined
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);

    // İlk denemede üretilir, sonraki denemelerde AYNI kalır. Tekrar korumasının
    // tamamı bu satırın `ref`te olmasına bağlı.
    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      const result = demoMode
        ? {
            loginNumber: "demo-" + Date.now().toString().slice(-4),
            temporaryPassword: DEMO_TEMPORARY_PASSWORD,
            passwordLockSet: true,
            auditWritten: true,
          }
        : await createMember(
            {
              fullName: fullName.trim(),
              role,
              branchId: resolvedBranchId,
            },
            idempotencyKeyRef.current ?? undefined
          );

      // İş bitti; sıradaki üye gerçekten yeni bir istektir.
      idempotencyKeyRef.current = null;
      setCredentials(result);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Üye oluşturulamadı. Lütfen tekrar deneyin."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (credentials) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Üye oluşturuldu</DialogTitle>
            <DialogDescription>
              Üyenin giriş bilgileri aşağıda. Bu ekran bir kez gösterilir.
            </DialogDescription>
          </DialogHeader>
          <CredentialsPanel
            subjectLabel="Üye"
            subjectName={fullName.trim()}
            credentials={credentials}
            onDone={() => {
              reset();
              onDone();
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Yeni üye ekle</DialogTitle>
          <DialogDescription>
            Öğretmen, öğrenci veya veli hesabı oluşturun. Giriş bilgileri işlem
            sonunda yalnızca bir kez gösterilir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="member-full-name">Ad-soyad</Label>
            <Input
              id="member-full-name"
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              placeholder="Ad Soyad"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-role">Rol</Label>
            <select
              id="member-role"
              value={role}
              onChange={event =>
                setRole(event.target.value as CreatableMemberRole)
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {MEMBER_ROLES.map(memberRole => (
                <option key={memberRole} value={memberRole}>
                  {roleMeta[memberRole].label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-branch">Şube</Label>
            <select
              id="member-branch"
              value={effectiveBranchKey}
              onChange={event => setSelectedBranchKey(event.target.value)}
              disabled={branchLoading || Boolean(branchError)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Şube seçin…
              </option>
              <option value="__all__">Kurum geneli (tüm şubeler)</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {effectiveBranchKey === "__all__" ? (
              <p className="rounded-md bg-amber-50/70 p-2 text-[11px] leading-4 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <strong>Kurum geneli:</strong> Bu üye kurumun tüm mevcut ve
                gelecekte açılacak şubelerini görebilir ve işlem yapabilir.
              </p>
            ) : null}
            {branchLoading ? (
              <div
                role="status"
                aria-busy="true"
                className="flex items-center gap-2 pt-1"
              >
                <Skeleton className="h-3.5 w-28 bg-slate-100" />
                <span className="sr-only">Şubeler yükleniyor…</span>
              </div>
            ) : null}
            {branchError ? (
              <p className="text-[11px] font-bold text-rose-600">
                {branchError}
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] leading-5 text-rose-800">
              <p className="font-bold">Üye oluşturulamadı</p>
              <p className="mt-0.5 text-[11px] text-rose-700">{error}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              Boolean(formValidationError) ||
              submitting ||
              branchLoading ||
              Boolean(branchError)
            }
            title={formValidationError ?? undefined}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-300"
          >
            {submitting ? "Oluşturuluyor…" : "Üyeyi oluştur"}
          </button>
        </DialogFooter>

        {formValidationError ? (
          <p className="-mt-1 text-right text-[11px] font-bold text-amber-600 dark:text-amber-400">
            {formValidationError}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
