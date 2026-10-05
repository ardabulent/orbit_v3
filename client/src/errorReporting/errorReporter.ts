import { scrubErrorText, scrubPath } from "./scrubErrorText";
import type { ErrorReportInput, ErrorReportKind } from "./errorReportService";

/** Bir sayfa açılışında en fazla bu kadar kayıt gönderilir. */
export const SESSION_REPORT_CAP = 20;

/** Aynı mesaj bu süre içinde ikinci kez gönderilmez. */
export const REPEAT_WINDOW_MS = 10 * 60 * 1000;

type ReporterDeps = {
  send: (input: ErrorReportInput) => Promise<void>;
  now: () => number;
  path: () => string;
  appVersion: string;
  userAgent: string;
};

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || "Hata",
      stack: error.stack ?? null,
    };
  }
  if (typeof error === "string") return { message: error, stack: null };
  return { message: "Tanımsız hata", stack: null };
}

/**
 * Hata kaydedici (2026-10-05, v1.5-06).
 *
 * Döngüdeki bir hata saniyede yüzlerce kez tetiklenebilir; sunucu kişi başına
 * saatte 30 ile sınırlıyor ama tarayıcı da boşa istek atmamalı. Bu yüzden
 * aynı mesaj 10 dakikada bir, açılış başına toplam 20 kayıt.
 */
export function createErrorReporter(deps: ReporterDeps) {
  const lastSent = new Map<string, number>();
  let sent = 0;

  return function report(kind: ErrorReportKind, error: unknown): void {
    if (sent >= SESSION_REPORT_CAP) return;

    const raw = describe(error);
    const message = scrubErrorText(raw.message, 500);
    if (!message.trim()) return;

    const key = `${kind}:${message}`;
    const at = deps.now();
    const previous = lastSent.get(key);
    if (previous !== undefined && at - previous < REPEAT_WINDOW_MS) return;

    lastSent.set(key, at);
    sent += 1;

    void deps.send({
      kind,
      message,
      stack: raw.stack ? scrubErrorText(raw.stack, 4000) : null,
      path: scrubPath(deps.path()),
      appVersion: deps.appVersion,
      userAgent: deps.userAgent.slice(0, 200),
    });
  };
}
