import { useRef, useState } from "react";
import { isDemoMode } from "@/auth/runtime";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/auth/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CredentialsPanel } from "@/components/credentials/CredentialsPanel";
import type { IssuedCredentials } from "@/components/credentials/IssuedCredentials";
import { DEMO_TEMPORARY_PASSWORD } from "@/components/credentials/IssuedCredentials";
import { MemberCreateDialog } from "./MemberCreateDialog";
import { settingsKeys, useSettingsMembers } from "@/settings/settingsQueries";
import { educationKeys } from "@/education/educationQueries";
import {
  resetMemberPassword,
  changeMemberRole,
  removeMember,
  translateMembershipActionError,
  isNeutralMembershipInfo,
  type MemberRole,
  type MemberStatus,
  type OrganizationMember,
} from "@/organization/memberService";
import { roleMeta } from "../roleMeta";
import { organizationMembers as demoMembers } from "../educationData";
import { Badge, ErrorState, TableSkeleton } from "../shared";

const ASSIGNABLE_ROLES: { value: MemberRole; label: string }[] = [
  { value: "admin", label: "Yönetici" },
  { value: "teacher", label: "Öğretmen" },
  { value: "student", label: "Öğrenci" },
  { value: "parent", label: "Veli" },
];

const STATUS_META: Record<
  MemberStatus,
  { label: string; tone: "green" | "amber" | "rose" }
> = {
  active: { label: "Aktif", tone: "green" },
  invited: { label: "Davet edildi", tone: "amber" },
  suspended: { label: "Askıda", tone: "rose" },
};

function getResetTargetLabel(member: OrganizationMember): string {
  if (member.displayName) {
    return `${member.displayName} için`;
  }
  if (member.loginNumber) {
    return `${member.loginNumber} numaralı üye için`;
  }
  return "Seçilen üye için";
}

function getResetTargetSubjectName(member: OrganizationMember): string {
  if (member.displayName) {
    return member.displayName;
  }
  if (member.loginNumber) {
    return `${member.loginNumber} Numaralı Üye`;
  }
  return "Kurum Üyesi";
}

