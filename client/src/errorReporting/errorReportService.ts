import { supabase } from "@/lib/supabaseClient";

export type ErrorReportKind = "error" | "unhandledrejection" | "render";

export type ErrorReportInput = {
  kind: ErrorReportKind;
  message: string;
  stack: string | null;
  path: string;
  appVersion: string;
  userAgent: string;
};

/**
 * Hatayı sunucuya yazar. Oturum yoksa sunucu kaydı sessizce düşürür.
 *
 * Kendi hatasını fırlatmaz, yalnız konsola yazar: raporlama yolu bozulursa
 * uygulamayı bozmamalı ve kendi hatasını raporlamaya çalışıp döngüye
 * girmemeli.
 */
export async function sendErrorReport(input: ErrorReportInput): Promise<void> {
  const { error } = await supabase.rpc("report_client_error", {
    report_kind: input.kind,
    report_message: input.message,
    report_stack: input.stack,
    report_path: input.path,
    report_app_version: input.appVersion,
    report_user_agent: input.userAgent,
  });
  if (error) {
    console.warn("[hata-kaydı] Hata sunucuya yazılamadı:", error.code);
  }
}

export type ClientErrorReport = {
  id: string;
  createdAt: string;
  kind: ErrorReportKind;
  message: string;
  stack: string | null;
  path: string | null;
  appVersion: string | null;
  userAgent: string | null;
  organizationName: string | null;
};

export type ClientErrorReportPage = {
  rows: ClientErrorReport[];
  nextCursor: string | null;
};

/** Platform operatörü için hata kayıtları, yeniden eskiye. */
export async function loadClientErrorReports(
  pageSize: number,
  before: string | null
): Promise<ClientErrorReportPage> {
  const { data, error } = await supabase.rpc("list_client_error_reports", {
    before_created_at: before,
    page_size: pageSize,
  });
  if (error) {
    throw new Error("Hata kayıtları yüklenemedi.", { cause: error });
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    createdAt: String(row.created_at),
    kind: row.kind as ErrorReportKind,
    message: String(row.message ?? ""),
    stack: (row.stack as string | null) ?? null,
    path: (row.path as string | null) ?? null,
    appVersion: (row.app_version as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
    organizationName: (row.organization_name as string | null) ?? null,
  }));
  return {
    rows,
    nextCursor:
      rows.length === pageSize
        ? (rows[rows.length - 1]?.createdAt ?? null)
        : null,
  };
}
