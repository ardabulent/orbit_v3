import { useState } from "react";
import { PageHeader } from "../shared";
import type { Role } from "../types";
import { SettingsAccessMatrix } from "./SettingsAccessMatrix";
import { SettingsArchiveSection } from "./SettingsArchiveSection";
import { SettingsCategoryList } from "./SettingsCategoryList";
import { SettingsDataImportSection } from "./SettingsDataImportSection";
import { SettingsDataManagementSection } from "./SettingsDataManagementSection";
import { SettingsInstitutionSection } from "./SettingsInstitutionSection";
import { SettingsMembersSection } from "./SettingsMembersSection";
import { SettingsNotificationsSection } from "./SettingsNotificationsSection";
import { SettingsProfileSection } from "./SettingsProfileSection";
import { SettingsSecuritySection } from "./SettingsSecuritySection";
import { SettingsSystemSection } from "./SettingsSystemSection";
import { SettingsThemeSection } from "./SettingsThemeSection";
import {
  SETTINGS_CATEGORIES,
  type SettingsCategoryId,
} from "./settingsCategories";

export function SettingsPage({
  role,
  onResetDemoData,
}: {
  role: Role;
  onResetDemoData: () => void;
}) {
  const [selected, setSelected] = useState<SettingsCategoryId>("profil");

  // Kategoriler role göre filtrelenir; yönetimsel kategoriler yalnızca yöneticide görünür.
  //
  // Bu kontrol bir güvenlik sınırı DEĞİLDİR: istemci kodunu yok sayan biri
  // API veya servisi doğrudan çağırabilir. Gerçek yetki sınırı veritabanındaki
  // `profiles_select_organization_admin` ve `memberships_select_self_or_admin`
  // RLS politikalarıdır; buradaki kontrol yalnızca kullanıcı deneyimi içindir.
  const categories = SETTINGS_CATEGORIES.filter(item =>
    item.roles.includes(role)
  );
  const category =
    categories.find(item => item.id === selected) ?? categories[0];

  const renderSection = () => {
    switch (category.id) {
      case "profil":
        return <SettingsProfileSection role={role} />;
      case "kurum":
        return <SettingsInstitutionSection />;
      case "uyeler":
        return <SettingsMembersSection />;
      case "bildirimler":
        return <SettingsNotificationsSection />;
      case "roller":
        return <SettingsAccessMatrix />;
      case "sistem":
        return <SettingsSystemSection />;
      case "guvenlik":
        return <SettingsSecuritySection />;
      case "tema":
        return <SettingsThemeSection />;
      case "arsiv":
        return <SettingsArchiveSection />;
      case "veri-yonetimi":
        return (
          <SettingsDataManagementSection onResetDemoData={onResetDemoData} />
        );
      case "veri-ice-aktarma":
        return <SettingsDataImportSection />;
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={role === "admin" ? "Kurum ayarları" : "Hesap ayarları"}
        title="Ayarlar"
        description={
          role === "admin"
            ? "Sistem ve hesap ayarlarınızı kategori bazlı yönetin."
            : "Kişisel ayarlarınızı kategori bazlı yönetin."
        }
      />
      <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SettingsCategoryList
          categories={categories}
          selectedId={selected}
          onSelect={setSelected}
        />
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,.025)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-blue-600">
            {category.eyebrow}
          </p>
          <div className="mt-3">{renderSection()}</div>
        </section>
      </div>
    </>
  );
}
