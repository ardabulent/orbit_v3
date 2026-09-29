import { afterEach, describe, expect, it, vi } from "vitest";

let mockIsDemoMode = false;

vi.mock("@/auth/runtime", () => ({
  get isDemoMode() {
    return mockIsDemoMode;
  },
}));

async function loadEducationData(demoMode: boolean) {
  vi.resetModules();
  mockIsDemoMode = demoMode;
  return await import("./educationData");
}

afterEach(() => {
  vi.resetModules();
});

describe("educationData ortam dallanması", () => {
  describe("Production modu (isDemoMode === false)", () => {
    it("dizi ve nesne dışa aktarımlarını boş döndürür, sahte veri sızdırmaz", async () => {
      const data = await loadEducationData(false);

      expect(data.classes).toEqual([]);
      expect(data.schedule).toEqual([]);
      expect(data.students).toEqual([]);
      expect(data.paymentRows).toEqual([]);
      expect(data.initialHomework).toEqual([]);
      expect(data.initialAttendances).toEqual({});
    });

    it("gün planı nesnelerinde admin ve teacher anahtarlarını korur ve dizileri boş tutar", async () => {
      // Anahtarlar eksilirse dayPlanEventsByRole[role] undefined döner ve UI
      // boş durum yerine çalışma anında çöker. Bu yüzden anahtar varlığı ile
      // dizilerin boşluğu ayrı ayrı doğrulanır.
      const data = await loadEducationData(false);

      expect(data.dayPlanEventsByRole).toHaveProperty("admin");
      expect(data.dayPlanEventsByRole).toHaveProperty("teacher");
      expect(Array.isArray(data.dayPlanEventsByRole.admin)).toBe(true);
      expect(Array.isArray(data.dayPlanEventsByRole.teacher)).toBe(true);
      expect(data.dayPlanEventsByRole.admin).toHaveLength(0);
      expect(data.dayPlanEventsByRole.teacher).toHaveLength(0);

      expect(data.dayPlanTasksByRole).toHaveProperty("admin");
      expect(data.dayPlanTasksByRole).toHaveProperty("teacher");
      expect(Array.isArray(data.dayPlanTasksByRole.admin)).toBe(true);
      expect(Array.isArray(data.dayPlanTasksByRole.teacher)).toBe(true);
      expect(data.dayPlanTasksByRole.admin).toHaveLength(0);
      expect(data.dayPlanTasksByRole.teacher).toHaveLength(0);
    });

    it("tüm panellerde ve sayfalarda kart kabuklarını korur ve yalnızca güvenli boşluk değerleri döndürür", async () => {
      // Revizyon #116: Kart kabukları tasarım bütünlüğü için ekranda kalmalı,
      // ancak içeriklerine hiçbir uydurma değer (54, %93, 84 vb.) sızmamalıdır.
      // Yalnızca sayım/toplam için '0' veya '₺0', oran/ortalama/tarih için '—'
      // ve oranlı sayım için '0/0' güvenli kabul edilir.
      const data = await loadEducationData(false);
      const allowedEmptyValues = new Set(["0", "—", "₺0", "0/0"]);

      const allStatGroups = [
        data.adminOverviewStats,
        data.teacherOverviewStats,
        data.studentOverviewStats,
        data.parentOverviewStats,
        data.paymentOverviewStats,
      ];

      expect(data.adminOverviewStats).toHaveLength(4); // "Çalışan otomasyon" kartı kaldırıldı (v1.5-10)
      expect(data.teacherOverviewStats).toHaveLength(4);
      expect(data.studentOverviewStats).toHaveLength(4);
      expect(data.parentOverviewStats).toHaveLength(4);
      expect(data.paymentOverviewStats).toHaveLength(3);

      for (const group of allStatGroups) {
        for (const stat of group) {
          expect(
            allowedEmptyValues.has(stat.value),
            `Üretimde uydurma kart değeri tespit edildi: "${stat.label}" = "${stat.value}"`
          ).toBe(true);
        }
      }
    });

    it("takip, sınav ve rapor aksiyon içeriklerini boş döndürür", async () => {
      const data = await loadEducationData(false);

      expect(data.adminFollowUpNote).toBeNull();

      expect(data.teacherFollowUpItems).toEqual([]);

      expect(data.studentActionSteps).toEqual([]);
      expect(data.studentWeeklyNote).toBeNull();

      expect(data.parentCommunicationItems).toEqual([]);
      expect(data.parentProgressSummary).toBeNull();

      expect(data.attendanceLessonInfo).toBeNull();

      expect(data.assessmentHeaderInfo).toBeNull();
      expect(data.assessmentSubjects).toEqual([]);
      expect(data.assessmentFollowUp).toBeNull();

      expect(data.communicationsList).toEqual([]);
      expect(data.activeConversation).toBeNull();
    });

    it("kart alt satırları sayısız geçmiş zaman kullanmaz", async () => {
      // Değer 0 veya — olsa bile alt satır geçmiş zamanda konuşursa kart yine
      // yalan söyleyebilir: "0 · İletişim önerisi oluşturuldu", oluşmamış bir
      // öneriyi olmuş gibi bildirir.
      //
      // Geçmiş zamanın kendisi yasak değil: "0 yoklama tamamlandı" sayıyı açıkça
      // verdiği için doğru bir cümledir. Ayrım, iddianın bir miktara bağlanıp
      // bağlanmadığıdır.
      const data = await loadEducationData(false);
      const gecmisZaman = [
        "oluşturuldu",
        "önerildi",
        "tamamlandı",
        "gönderildi",
      ];

      const kartlar = [
        ...data.adminOverviewStats,
        ...data.teacherOverviewStats,
        ...data.studentOverviewStats,
        ...data.parentOverviewStats,
        ...data.paymentOverviewStats,
      ];

      for (const kart of kartlar) {
        const detay = kart.detail?.toLocaleLowerCase("tr") ?? "";
        const iddiaVar = gecmisZaman.some(kelime => detay.includes(kelime));
        const miktaraBagli = detay.includes("0") || detay.includes("yok");

        expect(
          iddiaVar && !miktaraBagli,
          `"${kart.label}" alt satırı miktar vermeden olmuş bir olay bildiriyor: "${kart.detail}"`
        ).toBe(false);
      }
    });

    it("yönetici üst başlığında uydurulmuş şube adı taşımaz", async () => {
      const data = await loadEducationData(false);

      expect(data.adminOverviewHeader.subtitle).not.toContain("Çorlu");
      expect(data.adminOverviewHeader.subtitle.length).toBeGreaterThan(0);
    });
  });

  describe("Demo modu (isDemoMode === true)", () => {
    it("tüm dışa aktarımların dolu olduğunu garanti eder", async () => {
      const data = await loadEducationData(true);

      expect(data.classes.length).toBeGreaterThan(0);
      expect(data.schedule.length).toBeGreaterThan(0);
      expect(data.students.length).toBeGreaterThan(0);
      expect(data.paymentRows.length).toBeGreaterThan(0);
      expect(data.initialHomework.length).toBeGreaterThan(0);
      expect(Object.keys(data.initialAttendances).length).toBeGreaterThan(0);

      expect(data.dayPlanEventsByRole).toHaveProperty("admin");
      expect(data.dayPlanEventsByRole).toHaveProperty("teacher");
      expect(data.dayPlanEventsByRole.admin.length).toBeGreaterThan(0);
      expect(data.dayPlanEventsByRole.teacher.length).toBeGreaterThan(0);

      expect(data.dayPlanTasksByRole).toHaveProperty("admin");
      expect(data.dayPlanTasksByRole).toHaveProperty("teacher");
      expect(data.dayPlanTasksByRole.admin.length).toBeGreaterThan(0);
      expect(data.dayPlanTasksByRole.teacher.length).toBeGreaterThan(0);
    });

    it("panel ve sayfa içerikleri sunum için dolu kalır", async () => {
      const data = await loadEducationData(true);

      expect(data.adminOverviewStats.length).toBeGreaterThan(0);
      expect(data.adminFollowUpNote).not.toBeNull();

      expect(data.teacherOverviewStats.length).toBeGreaterThan(0);
      expect(data.teacherFollowUpItems.length).toBeGreaterThan(0);

      expect(data.studentOverviewStats.length).toBeGreaterThan(0);
      expect(data.studentActionSteps.length).toBeGreaterThan(0);
      expect(data.studentWeeklyNote).not.toBeNull();

      expect(data.parentOverviewStats.length).toBeGreaterThan(0);
      expect(data.parentCommunicationItems.length).toBeGreaterThan(0);
      expect(data.parentProgressSummary).not.toBeNull();

      expect(data.attendanceLessonInfo).not.toBeNull();

      expect(data.paymentOverviewStats.length).toBeGreaterThan(0);
      expect(data.assessmentHeaderInfo).not.toBeNull();
      expect(data.assessmentSubjects.length).toBeGreaterThan(0);
      expect(data.assessmentFollowUp).not.toBeNull();

      expect(data.communicationsList.length).toBeGreaterThan(0);
      expect(data.activeConversation).not.toBeNull();
      expect(data.schedule.every(item => Boolean(item.day))).toBe(true);
    });
  });
});
