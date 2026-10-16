import { useEffect, useSyncExternalStore } from "react";

/**
 * Açık / koyu tema (2026-10-15, #135, analiz turu).
 *
 * **Tercih** kişinin seçimidir (açık, koyu, sistem) ve bu tarayıcıda saklanır;
 * hesaba yazılmaz — aynı kişi okulda açık, evde koyu kullanabilir. Saklama
 * okunamazsa (gizli pencere, engellenmiş site verisi) açık tema geçerlidir.
 *
 * **Uygulanan tema** yalnız kurum paneli açıkken koyu olabilir: giriş ekranı
 * ve operatör paneli kendi koyu/açık tasarımıyla çizildi; renk paleti onlarda
 * ters çevrilirse bozulurlar. Kurum paneli `useApplyOrbitTheme(true)` çağırır,
 * ayrılınca sınıf kalkar.
 *
 * Koyu palet `koyu-tema.css`'te: Tailwind renk değişkenleri `html.dark`
 * altında yeniden tanımlanır, bileşenlerdeki sınıflar değişmez.
 */

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "orbit-tema";
const preferenceListeners = new Set<() => void>();
const appliedListeners = new Set<() => void>();
/** Saklama yazılamadığında bu oturumun tercihi. */
let memoryPreference: ThemePreference | null = null;

export function readThemePreference(): ThemePreference {
  // Saklama alanı olmayan ortam (sunucu tarafı çizim, testler): açık tema.
  if (typeof window === "undefined" || !window.localStorage) return "light";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch (error) {
    console.warn("[tema] tercih okunamadı, açık tema", String(error));
    return "light";
  }
}

export function writeThemePreference(value: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    // Kaydedilemese de bu oturumda uygulanır (dinleyiciler aşağıda).
    console.warn("[tema] tercih kaydedilemedi", String(error));
    memoryPreference = value;
  }
  preferenceListeners.forEach(listener => listener());
}

function currentPreference(): ThemePreference {
  return memoryPreference ?? readThemePreference();
}

function subscribePreference(listener: () => void) {
  preferenceListeners.add(listener);
  if (typeof window === "undefined" || !window.addEventListener) {
    return () => {
      preferenceListeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribePreference,
    currentPreference,
    () => "light"
  );
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

function subscribeSystem(listener: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return () => {};
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function isDarkApplied(): boolean {
  return (
    typeof document !== "undefined" &&
    Boolean(document.documentElement?.classList?.contains("dark"))
  );
}

function subscribeApplied(listener: () => void) {
  appliedListeners.add(listener);
  return () => {
    appliedListeners.delete(listener);
  };
}

function setDarkApplied(dark: boolean) {
  const root =
    typeof document !== "undefined" ? document.documentElement : undefined;
  if (!root?.classList || root.classList.contains("dark") === dark) return;
  root.classList.toggle("dark", dark);
  appliedListeners.forEach(listener => listener());
}

/** O an uygulanan tema (bildirim kutucukları gibi portal bileşenleri için). */
export function useAppliedTheme(): "light" | "dark" {
  const dark = useSyncExternalStore(
    subscribeApplied,
    isDarkApplied,
    () => false
  );
  return dark ? "dark" : "light";
}

/** Tercihi uygular; `enabled` yanlışsa (ya da bileşen ayrılınca) açık tema. */
export function useApplyOrbitTheme(enabled: boolean): void {
  const preference = useThemePreference();
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    systemPrefersDark,
    () => false
  );
  const dark =
    enabled &&
    (preference === "dark" || (preference === "system" && systemDark));

  useEffect(() => {
    setDarkApplied(dark);
  }, [dark]);

  useEffect(() => () => setDarkApplied(false), []);
}
