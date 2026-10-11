import { lazy } from "react";

/**
 * Sekmeler ihtiyaç anında yüklenir (2026-10-11, tarama turu).
 *
 * Uygulama tek parça 1.365 KB'tı (sıkıştırılmış 359 KB); öğrencinin
 * telefonuna raporlar, ayarlar ve denetim ekranı da iniyordu. Her sekme
 * artık yalnız açıldığında ayrı bir parça olarak iner. Sekme içe aktarmaları
 * bu dosyada toplu durur ki hangi ekranın bölündüğü tek yerden görülsün.
 */
export const AssessmentsPage = lazy(() =>
  import("./pages/AssessmentsPage").then(m => ({ default: m.AssessmentsPage }))
);
export const AttendancePage = lazy(() =>
  import("./pages/AttendancePage").then(m => ({ default: m.AttendancePage }))
);
export const ClassesPage = lazy(() =>
  import("./pages/ClassesPage").then(m => ({ default: m.ClassesPage }))
);
export const CommunicationsPage = lazy(() =>
  import("./pages/CommunicationsPage").then(m => ({
    default: m.CommunicationsPage,
  }))
);
export const DayPlanPage = lazy(() =>
  import("./pages/DayPlanPage").then(m => ({ default: m.DayPlanPage }))
);
export const HomeworkPage = lazy(() =>
  import("./pages/HomeworkPage").then(m => ({ default: m.HomeworkPage }))
);
export const PaymentsPage = lazy(() =>
  import("./pages/PaymentsPage").then(m => ({ default: m.PaymentsPage }))
);
export const AuditLogPage = lazy(() =>
  import("./pages/AuditLogPage").then(m => ({ default: m.AuditLogPage }))
);
export const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then(m => ({ default: m.ReportsPage }))
);
export const SchedulePage = lazy(() =>
  import("./pages/SchedulePage").then(m => ({ default: m.SchedulePage }))
);
export const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage }))
);
export const StudentsPage = lazy(() =>
  import("./pages/StudentsPage").then(m => ({ default: m.StudentsPage }))
);
