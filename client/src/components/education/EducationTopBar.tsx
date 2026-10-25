import { Menu, PanelLeft } from "lucide-react";
import { AccountSwitchMenu } from "@/components/auth/AccountSwitchMenu";
import { isDemoMode } from "@/auth/runtime";
import { ChildSwitcher } from "./guardianChild/ChildSwitcher";
import { NotificationBell } from "./NotificationBell";
import { roleMeta } from "./roleMeta";
import type { Role, Section } from "./types";

/**
 * Kurum panelinin yapışkan üst çubuğu: menü düğmeleri, kurum/şube adı, zil,
 * çocuk seçici, hesap menüsü ve (yalnız demoda) rol değiştirici.
 * `EducationPlatform`'dan bölündü (2026-10-25, ana plan 5.3).
 */
export function EducationTopBar({
  role,
  displayName,
  organizationName,
  branchName,
  navCollapsed,
  onOpenMobileNav,
  onToggleNavCollapsed,
  onNavigate,
  canSwitchRole,
  onChangeRole,
}: {
  role: Role;
  displayName: string;
  organizationName?: string;
  branchName?: string | null;
  navCollapsed: boolean;
  onOpenMobileNav: () => void;
  onToggleNavCollapsed: () => void;
  onNavigate: (section: Section) => void;
  canSwitchRole: boolean;
  onChangeRole: (role: Role) => void;
}) {
  const meta = roleMeta[role];
  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-[#f6f8fc]/90 dark:bg-[#0b1120]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          aria-label="Menüyü aç"
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        {/*
        Masaüstünde menü daraltma. Mobildeki düğmeden ayrı: orada menü
        çekmece olarak açılıp kapanıyor, burada simge şeridine iniyor.
        Tek düğmeyle iki davranışı yönetmek, ekran genişliğini JS'te
        okumayı gerektirirdi.
      */}
        <button
          onClick={onToggleNavCollapsed}
          aria-label={navCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          aria-pressed={navCollapsed}
          title={navCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          className="hidden h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:grid"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[11px] font-semibold text-slate-500">
            {meta.description}
          </p>
          {/* Akademik dönem burada yazılıydı ve hiçbir yerden gelmiyordu:
            ne `organizations` tablosunda ne kimlikte böyle bir alan var.
            Her kuruma aynı dönemi söylüyordu. Kurum adı da artık
            korumalı; çözülemediğinde başlık boş kalır, yarım kalmış bir
            ayıraç bırakmaz. */}
          <p className="text-[10px] text-slate-400">
            {[branchName, organizationName].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {/* Zil (2026-10-12): v1.5-22'de sahte olduğu için kaldırılmıştı;
          artık gerçek bildirimleri sayıyor. Demoda yok. */}
        {!isDemoMode ? <NotificationBell onNavigate={onNavigate} /> : null}
        <div className="hidden sm:block">
          <ChildSwitcher />
        </div>
        <AccountSwitchMenu />
        {canSwitchRole ? (
          <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:flex">
            {(Object.keys(roleMeta) as Role[]).map(itemRole => (
              <button
                key={itemRole}
                onClick={() => onChangeRole(itemRole)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${role === itemRole ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              >
                {roleMeta[itemRole].short}
              </button>
            ))}
          </div>
        ) : null}
        {canSwitchRole ? (
          <button
            onClick={() => {
              const next =
                role === "parent"
                  ? "admin"
                  : (Object.keys(roleMeta) as Role[])[
                      (Object.keys(roleMeta) as Role[]).indexOf(role) + 1
                    ];
              onChangeRole(next);
            }}
            aria-label="Demo rolünü değiştir"
            className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-[11px] font-extrabold text-white sm:hidden"
          >
            {displayName
              ? displayName
                  .split(" ")
                  .filter(Boolean)
                  .map(word => word[0])
                  .join("")
              : "O"}
          </button>
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-[11px] font-extrabold text-white">
            {displayName
              ? displayName
                  .split(" ")
                  .filter(Boolean)
                  .map(word => word[0])
                  .join("")
              : "O"}
          </span>
        )}
      </div>
    </header>
  );
}
