import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert } from "lucide-react";
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
import {
  educationKeys,
  useClasses,
  useGuardians,
} from "@/education/educationQueries";
import {
  runNewStudentFlow,
  type NewStudentGuardian,
  type NewStudentResult,
} from "@/education/newStudentFlow";
import { settingsKeys, useSettingsBranches } from "@/settings/settingsQueries";

/**
 * "Yeni öğrenci" — tek akış (karar 2026-09-28).
 *
 * Öğrenci kaydı, sınıf, veli ve giriş hesapları tek pencerede. Adımları
 * `runNewStudentFlow` yürütür; bu bileşen yalnız formu ve sonucu çizer.
 *
 * Sonuç ekranı her adımı gösterir. Yarım kalan bir adım (ör. hesap açıldı
 * ama bağlanamadı) ne olduğunu ve nasıl tamamlanacağını yazar. Açılan her
 * hesabın giriş bilgisi — şifre yalnız bir kez döndüğü için — sırayla
 * gösterilir ve kullanıcı "kaydettim" demeden pencere kapanmaz
 * (`CredentialsPanel`).
 */

const SELECT_CLASS =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50";

type GuardianMode = NewStudentGuardian["mode"];

export function NewStudentDialog({
  open,
  onOpenChange,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}) {
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [branchId, setBranchId] = useState("");
  const [classId, setClassId] = useState("");
  const [guardianMode, setGuardianMode] = useState<GuardianMode>("new");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [existingGuardianId, setExistingGuardianId] = useState("");
  const [studentAccount, setStudentAccount] = useState(true);
  const [guardianAccount, setGuardianAccount] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewStudentResult | null>(null);
  const [accountIndex, setAccountIndex] = useState(0);

  const { data: branches = [] } = useSettingsBranches(organizationId, {
    enabled: open,
  });
  const classesQuery = useClasses({ organizationId, enabled: open });
  const guardiansQuery = useGuardians({ organizationId, enabled: open });
  const guardians = guardiansQuery.data?.rows ?? [];
  const existingGuardian = guardians.find(g => g.id === existingGuardianId);

  const defaultBranch = useMemo(
    () =>
      branches.find(
        b => b.isDefault ?? (b as { is_default?: boolean }).is_default
      ) ?? (branches.length === 1 ? branches[0] : undefined),
    [branches]
  );
  const effectiveBranchId = branchId || defaultBranch?.id || "";

  const hasGuardian =
    guardianMode === "new" ||
    (guardianMode === "existing" && Boolean(existingGuardianId));
  const guardianAlreadyHasAccount =
    guardianMode === "existing" && Boolean(existingGuardian?.hasAccount);

  const validation =
    fullName.trim().length < 2
      ? "Öğrencinin ad-soyadı en az iki karakter olmalı."
      : !effectiveBranchId
        ? "Lütfen bir şube seçin."
        : guardianMode === "new" && guardianName.trim().length < 2
          ? "Velinin ad-soyadı en az iki karakter olmalı."
          : guardianMode === "existing" && !existingGuardianId
            ? "Lütfen bir veli seçin."
            : null;

  const reset = () => {
    setFullName("");
    setStudentNumber("");
    setBranchId("");
    setClassId("");
    setGuardianMode("new");
    setGuardianName("");
    setGuardianPhone("");
    setExistingGuardianId("");
    setStudentAccount(true);
    setGuardianAccount(true);
    setError(null);
    setResult(null);
    setAccountIndex(0);
  };

  const refreshLists = () =>
    Promise.all(
      [
        educationKeys.students(organizationId),
        educationKeys.guardians(organizationId),
        educationKeys.studentGuardians(organizationId),
        educationKeys.classes(organizationId),
        educationKeys.adminOverview(organizationId),
        settingsKeys.members(organizationId),
      ].map(queryKey => queryClient.invalidateQueries({ queryKey }))
    );

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    // Giriş bilgisi gösterilirken pencere yalnız panelin "Tamam"ıyla kapanır:
    // şifre bir daha gösterilmez.
    if (!next && result && accountIndex < result.accounts.length) return;
    if (!next) close();
    else onOpenChange(true);
  };

  const handleSubmit = async () => {
    if (validation || submitting) return;
    setSubmitting(true);
    setError(null);

    const guardian: NewStudentGuardian =
      guardianMode === "new"
        ? { mode: "new", fullName: guardianName, phone: guardianPhone }
        : guardianMode === "existing" && existingGuardian
          ? {
              mode: "existing",
              guardianId: existingGuardian.id,
              guardianName: existingGuardian.fullName,
              hasAccount: existingGuardian.hasAccount,
            }
          : { mode: "none" };

    try {
      const outcome = await runNewStudentFlow({
        organizationId,
        branchId: effectiveBranchId,
        fullName,
        studentNumber,
        classId: classId || null,
        guardian,
        createStudentAccount: studentAccount,
        createGuardianAccount: hasGuardian && guardianAccount,
      });
      setResult(outcome);
      setAccountIndex(0);
      await refreshLists();
    } catch (err) {
      // Öğrenci kaydı oluşmadı; hiçbir şey yazılmadı, form düzeltilebilir.
      setError(
        err instanceof Error ? err.message : "Öğrenci kaydı oluşturulamadı."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentAccount = result?.accounts[accountIndex];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Öğrenci eklendi</DialogTitle>
              <DialogDescription>
                Yapılan her adım aşağıda. Yarım kalan bir adım varsa nasıl
                tamamlanacağı yazıyor.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2">
              {result.steps.map(step => (
                <li
                  key={step.label}
                  className={`flex gap-2 rounded-lg border p-2.5 ${
                    step.ok
                      ? "border-emerald-100 bg-emerald-50/50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  {step.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <span>
                    <span className="block text-[12px] font-bold text-slate-800">
                      {step.label}
                    </span>
                    {step.message ? (
                      <span className="mt-0.5 block text-[11px] text-slate-600">
                        {step.message}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {currentAccount ? (
              <div className="mt-2">
                {result.accounts.length > 1 ? (
                  <p className="mb-2 text-[11px] font-bold text-slate-500">
                    Giriş bilgisi {accountIndex + 1} / {result.accounts.length}
                  </p>
                ) : null}
                <CredentialsPanel
                  key={accountIndex}
                  subjectLabel={currentAccount.subjectLabel}
                  subjectName={currentAccount.subjectName}
                  credentials={currentAccount.credentials}
                  onDone={() => {
                    if (accountIndex + 1 < result.accounts.length) {
                      setAccountIndex(accountIndex + 1);
                    } else {
                      close();
                    }
                  }}
                />
              </div>
            ) : (
              <DialogFooter>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-white hover:bg-slate-800"
                >
                  <span className="text-[12px] font-bold">Tamam</span>
                </button>
              </DialogFooter>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Yeni öğrenci</DialogTitle>
              <DialogDescription>
                Öğrenci kaydı, sınıfı, velisi ve giriş hesapları tek adımda.
                Sınıf ve veli isteğe bağlı; sonra da eklenebilir.
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] font-medium text-rose-700"
              >
                {error}
              </div>
            ) : null}

            <fieldset className="space-y-3" disabled={submitting}>
              <legend className="text-[11px] font-extrabold uppercase tracking-[.1em] text-slate-400">
                Öğrenci
              </legend>
              <div className="grid gap-1.5">
                <Label htmlFor="ns-name">
                  Ad-soyad <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="ns-name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Örn. Zeynep Kaya"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ns-number">Öğrenci numarası</Label>
                  <Input
                    id="ns-number"
                    value={studentNumber}
                    onChange={e => setStudentNumber(e.target.value)}
                    placeholder="İsteğe bağlı"
                    maxLength={32}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ns-branch">Şube</Label>
                  <select
                    id="ns-branch"
                    value={effectiveBranchId}
                    onChange={e => setBranchId(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">Şube seçin…</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ns-class">Sınıf</Label>
                <select
                  id="ns-class"
                  value={classId}
                  onChange={e => setClassId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Şimdilik sınıfsız</option>
                  {(classesQuery.data?.rows ?? []).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>

            <fieldset className="space-y-3" disabled={submitting}>
              <legend className="text-[11px] font-extrabold uppercase tracking-[.1em] text-slate-400">
                Veli
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {(
                  [
                    ["new", "Yeni veli"],
                    ["existing", "Kayıtlı veli"],
                    ["none", "Şimdilik velisiz"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={guardianMode === mode}
                    onClick={() => setGuardianMode(mode)}
                    className={`rounded-full px-3 py-1.5 ${
                      guardianMode === mode
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 text-slate-600"
                    }`}
                  >
                    <span className="text-[11px] font-bold">{label}</span>
                  </button>
                ))}
              </div>
              {guardianMode === "new" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ns-guardian-name">
                      Velinin ad-soyadı <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="ns-guardian-name"
                      value={guardianName}
                      onChange={e => setGuardianName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ns-guardian-phone">Telefon</Label>
                    <Input
                      id="ns-guardian-phone"
                      value={guardianPhone}
                      onChange={e => setGuardianPhone(e.target.value)}
                      placeholder="İsteğe bağlı"
                    />
                  </div>
                </div>
              ) : null}
              {guardianMode === "existing" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="ns-guardian">Veli</Label>
                  <select
                    id="ns-guardian"
                    value={existingGuardianId}
                    onChange={e => setExistingGuardianId(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">Veli seçin…</option>
                    {guardians.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.fullName}
                        {g.studentNames?.length
                          ? ` — ${g.studentNames.join(", ")}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Kardeş kaydında aynı veliyi seçin; ikinci bir veli kaydı
                    açılmaz.
                  </p>
                </div>
              ) : null}
            </fieldset>

            <fieldset className="space-y-2" disabled={submitting}>
              <legend className="text-[11px] font-extrabold uppercase tracking-[.1em] text-slate-400">
                Giriş hesapları
              </legend>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={studentAccount}
                  onChange={e => setStudentAccount(e.target.checked)}
                />
                <span className="text-[12px]">Öğrenciye giriş hesabı aç</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasGuardian && guardianAccount}
                  disabled={!hasGuardian || guardianAlreadyHasAccount}
                  onChange={e => setGuardianAccount(e.target.checked)}
                />
                <span className="text-[12px]">
                  {guardianAlreadyHasAccount
                    ? "Velinin zaten giriş hesabı var"
                    : "Veliye giriş hesabı aç"}
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                Giriş numarası ve geçici şifre işlem sonunda bir kez gösterilir;
                ilk girişte şifre değiştirilir.
              </p>
            </fieldset>

            <DialogFooter>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
                className="h-9 rounded-lg border border-slate-200 px-4 text-slate-700 hover:bg-slate-50"
              >
                <span className="text-[12px] font-semibold">Vazgeç</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={Boolean(validation) || submitting}
                title={validation ?? undefined}
                className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <span className="text-[12px] font-bold">
                  {submitting ? "Kaydediliyor…" : "Öğrenciyi ekle"}
                </span>
              </button>
            </DialogFooter>
            {validation && fullName ? (
              <p className="text-right text-[11px] text-slate-500">
                {validation}
              </p>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