export function SettingsMembersSection() {
  const { identity, demoMode } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = identity?.membership?.organizationId;
  const currentRole = identity?.membership?.role;
  const isAdmin = currentRole === "admin";

  const {
    data: serverMembers = [],
    isLoading,
    error: queryError,
    refetch,
  } = useSettingsMembers();

  const members = demoMode ? demoMembers : serverMembers;
  const loading = !demoMode && isLoading;
  const loadError = queryError ? queryError.message : null;

  const [resetTarget, setResetTarget] = useState<OrganizationMember | null>(
    null
  );
  const [resetView, setResetView] = useState<"confirm" | "credentials">(
    "confirm"
  );
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  /** Bkz. `MemberCreateDialog` — tekrar koruması bu `ref`e bağlı. */
  const resetIdempotencyKeyRef = useRef<string | null>(null);
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(
    null
  );
  const [createOpen, setCreateOpen] = useState(false);

  const [changeRoleTarget, setChangeRoleTarget] =
    useState<OrganizationMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<OrganizationMember | null>(
    null
  );

  const handleOpenReset = (member: OrganizationMember) => {
    setResetTarget(member);
    setResetView("confirm");
    setResetError(null);
    setCredentials(null);
  };

  const handleCloseReset = () => {
    if (resetSubmitting) {
      return;
    }
    setResetTarget(null);
    setResetView("confirm");
    setResetError(null);
    setCredentials(null);
  };

  const handleConfirmReset = async () => {
    if (!resetTarget || resetSubmitting) {
      return;
    }

    // Derleme sabitiyle: üretimde demo dalı ve demo şifresi elenir (B12).
    if (isDemoMode && demoMode) {
      if (!resetTarget.loginNumber) {
        return;
      }
      setCredentials({
        loginNumber: resetTarget.loginNumber,
        temporaryPassword: DEMO_TEMPORARY_PASSWORD,
        passwordLockSet: true,
        auditWritten: true,
      });
      setResetView("credentials");
      return;
    }

    setResetSubmitting(true);
    setResetError(null);

    // İlk denemede üretilir, sonraki denemelerde AYNI kalır (v1.2-17).
    // Değişseydi, hata alıp tekrar basan yönetici ikinci bir şifre üretir ve
    // az önce kâğıda yazdığı fişi sessizce geçersiz kılardı.
    if (resetIdempotencyKeyRef.current === null) {
      resetIdempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      const result = await resetMemberPassword(
        resetTarget.membershipId,
        resetIdempotencyKeyRef.current ?? undefined
      );
      resetIdempotencyKeyRef.current = null;
      setCredentials(result);
      setResetView("credentials");
    } catch (error) {
      setResetError(
        error instanceof Error
          ? error.message
          : "Şifre sıfırlanamadı. Lütfen tekrar deneyin."
      );
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[18px] font-extrabold text-slate-900">
            Kurum Üyeleri
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Kurumunuza kayıtlı yöneticiler, öğretmenler, öğrenciler ve veliler.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-slate-900 px-3.5 py-2 text-[12px] font-extrabold text-white transition hover:bg-slate-800 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-300"
        >
          Üye ekle
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} columns={7} className="mt-6" />
      ) : loadError ? (
        <ErrorState
          className="mt-6"
          title="Üye listesi alınamadı"
          message={loadError}
          onRetry={!demoMode ? () => void refetch() : undefined}
        />
      ) : members.length === 0 ? (
        <div className="mt-6 flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8">
          <p className="text-[12px] font-medium text-slate-500">
            Kurumda kayıtlı üye bulunamadı.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">Ad Soyad</th>
                <th className="px-4 py-3">Giriş Numarası</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Bağlı Kişi</th>
                <th className="px-4 py-3">Şube</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {members.map(member => (
                <tr
                  key={member.membershipId}
                  className="transition hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {member.displayName ? (
                      member.displayName
                    ) : (
                      <span className="font-sans font-normal italic text-slate-400">
                        adı okunamadı
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                    {member.loginNumber ? (
                      member.loginNumber
                    ) : (
                      <span className="font-sans italic text-slate-400">
                        numarası yok
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {roleMeta[member.role]?.label ?? member.role}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {member.role === "student" || member.role === "parent" ? (
                      member.linkedPerson ? (
                        <span className="font-semibold text-slate-800">
                          {member.linkedPerson.name}
                        </span>
                      ) : (
                        <Badge tone="slate">Bağlı değil</Badge>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {member.branchName ?? (
                      <span className="italic text-slate-400">
                        Kurum geneli
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_META[member.status]?.tone ?? "slate"}>
                      {STATUS_META[member.status]?.label ?? member.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenReset(member)}
                        disabled={!member.loginNumber}
                        title={
                          member.loginNumber
                            ? undefined
                            : "Giriş numarası olmayan üyenin şifresi sıfırlanamaz"
                        }
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700"
                      >
                        Şifre sıfırla
                      </button>
                      {isAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setChangeRoleTarget(member)}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                          >
                            Rol değiştir
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(member)}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
                          >
                            Kurumdan çıkar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget ? (
        <Dialog
          open={Boolean(resetTarget)}
          onOpenChange={open => {
            if (!open) handleCloseReset();
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            {resetView === "credentials" && credentials ? (
              <>
                <DialogHeader>
                  <DialogTitle>Yeni şifre üretildi</DialogTitle>
                  <DialogDescription>
                    Üyenin giriş bilgileri aşağıda. Bu ekran bir kez gösterilir.
                  </DialogDescription>
                </DialogHeader>

                <CredentialsPanel
                  subjectLabel="Üye"
                  subjectName={getResetTargetSubjectName(resetTarget)}
                  credentials={credentials}
                  onDone={handleCloseReset}
                />
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Yeni geçici şifre üret</DialogTitle>
                  <DialogDescription>
                    {getResetTargetLabel(resetTarget)} yeni bir geçici şifre
                    üretilecek. Kişinin mevcut şifresi geçersiz olacak.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2 text-[12px] leading-5 text-muted-foreground">
                  <p>
                    Üyenin mevcut şifresi <strong>geçersiz olacak</strong>.
                    Halihazırda giriş yapabiliyorsa bu işlemi yapmayın.
                  </p>
                  <p>
                    İşlem kurum denetim kaydına yazılır ve kimin yaptığı
                    görünür. Şifrenin kendisi hiçbir yere kaydedilmez.
                  </p>

                  {resetError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] leading-5 text-rose-800">
                      <p className="font-bold">Şifre sıfırlanamadı</p>
                      <p className="mt-0.5 text-[11px] text-rose-700">
                        {resetError}
                      </p>
                    </div>
                  ) : null}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleCloseReset}
                    disabled={resetSubmitting}
                    className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmReset()}
                    disabled={resetSubmitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-300"
                  >
                    {resetSubmitting ? "Üretiliyor…" : "Yeni şifre üret"}
                  </button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      ) : null}

      <ChangeRoleDialog
        key={changeRoleTarget?.membershipId}
        member={changeRoleTarget}
        open={Boolean(changeRoleTarget)}
        onClose={() => setChangeRoleTarget(null)}
        organizationId={organizationId}
        isSelf={
          changeRoleTarget?.membershipId === identity?.membership?.membershipId
        }
      />

      <RemoveMemberDialog
        key={removeTarget?.membershipId}
        member={removeTarget}
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        organizationId={organizationId}
        isSelf={
          removeTarget?.membershipId === identity?.membership?.membershipId
        }
      />

      <MemberCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={identity?.membership?.organizationId ?? ""}
        onDone={() => {
          setCreateOpen(false);
          void queryClient.invalidateQueries({
            queryKey: organizationId
              ? settingsKeys.members(organizationId)
              : settingsKeys.all,
          });
        }}
      />
    </>
  );
}

export function ChangeRoleDialog({
  member,
  open,
  onClose,
  initialError,
  organizationId,
  isSelf: isSelfProp,
}: {
  member: OrganizationMember | null;
  open: boolean;
  onClose: () => void;
  initialError?: string;
  organizationId?: string;
  isSelf?: boolean;
}) {
  const { identity, demoMode } = useAuth();
  const queryClient = useQueryClient();

  const isSelf =
    isSelfProp !== undefined
      ? isSelfProp
      : Boolean(
          member &&
          identity?.membership?.membershipId &&
          member.membershipId === identity.membership.membershipId
        );

  const [selectedRole, setSelectedRole] = useState<MemberRole>(() => {
    if (!member || member.role === "admin") return "teacher";
    return member.role as MemberRole;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const idempotencyKeyRef = useRef<string | null>(null);

  if (!open || !member) return null;

  const isSelfDemotion =
    isSelf && member.role === "admin" && selectedRole !== "admin";

  const handleConfirm = async () => {
    if (submitting) return;

    if (demoMode) {
      toast.info("Demo modunda rol değişikliği uygulandı.", {
        description: `${member.displayName ?? "Üye"} için yeni rol ${roleMeta[selectedRole]?.label ?? selectedRole} olarak ayarlandı.`,
      });
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);

    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      await changeMemberRole(
        member.membershipId,
        selectedRole,
        idempotencyKeyRef.current ?? undefined
      );
      idempotencyKeyRef.current = null;
      toast.success("Üye rolü güncellendi", {
        description: `${member.displayName ?? "Üye"} için yeni rol ${roleMeta[selectedRole]?.label ?? selectedRole} olarak ayarlandı.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: organizationId
            ? settingsKeys.members(organizationId)
            : settingsKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: organizationId
            ? educationKeys.students(organizationId)
            : educationKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: organizationId
            ? educationKeys.guardians(organizationId)
            : educationKeys.all,
        }),
      ]);
      onClose();
    } catch (err) {
      if (isNeutralMembershipInfo(err)) {
        toast.info(
          translateMembershipActionError(err, "change_role", { isSelf })
        );
        onClose();
      } else {
        const msg = translateMembershipActionError(err, "change_role", {
          isSelf,
        });
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Üye Rolünü Değiştir</DialogTitle>
          <DialogDescription>
            {getResetTargetSubjectName(member)} için yeni bir rol seçin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-[12px] leading-5 text-muted-foreground">
          <p>
            Rol değişikliği üyenin sisteme giriş yetkilerini ve kurum içi erişim
            kapsamını anında günceller.
          </p>

          {isSelfDemotion ? (
            <div
              data-testid="self-demotion-warning"
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <p className="font-bold text-amber-950 dark:text-amber-100">
                Yöneticiliği bırakıyorsunuz.
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                Bu işlemden sonra üye yönetimi yetkiniz kalmayacak ve rolünüzü
                yalnız başka bir yönetici geri verebilecek.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="member-role-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Yeni Rol
            </label>
            <select
              id="member-role-select"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as MemberRole)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div
              role="alert"
              data-testid="change-role-error"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] leading-5 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <p className="font-bold">Rol değiştirilemedi</p>
              <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-400">
                {error}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-300"
          >
            {submitting ? "Güncelleniyor…" : "Rolü Değiştir"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveMemberDialog({
  member,
  open,
  onClose,
  initialError,
  organizationId,
  isSelf: isSelfProp,
}: {
  member: OrganizationMember | null;
  open: boolean;
  onClose: () => void;
  initialError?: string;
  organizationId?: string;
  isSelf?: boolean;
}) {
  const { identity, demoMode } = useAuth();
  const queryClient = useQueryClient();

  const isSelf =
    isSelfProp !== undefined
      ? isSelfProp
      : Boolean(
          member &&
          identity?.membership?.membershipId &&
          member.membershipId === identity.membership.membershipId
        );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const idempotencyKeyRef = useRef<string | null>(null);

  if (!open || !member) return null;

  const handleConfirm = async () => {
    if (submitting) return;

    if (demoMode) {
      toast.info("Demo modunda üyelik çıkarma işlemi uygulandı.");
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);

    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      await removeMember(
        member.membershipId,
        idempotencyKeyRef.current ?? undefined
      );
      idempotencyKeyRef.current = null;
      const isStudentOrParent =
        member.role === "student" || member.role === "parent";
      toast.success("Üye kurumdan çıkarıldı", {
        description: isStudentOrParent
          ? "Üyelik askıya alındı ve akademik kaydının hesap bağı koparıldı."
          : "Üyelik askıya alındı; kişi kuruma giriş yapamayacak.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: organizationId
            ? settingsKeys.members(organizationId)
            : settingsKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: organizationId
            ? educationKeys.students(organizationId)
            : educationKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: organizationId
            ? educationKeys.guardians(organizationId)
            : educationKeys.all,
        }),
      ]);
      onClose();
    } catch (err) {
      if (isNeutralMembershipInfo(err)) {
        toast.info(translateMembershipActionError(err, "remove", { isSelf }));
        onClose();
      } else {
        const msg = translateMembershipActionError(err, "remove", { isSelf });
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Üyeyi Kurumdan Çıkar</DialogTitle>
          <DialogDescription>
            {getResetTargetSubjectName(member)} kurumdan çıkarılacak.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
          {member.role === "student" || member.role === "parent" ? (
            <p>
              Üyelik askıya alınacak{" "}
              <strong>ve akademik kaydının hesap bağı koparılacak.</strong>{" "}
              Kayıt silinmiyor; istenirse yeniden bağlanabilir.
            </p>
          ) : isSelf && member.role === "admin" ? (
            <div
              data-testid="self-removal-warning"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] leading-5 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <p className="font-bold text-rose-950 dark:text-rose-100">
                Yöneticiliği ve kurumu bırakıyorsunuz.
              </p>
              <p className="mt-0.5 text-[11px] text-rose-800 dark:text-rose-300">
                Üyeliğiniz askıya alınacak ve bu işlemden sonra kuruma giriş
                yapamayacaksınız. Bu işlemi yalnız başka bir yönetici geri
                alabilir.
              </p>
            </div>
          ) : (
            <p>Üyelik askıya alınacak; kişi kuruma giriş yapamayacak.</p>
          )}

          <p className="text-[11px] text-muted-foreground">
            İşlem kurum denetim kaydına yazılır ve yetkiler derhal durdurulur.
          </p>

          {error ? (
            <div
              role="alert"
              data-testid="remove-member-error"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] leading-5 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <p className="font-bold">Üye çıkarılamadı</p>
              <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-400">
                {error}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-[12px] font-bold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            {submitting ? "Çıkarılıyor…" : "Kurumdan Çıkar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
