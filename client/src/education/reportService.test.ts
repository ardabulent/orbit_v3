import * as React from "react";
import { NETWORK_ERROR_TEXT } from "@/lib/userFacingError";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Vitest config runs in node without react plugin, so JSX compiled by esbuild expects React in global scope
(globalThis as unknown as { React: typeof React }).React = React;

import { supabase } from "@/lib/supabaseClient";
import { ReportCard } from "@/components/education/shared";
import { ReportsPage } from "@/components/education/pages/ReportsPage";
import {
  loadAttendanceWeeks,
  loadExamAverages,
  loadHomeworkWeeks,
} from "./reportService";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("Rapor ekranı ve servisleri (v1.4-16 · #278 / K-22, K-23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. K-23: 0 ile undefined ayrı çiziliyor", () => {
    it("ReportCard'a [0, 0, 0, 0] verildiğinde boş durum çıkmaz, 4 adet taban sıfır çizgisi çizilir", () => {
      const html = renderToStaticMarkup(
        createElement(ReportCard, {
          title: "Devam görünümü",
          subtitle: "Son 4 takvim haftası",
          values: [0, 0, 0, 0],
          labels: ["24 Ağu", "31 Ağu", "7 Eyl", "14 Eyl"],
          color: "bg-emerald-500",
        })
      );

      // Boş durum ÇIKMAMALI (ölçülmüş gerçek sıfır yokluk değildir, K-22)
      expect(html).not.toContain("Rapor verisi henüz yok");
      expect(html).not.toContain("Görüntülenecek analitik veri bulunmuyor.");

      // Dört adet sıfır taban çizgisi (report-bar-zero) bulunmalı
      const zeroBars = html.match(/data-testid="report-bar-zero"/g);
      expect(zeroBars).not.toBeNull();
      expect(zeroBars?.length).toBe(4);

      // Kesik çizgi veya normal bar bulunmamalı
      expect(html).not.toContain('data-testid="report-bar-unmeasured"');
      expect(html).not.toContain('data-testid="report-bar-measured"');
    });

    it("ReportCard'a [undefined, undefined, undefined, undefined] verildiğinde boş durum çıkar", () => {
      const html = renderToStaticMarkup(
        createElement(ReportCard, {
          title: "Devam görünümü",
          subtitle: "Son 4 takvim haftası",
          values: [undefined, undefined, undefined, undefined],
          labels: ["24 Ağu", "31 Ağu", "7 Eyl", "14 Eyl"],
          color: "bg-emerald-500",
        })
      );

      // Boş durum ÇIKMALI (tüm haftalar ölçülememiş)
      expect(html).toContain("Rapor verisi henüz yok");
      expect(html).toContain("Görüntülenecek analitik veri bulunmuyor.");

      // Hiçbir bar çizilmemeli
      expect(html).not.toContain('data-testid="report-bar-zero"');
      expect(html).not.toContain('data-testid="report-bar-unmeasured"');
      expect(html).not.toContain('data-testid="report-bar-measured"');
    });
  });

  describe("2. K-23: Karışık dizi [75, undefined, 0, 90]", () => {
    it("boş durum çıkmaz; iki bar, bir sıfır çizgisi ve bir kesik çizgi çizilir", () => {
      const html = renderToStaticMarkup(
        createElement(ReportCard, {
          title: "Devam görünümü",
          subtitle: "Son 4 takvim haftası",
          values: [75, undefined, 0, 90],
          labels: ["24 Ağu", "31 Ağu", "7 Eyl", "14 Eyl"],
          color: "bg-emerald-500",
        })
      );

      // Boş durum çıkmamalı
      expect(html).not.toContain("Rapor verisi henüz yok");

      // 2 ölçülmüş bar (75 ve 90)
      const measuredBars = html.match(/data-testid="report-bar-measured"/g);
      expect(measuredBars?.length).toBe(2);
      expect(html).toContain("height:75%");
      expect(html).toContain("height:90%");

      // 1 sıfır çizgisi (0)
      const zeroBars = html.match(/data-testid="report-bar-zero"/g);
      expect(zeroBars?.length).toBe(1);

      // 1 kesik çizgi (undefined)
      const unmeasuredBars = html.match(/data-testid="report-bar-unmeasured"/g);
      expect(unmeasuredBars?.length).toBe(1);
    });
  });

  describe("3. K-23: Servis satır dönmediğinde null döner ve kart boş durum gösterir", () => {
    it("loadAttendanceWeeks: veritabanı boş dizi döndüğünde null döner (sıfır uydurmaz)", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const result = await loadAttendanceWeeks();
      expect(result).toBeNull();
    });

    it("loadAttendanceWeeks: dört hafta da NULL sayılarla geldiğinde null döner", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            week_start: "2026-08-24",
            present_count: null,
            late_count: null,
            absent_count: null,
          },
          {
            week_start: "2026-08-31",
            present_count: null,
            late_count: null,
            absent_count: null,
          },
          {
            week_start: "2026-09-07",
            present_count: null,
            late_count: null,
            absent_count: null,
          },
          {
            week_start: "2026-09-14",
            present_count: null,
            late_count: null,
            absent_count: null,
          },
        ],
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const result = await loadAttendanceWeeks();
      expect(result).toBeNull();
    });

    it("loadExamAverages: satır dönmediğinde null döner", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const result = await loadExamAverages();
      expect(result).toBeNull();
    });

    it("loadHomeworkWeeks: satır dönmediğinde null döner", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const result = await loadHomeworkWeeks();
      expect(result).toBeNull();
    });

    it("servis null döndüğünde ReportsPage kartları boş durum (EmptyState) gösterir", () => {
      const html = renderToStaticMarkup(
        createElement(ReportsPage, {
          role: "admin",
          isDemo: false,
          attendanceWeeks: null,
          examAverages: null,
          homeworkWeeks: null,
        })
      );

      const emptyStates = html.match(/Rapor verisi henüz yok/g);
      expect(emptyStates?.length).toBe(3);
    });
  });

  describe("4. 🔴 R1-A · Sorgu uçarken ekran 'Rapor verisi henüz yok' demez", () => {
    it("isLoading iken kart 'Rapor verisi henüz yok' demez, iskelet çizer", () => {
      const html = renderToStaticMarkup(
        createElement(ReportsPage, {
          role: "admin",
          isDemo: false,
          isLoading: true,
          attendanceWeeks: undefined,
          examAverages: undefined,
          homeworkWeeks: undefined,
        })
      );

      // ⛔ Henüz cevap gelmedi; 'Rapor verisi henüz yok' iddiası YAZILAMAZ (R1-A / K-22)
      expect(html).not.toContain("Rapor verisi henüz yok");
      expect(html).not.toContain("Görüntülenecek analitik veri bulunmuyor.");

      // Kart iskeletleri (CardSkeleton) görünür olmalıdır
      expect(html).toContain('role="status"');
      expect(html).toContain("Yükleniyor…");
    });
  });

  describe("5. 🔴 R1-B · Hata durumunda kart boş durumdan farklı bir şey söyler ve yeniden deneme sunar", () => {
    it("ekran hata durumunda ErrorState çizer, sebebi söyler ve tekrar dene butonu sunar", () => {
      const onRetry = vi.fn();
      const html = renderToStaticMarkup(
        createElement(ReportsPage, {
          role: "admin",
          isDemo: false,
          isLoading: false,
          error: new Error("Rapor verileri yüklenirken bir ağ hatası oluştu."),
          onRetry,
        })
      );

      // ⛔ Hata durumu 'veri yok' diye yutulamaz
      expect(html).not.toContain("Rapor verisi henüz yok");

      // Hata durumu, sebebi ve 'Tekrar dene' butonu görünmelidir
      expect(html).toContain('role="alert"');
      expect(html).toContain("Raporlar görüntülenemedi");
      expect(html).toContain(
        "Rapor verileri yüklenirken bir ağ hatası oluştu."
      );
      expect(html).toContain("Tekrar dene");
    });

    it("loadAttendanceWeeks: RPC hatasında null dönmez, hata fırlatır", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: {
          code: "42501",
          message: "permission denied for function report_attendance_weeks",
        },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      await expect(loadAttendanceWeeks()).rejects.toThrow(
        "Bu raporu görüntüleme yetkiniz bulunmuyor."
      );
    });

    it("loadExamAverages: RPC hatasında null dönmez, hata fırlatır", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { code: "PGRST301", message: "connection timeout" },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      await expect(loadExamAverages()).rejects.toThrow(NETWORK_ERROR_TEXT);
    });

    it("loadHomeworkWeeks: RPC hatasında null dönmez, hata fırlatır", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { code: "ECONNREFUSED", message: "network unreachable" },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      await expect(loadHomeworkWeeks()).rejects.toThrow(NETWORK_ERROR_TEXT);
    });
  });

  describe("6. 🔴 R1-D · Demo modunda üç kart da değer çizer", () => {
    it("demo modunda hiçbir kart boş durum göstermez, üçü de ölçülmüş bar çizer", () => {
      const html = renderToStaticMarkup(
        createElement(ReportsPage, {
          role: "admin",
          isDemo: true,
        })
      );

      // Boş durum ÇIKMAMALIDIR
      expect(html).not.toContain("Rapor verisi henüz yok");

      // Üç kart da ölçülmüş bar çizmelidir (demoData'daki değerlerle)
      const measuredBars = html.match(/data-testid="report-bar-measured"/g);
      expect(measuredBars).not.toBeNull();
      // Devam (4) + Sınav (4) + Ödev (4) = 12 ölçülmüş bar
      expect(measuredBars?.length).toBe(12);

      // Demo aksiyonları bölümü de görünür olmalıdır
      expect(html).toContain("Raporu aksiyona dönüştür");
    });
  });

  describe("7. K-23: Devam yüzdesi calculateAttendancePercentage'tan gelir", () => {
    it("paydası sıfır olan hafta undefined döner, 0 değil", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            week_start: "2026-08-24",
            present_count: null,
            late_count: null,
            absent_count: null,
          },
          {
            week_start: "2026-08-31",
            present_count: 12,
            late_count: 1,
            absent_count: 2,
          },
          {
            week_start: "2026-09-07",
            present_count: 0,
            late_count: 0,
            absent_count: 5,
          },
          {
            week_start: "2026-09-14",
            present_count: null,
            late_count: null,
            absent_count: null,
          },
        ],
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const result = await loadAttendanceWeeks();
      expect(result).not.toBeNull();
      expect(result).toHaveLength(4);

      // 1. hafta: ölçülmedi -> undefined (0 değil!)
      expect(result![0].attendancePercent).toBeUndefined();

      // 2. hafta: (12 + 1) / (12 + 1 + 2) = 13/15 = %87
      expect(result![1].attendancePercent).toBe(87);

      // 3. hafta: (0 + 0) / (0 + 0 + 5) = 0/5 = %0 (gerçek sıfır!)
      expect(result![2].attendancePercent).toBe(0);

      // 4. hafta: ölçülmedi -> undefined
      expect(result![3].attendancePercent).toBeUndefined();
    });
  });

  describe("8. Küçük düzeltmeler ve veri bütünlüğü", () => {
    it("loadExamAverages: average_percent null veya NaN olan satır elenir (uydurma sıfır üretmez)", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            exam_id: "exam-1",
            exam_name: "1. Deneme",
            exam_date: "2026-09-01",
            average_percent: null, // okunamadı -> satır elenmeli, 0 konmamalı
            result_count: 5,
          },
          {
            exam_id: "exam-2",
            exam_name: "2. Deneme",
            exam_date: "2026-09-08",
            average_percent: 78,
            result_count: 10,
          },
        ],
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const result = await loadExamAverages();
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].examId).toBe("exam-2");
      expect(result![0].averagePercent).toBe(78);
    });

    it("loadHomeworkWeeks: ölçülmemiş haftada submissionCount ve expectedCount undefined kalır (0/0 teslim yazılmaz)", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            week_start: "2026-08-24",
            submission_count: 0,
            expected_count: 0, // beklenen 0 -> ölçülmemiş
          },
          {
            week_start: "2026-08-31",
            submission_count: 8,
            expected_count: 10,
          },
        ],
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const result = await loadHomeworkWeeks();
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);

      // 1. hafta: ölçülmemiş -> completionPercent, submissionCount ve expectedCount undefined
      expect(result![0].completionPercent).toBeUndefined();
      expect(result![0].submissionCount).toBeUndefined();
      expect(result![0].expectedCount).toBeUndefined();

      // 2. hafta: ölçülmüş -> %80, 8 teslim, 10 beklenen
      expect(result![1].completionPercent).toBe(80);
      expect(result![1].submissionCount).toBe(8);
      expect(result![1].expectedCount).toBe(10);
    });
  });

  describe("9. K-23: Öğretmen ve yönetici kart metinleri ayrımı", () => {
    it("öğretmen kartında 'TYT' ve 'Kurum ortalaması' geçmez; 'Sınıflarınızın ortalaması' geçer", () => {
      const teacherHtml = renderToStaticMarkup(
        createElement(ReportsPage, {
          role: "teacher",
          isDemo: false,
        })
      );

      // Öğretmen için deneme alt başlığı "Sınıflarınızın ortalaması" olmalıdır
      expect(teacherHtml).toContain("Sınıflarınızın ortalaması");

      // ⛔ Öğretmende "Kurum ortalaması" veya "kurum ortalamalarıyla" GEÇMEMELİDİR
      expect(teacherHtml).not.toContain("Kurum ortalaması");
      expect(teacherHtml).not.toContain("kurum ortalamalarıyla");

      // ⛔ Şemada sınav türü yoktur, hiçbir yerde "TYT" GEÇMEMELİDİR
      expect(teacherHtml).not.toContain("TYT");
    });

    it("yönetici kartında 'Kurum ortalaması' geçer ve 'TYT' geçmez", () => {
      const adminHtml = renderToStaticMarkup(
        createElement(ReportsPage, {
          role: "admin",
          isDemo: false,
        })
      );

      // Yönetici için deneme alt başlığı "Kurum ortalaması" olmalıdır
      expect(adminHtml).toContain("Kurum ortalaması");

      // ⛔ "TYT" GEÇMEMELİDİR
      expect(adminHtml).not.toContain("TYT");
    });
  });
});
