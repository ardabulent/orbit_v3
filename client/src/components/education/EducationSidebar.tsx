import { Link } from "wouter";
import { LogOut, ShieldCheck, X } from "lucide-react";
import { OrbitMark } from "@/components/OrbitMark";
import type { allNav } from "./navigation";
import { roleMeta } from "./roleMeta";
import type { Role, Section } from "./types";

// Başlık grubun İÇERİĞİNİ adlandırır. Tek bir koşul yetmiyor çünkü aynı grup
// her rolde farklı maddeler taşıyor; `role !== "admin"` fırçası öğretmende
// Raporlar'ı, velide Ödemeler'i "hesap ayarı" gibi göstermişti (#147).
//
// Açık eşleme bilinçli: bir rolün madde listesi değişirse başlığının da
// gözden geçirilmesi gerekir ve bu, buraya bakmayı zorunlu kılar.
const secondaryGroupTitle: Record<Role, string> = {
  admin: "Kurum yönetimi",
  teacher: "Raporlar ve Ayarlar",
  student: "Hesap ve Ayarlar",
  parent: "Ödemeler ve Ayarlar",
};

/**
 * Kurum panelinin kenar menüsü ve telefondaki örtüsü. `EducationPlatform`'dan
 * bölündü (2026-10-25, ana plan 5.3). Hangi maddelerin görüneceğine çağıran
 * karar verir (`navItems`); menü yalnız çizer.
 */
export function EducationSidebar({
  role,
  displayName,
  navItems,
  active,
  mobileNav,
  navCollapsed,
  onCloseMobileNav,
  onNavigate,
  canAccessPlatform,
  onLogout,
}: {
  role: Role;
  displayName: string;
  navItems: typeof allNav;
  active: Section;
  mobileNav: boolean;
  navCollapsed: boolean;
  onCloseMobileNav: () => void;
  onNavigate: (section: Section) => void;
  canAccessPlatform: boolean;
  onLogout: () => void | Promise<void>;
}) {
  const meta = roleMeta[role];
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-slate-200 bg-white px-3 py-4 transition-all lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"} ${navCollapsed ? "lg:w-[74px] lg:px-2" : "lg:w-[258px]"}`}
      >
        <div className="mb-7 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 p-1.5 shadow-[0_6px_14px_rgba(15,23,42,.12)] dark:bg-[#1e293b]">
              <OrbitMark inverted className="h-full w-full object-contain" />
            </span>
            <div className={navCollapsed ? "lg:hidden" : ""}>
              <p className="font-orbit text-[18px] font-extrabold tracking-[-.055em] text-slate-900">
                ORBIT
              </p>
              <p className="-mt-0.5 text-[9px] font-bold uppercase tracking-[.13em] text-slate-400">
                Education
              </p>
            </div>
          </div>
          <button
            onClick={() => onCloseMobileNav()}
            aria-label="Menüyü kapat"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className={`mb-5 rounded-xl border border-blue-100 bg-blue-50/65 px-3 py-3 ${navCollapsed ? "lg:hidden" : ""}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`grid h-8 w-8 place-items-center rounded-lg ${meta.color}`}
            >
              <meta.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold text-slate-800">
                {displayName}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                {meta.label}
              </p>
            </div>
          </div>
        </div>
        {/*
        `flex-1 overflow-y-auto` olmadan menü, ekran yüksekliğini aşınca
        kesiliyordu ve kaydırılamıyordu: `lg:h-screen` yüksekliği sabitliyor
        ama taşan içeriğe ne yapılacağını söylemiyor. Küçük dizüstü
        ekranlarda alttaki maddelere hiç ulaşılamıyordu.
      */}
        <nav className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
          {(["Ana çalışma alanı", "Kurum yönetimi"] as const).map(group => {
            const groupItems = navItems.filter(item => item.group === group);
            if (groupItems.length === 0) return null;

            const groupTitle =
              group === "Kurum yönetimi" ? secondaryGroupTitle[role] : group;

            return (
              <div
                key={group}
                className={
                  group === "Kurum yönetimi" ? "mt-6 space-y-1" : "space-y-1"
                }
              >
                <p
                  className={`mb-2 px-3 text-[9px] font-extrabold uppercase tracking-[.14em] text-slate-400 ${navCollapsed ? "lg:hidden" : ""}`}
                >
                  {groupTitle}
                </p>
                {groupItems.map(item => {
                  const Icon = item.icon;
                  const selected = active === item.label;
                  return (
                    <button
                      key={item.label}
                      onClick={() => onNavigate(item.label)}
                      // Şerit hâlindeyken etiket gizlendiği için erişilebilir
                      // ad ve fare üzerinde ipucu `title` ile korunuyor.
                      title={navCollapsed ? item.label : undefined}
                      className={`flex h-9 w-full items-center gap-3 rounded-lg text-left text-[12px] font-semibold transition ${navCollapsed ? "px-3 lg:justify-center lg:px-0" : "px-3"} ${selected ? "bg-slate-900 text-white shadow-[0_7px_14px_rgba(15,23,42,.10)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${selected ? "text-white" : "text-slate-400"}`}
                      />
                      <span
                        className={`flex-1 ${navCollapsed ? "lg:hidden" : ""}`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1 border-t border-slate-100 pt-4">
          {/*
          Platform paneline giden tek görünür yol. Bağlantı yokken operatör
          panele ancak adresi elle yazarak ulaşabiliyordu; kurucu ekip
          üyeleri hem kurum üyesi hem operatör olduğu için girişte doğrudan
          dershane paneline düşüyor ve panelin var olduğunu göremiyordu.
          Yalnızca gerçekten operatör olana gösterilir.
        */}
          {canAccessPlatform ? (
            <Link
              href="/platform"
              title={navCollapsed ? "Platform yönetimi" : undefined}
              className={`flex h-9 w-full items-center gap-3 rounded-lg text-[12px] font-semibold text-slate-600 transition hover:bg-slate-100 ${navCollapsed ? "px-3 lg:justify-center lg:px-0" : "px-3"}`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
              <span className={navCollapsed ? "lg:hidden" : ""}>
                Platform yönetimi
              </span>
            </Link>
          ) : null}
          <button
            onClick={onLogout}
            title={navCollapsed ? "Çıkış Yap" : undefined}
            className={`flex h-9 w-full items-center gap-3 rounded-lg text-[12px] font-semibold text-slate-600 transition hover:bg-slate-100 ${navCollapsed ? "px-3 lg:justify-center lg:px-0" : "px-3"}`}
          >
            <LogOut className="h-4 w-4 shrink-0 text-slate-400" />
            <span className={navCollapsed ? "lg:hidden" : ""}>Çıkış Yap</span>
          </button>
        </div>
      </aside>
      {mobileNav ? (
        <button
          aria-label="Menüyü kapat"
          onClick={() => onCloseMobileNav()}
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
        />
      ) : null}
    </>
  );
}
