/**
 * Eğitim alanının React Query hook'ları ve sorgu anahtarları.
 *
 * 2026-10-25 (ana plan 5.3) konularına göre `queries/` altına bölündü; bu
 * dosya yalnız toplar, böylece içe aktaran 65 dosya ve testlerin `vi.mock`
 * yolları değişmedi. Yeni hook ilgili konu dosyasına yazılır, buraya değil.
 */
export * from "./queries/educationKeys";
export * from "./queries/rosterQueries";
export * from "./queries/scheduleQueries";
export * from "./queries/examQueries";
export * from "./queries/paymentQueries";
export * from "./queries/homeworkQueries";
export * from "./queries/attendanceQueries";
export * from "./queries/feedQueries";
export * from "./queries/reportQueries";
export * from "./queries/overviewQueries";
