import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import { saveProfilePhone } from "@/auth/profileContactService";
import { settingsKeys, useProfileContact } from "@/settings/settingsQueries";
import { demoRoleNames, roleMeta } from "../roleMeta";
import { roleEmail } from "../demoData";
import { isDemoMode } from "@/auth/runtime";
import type { Role } from "../types";
import { SettingsFormField } from "./SettingsFormField";
import { RecoveryEmailCard } from "./RecoveryEmailCard";

/**
 * Derleme anında belli olan demo bayrağı (2026-10-17, Hız 2). Ayrıntı ve
 * gerekçe: `educationData.ts`'teki aynı adlı sabit. Kapı:
 * `scripts/check-demo-leak.mjs`.
 */
const DEMO_BUILD =
  typeof __ORBIT_DEMO_MODE__ === "boolean" ? __ORBIT_DEMO_MODE__ : isDemoMode;

export function SettingsProfileSection({ role }: { role: Role }) {
  const { identity, demoMode } = useAuth();
  const queryClient = useQueryClient();
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: contact, isLoading, error: queryError } = useProfileContact();

  const phone = demoMode
    ? "+90 555 123 45 67"
    : userPhone !== null
      ? userPhone
      : (contact?.phone ?? "");

  const recoveryEmail =
    DEMO_BUILD && demoMode ? roleEmail[role] : (contact?.recoveryEmail ?? "");

  const loading = !demoMode && isLoading;
  const loadError = queryError ? queryError.message : null;

  const displayName = demoMode
    ? demoRoleNames[role]
    : (identity?.displayName ?? "");

  const save = async () => {
    if (demoMode) {
      toast.success("Değişiklikler kaydedildi", {
        description: "Profil bilgileriniz bu oturumda güncellendi.",
      });
      return;
    }

    setSaving(true);
    try {
      await saveProfilePhone(phone.trim() || null);
      if (identity?.userId) {
        void queryClient.invalidateQueries({
          queryKey: settingsKeys.profileContact(identity.userId),
        });
      }
      toast.success("Değişiklikler kaydedildi", {
        description: "Telefon bilginiz güncellendi.",
      });
    } catch (error) {
      toast.error("Değişiklikler kaydedilemedi", {
        description:
          error instanceof Error ? error.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[18px] font-extrabold text-slate-900">
          Profil Tercihleri
        </h2>
        <button
          onClick={() => void save()}
          disabled={loading || saving || Boolean(loadError)}
          className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-slate-900 px-4 text-[11px] font-bold text-white shadow-[0_8px_16px_rgba(15,23,42,.12)] transition hover:bg-slate-800 active:scale-[.98]"
        >
          {saving ? "Kaydediliyor" : "Değişiklikleri Kaydet"}
        </button>
      </div>
      {loadError ? (
        <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[11px] leading-5 text-rose-800">
          {loadError}
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SettingsFormField label="Ad Soyad" value={displayName} disabled />
        <SettingsFormField
          label="Telefon"
          value={phone}
          onChange={setUserPhone}
        />
        <SettingsFormField label="Rol" value={roleMeta[role].label} disabled />
        {demoMode ? (
          <SettingsFormField
            label="Kurtarma e-postası"
            value={recoveryEmail}
            disabled
            type="email"
          />
        ) : (
          <RecoveryEmailCard
            current={recoveryEmail.trim() || null}
            disabled={loading || Boolean(loadError)}
          />
        )}
      </div>
      {/* `loading` koşulu, veri gelmeden uyarı gösterilmesini engelliyor:
          aksi halde kurtarma adresi OLAN biri de bir an "yöntemin yok"
          okurdu. Yükleme başarısız olursa `loading` düşer ve `recoveryEmail`
          boş kalır — yani uyarı görünür, ki bilinmeyende doğru taraf odur. */}
      {!demoMode && !loading && !recoveryEmail.trim() ? (
        <p className="mt-5 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-[11px] leading-5 text-amber-900">
          {role === "admin"
            ? "Hesabınıza kayıtlı bir kurtarma e-postası bulunmuyor. Yukarıdan ekleyin; eklemezseniz şifrenizi unuttuğunuzda yeni geçici şifre için platform operatörüne başvurmanız gerekir."
            : "Hesabınıza kayıtlı bir kurtarma e-postası bulunmuyor. Yukarıdan ekleyin; eklemezseniz şifrenizi unuttuğunuzda yeni geçici şifre için kurum yöneticinize başvurmanız gerekir."}
        </p>
      ) : null}
    </>
  );
}
