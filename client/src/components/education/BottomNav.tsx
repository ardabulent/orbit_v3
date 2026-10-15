import { Menu } from "lucide-react";
import { allNav } from "./navigation";
import { bottomNavSections } from "./bottomNavSections";
import type { Role, Section } from "./types";

/**
 * Öğrenci ve velinin telefondaki alt gezinme çubuğu (2026-10-15, analiz
 * turu). "Öğrenci ve veli ekranları mobil-öncelikli tasarlanır" kararına
 * rağmen menü sol üstteki düğmeyle açılıyordu. En sık dört ekran altta,
 * kalanlar (Ayarlar, ödemeler) "Menü" ile kenar menüsünden. Geniş ekranda
 * (lg) görünmez; kenar çubuğu orada zaten açık.
 */
export function BottomNav({
  role,
  active,
  available,
  onNavigate,
  onOpenMenu,
}: {
  role: Role;
  active: Section;
  available: Section[];
  onNavigate: (section: Section) => void;
  onOpenMenu: () => void;
}) {
  const items = bottomNavSections(role)
    .filter(item => available.includes(item.section))
    .map(item => ({
      ...item,
      icon: allNav.find(nav => nav.label === item.section)?.icon ?? Menu,
    }));
  if (items.length === 0) return null;
  const inMenu = !items.some(item => item.section === active);

  return (
    <nav
      aria-label="Alt gezinme"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-md">
        {items.map(item => {
          const Icon = item.icon;
          const selected = item.section === active;
          return (
            <button
              key={item.section}
              type="button"
              onClick={() => onNavigate(item.section)}
              aria-current={selected ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[10px] font-bold transition ${
                selected ? "text-blue-700" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-current={inMenu ? "page" : undefined}
          className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[10px] font-bold transition ${
            inMenu ? "text-blue-700" : "text-slate-500"
          }`}
        >
          <Menu className="h-5 w-5" aria-hidden />
          <span>Menü</span>
        </button>
      </div>
    </nav>
  );
}
