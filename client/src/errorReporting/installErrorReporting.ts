import { isDemoMode } from "@/auth/runtime";
import { supabaseConfigured } from "@/lib/supabaseClient";
import { createErrorReporter } from "./errorReporter";
import { sendErrorReport, type ErrorReportKind } from "./errorReportService";

const appVersion =
  typeof __ORBIT_APP_VERSION__ === "string" ? __ORBIT_APP_VERSION__ : "yerel";

/**
 * Uygulama genelindeki tek kaydedici. Demo modunda ve Supabase
 * yapılandırılmamışken hiçbir şey göndermez.
 */
const report =
  isDemoMode || !supabaseConfigured
    ? null
    : createErrorReporter({
        send: sendErrorReport,
        now: () => Date.now(),
        path: () => window.location.pathname,
        appVersion,
        userAgent: navigator.userAgent,
      });

/** ErrorBoundary'nin yakaladığı çizim hataları için. */
export function reportError(kind: ErrorReportKind, error: unknown): void {
  report?.(kind, error);
}

/**
 * Yakalanmamış hataları ve reddedilmiş sözleri dinler. Uygulama açılışında
 * bir kez çağrılır. Oturum açılmadan oluşan hatalar sunucuda düşer —
 * anonim yazma bilinçli olarak kapalı.
 */
export function installErrorReporting(): void {
  if (!report) return;
  window.addEventListener("error", event => {
    report("error", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", event => {
    report("unhandledrejection", event.reason);
  });
}
