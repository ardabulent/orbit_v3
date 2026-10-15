import type { ReactNode } from "react";
import { OrbitMark } from "@/components/OrbitMark";
import { PLATFORM_TABS, type PlatformTab } from "./tabs";

/**
 * Platform operatörü panelinin kabuğu.
 *
 * Dershane ekranlarından (`components/education/`) bilinçli olarak ayrı bir
 * ağaçta duruyor; iki panel farklı kitleye hizmet ediyor ve birbirinin
 * bileşenlerini paylaşmıyor. Bkz. `.ai/PROJECT_STATE.md` bölüm 9.
 */

export function PlatformShell({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-slate-100 sm:px-8 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1100px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 p-2">
              <OrbitMark
                inverted
                priority
                className="h-full w-full object-contain"
              />
            </span>
            <div>
              <p className="font-orbit text-[20px] font-extrabold tracking-[-.06em]">
                ORBIT
              </p>
              <p className="-mt-1 text-[9px] font-bold uppercase tracking-[.16em] text-sky-300">
                Platform
              </p>
            </div>
          </div>
          {header}
        </header>

        <div className="mt-8 flex-1">{children}</div>
      </div>
    </main>
  );
}

/** Tek kartlık, ortalanmış düzen. Yükleme ve yetkisizlik ekranları için. */
export function PlatformNotice({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <section className="w-full max-w-[640px] rounded-[28px] border border-white/10 bg-white/[.04] p-7 sm:p-10">
        <h1 className="font-display text-[26px] font-extrabold tracking-[-.05em] sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-3 text-[13px] leading-6 text-slate-400">
          {description}
        </p>

        {children ? <div className="mt-7">{children}</div> : null}

        {footer ? (
          <div className="mt-6 border-t border-white/10 pt-5 text-[11px] leading-5 text-slate-400">
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function PlatformTabs({
  active,
  onChange,
}: {
  active: PlatformTab;
  onChange: (tab: PlatformTab) => void;
}) {
  return (
    <nav
      aria-label="Platform bölümleri"
      // Telefonda dört sekme tek satıra sığmıyordu ve sayfayı 57 px
      // taşırıyordu (2026-10-15, ops/arayuz/tasma-denetimi.js): satır kendi
      // içinde kayar, sayfa kaymaz.
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-white/[.06] p-1"
    >
      {PLATFORM_TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? "page" : undefined}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-[12px] font-bold transition ${
            active === tab.id
              ? "bg-white text-slate-900"
              : "text-slate-300 hover:bg-white/10"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

/** Liste ekranlarının ortak başlığı. */
export function PlatformSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-[-.05em]">
            {title}
          </h1>
          <p className="mt-1 text-[12px] leading-5 text-slate-400">
            {description}
          </p>
        </div>
        {action}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Boş liste durumu. Kurum yokken tabloyu başlıklarıyla göstermek anlamsız. */
export function PlatformEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
      <p className="text-[14px] font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-[420px] text-[12px] leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}
