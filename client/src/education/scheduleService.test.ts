import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveScheduleEntry,
  calculateDuration,
  createScheduleEntry,
  SCHEDULE_TOTAL_CAP,
  extractClassName,
  extractSubjectName,
  formatTime,
  loadSchedule,
  loadStaffNames,
  mapScheduleRow,
  resolveLessonTitle,
  translateScheduleError,
  updateScheduleEntry,
  type RawScheduleRow,
} from "./scheduleService";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args: unknown) => rpcMock(fn, args),
  },
}));

type QueryResult = { data: unknown; error: unknown };

function createScheduleQueryChain(
  result: QueryResult,
  spy?: {
    isArgs?: [string, unknown];
    orderCalls?: [string, { ascending?: boolean }][];
    limitArg?: number;
    rangeCalls?: [number, number][];
    eqCalls?: [string, unknown][];
  }
) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (spy) {
      spy.eqCalls = spy.eqCalls || [];
      spy.eqCalls.push([col, val]);
    }
    return chain;
  });
  chain.is = vi.fn((col: string, val: unknown) => {
    if (spy) spy.isArgs = [col, val];
    return chain;
  });
  chain.order = vi.fn((col: string, opts: { ascending?: boolean }) => {
    if (spy) {
      spy.orderCalls = spy.orderCalls || [];
      spy.orderCalls.push([col, opts]);
    }
    return chain;
  });
  // Sayfalı okuma (2026-10-03): `range(from, to)` verinin o dilimini döner;
  // `limitArg` istenen toplam satırın üst ucunu tutar (to + 1).
  chain.range = vi.fn((from: number, to: number) => {
    if (spy) {
      spy.rangeCalls = spy.rangeCalls || [];
      spy.rangeCalls.push([from, to]);
      spy.limitArg = to + 1;
    }
    if (result.error) return Promise.resolve(result);
    const rows = (result.data as unknown[] | null) ?? [];
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  });
  return chain;
}

describe("scheduleService", () => {
  describe("extractClassName", () => {
    it("nesne olarak gelen sınıf adını ayıklar", () => {
      expect(extractClassName({ name: "12-A Sayısal" })).toBe("12-A Sayısal");
    });

    it("dizi olarak gelen sınıf adını ayıklar", () => {
      expect(extractClassName([{ name: "11-B Eşit Ağırlık" }])).toBe(
        "11-B Eşit Ağırlık"
      );
    });

    it("sınıf arşivlenmişse null döner", () => {
      expect(
        extractClassName({
          name: "Eski Sınıf",
          archived_at: "2026-05-01T00:00:00Z",
        })
      ).toBeNull();
    });

    it("sınıf yoksa null döner", () => {
      expect(extractClassName(null)).toBeNull();
      expect(extractClassName([])).toBeNull();
    });
  });

  describe("extractSubjectName", () => {
    it("nesne olarak gelen ders adını ayıklar", () => {
      expect(extractSubjectName({ name: "Matematik" })).toBe("Matematik");
    });

    it("dizi olarak gelen ders adını ayıklar", () => {
      expect(extractSubjectName([{ name: "Fizik" }])).toBe("Fizik");
    });

    it("ders arşivlenmişse null döner", () => {
      expect(
        extractSubjectName({
          name: "Eski Ders",
          archived_at: "2026-05-01T00:00:00Z",
        })
      ).toBeNull();
    });

    it("ders bilgisi yoksa null döner", () => {
      expect(extractSubjectName(null)).toBeNull();
      expect(extractSubjectName([])).toBeNull();
    });
  });

  describe("resolveLessonTitle (İki Kaynak & Öncelik Kuralı, K-06)", () => {
    it("subject_id doluysa ad dersten okunur (title dolu olsa bile ders tercih edilir)", () => {
      const title = resolveLessonTitle(
        "subj-1",
        { name: "Geometri", archived_at: null },
        "Serbest Etüt"
      );
      expect(title).toBe("Geometri");
    });

    it("subject_id boşsa ad title sütunundan gelir", () => {
      const title = resolveLessonTitle(null, null, "Rehberlik Saati");
      expect(title).toBe("Rehberlik Saati");
    });

    // Migration kuralı istisnasız: "dolu olan `subject_id` ise ad dersten
    // okunur". Arşivlenmek adı silmez, bu yüzden `title` dolu olsa bile ders
    // adı kazanır — ad iki yerde tutulmaz (K-06).
    it("subject_id doluysa ders arşivlenmiş olsa ve title dolu olsa bile ad dersten okunur", () => {
      const title = resolveLessonTitle(
        "subj-1",
        { name: "Eski Ders", archived_at: "2026-05-01T00:00:00Z" },
        "Yedek Etüt"
      );
      expect(title).toBe("Eski Ders");
    });

    // ⛔ Şema `subject_id is not null or title is not null` diyor: `subject_id`
    // dolu bir satırda `title` BOŞ olabilir. Ders o arada arşivlenmişse ad
    // hiçbir yerden çözülemez ve ekranda ADSIZ bir ders satırı çizilirdi.
    // Arşivlenmek adı silmez.
    it("subject_id var, ders arşivlenmiş ve title boşsa yine de dersin adını döner (adsız satır çizilmez)", () => {
      const title = resolveLessonTitle(
        "subj-1",
        { name: "Geometri", archived_at: "2026-05-01T00:00:00Z" },
        null
      );
      expect(title).toBe("Geometri");
    });
  });

  describe("formatTime", () => {
    it("zaman dizesini HH:MM biçiminde keser", () => {
      expect(formatTime("09:00:00")).toBe("09:00");
      expect(formatTime("14:30")).toBe("14:30");
      expect(formatTime("")).toBe("");
    });
  });

  describe("calculateDuration (Süre Hesabı & K-22)", () => {
    it("başlangıç ve bitiş arasındaki süreyi dakika olarak hesaplar", () => {
      expect(calculateDuration("09:00:00", "09:50:00")).toBe("50 dk");
      expect(calculateDuration("10:00", "11:15")).toBe("75 dk");
      expect(calculateDuration("13:30:00", "14:10:00")).toBe("40 dk");
    });

    it("ends_at boşken kesinlikle süre üretilmez (null döner, K-22)", () => {
      expect(calculateDuration("09:00:00", null)).toBeNull();
      expect(calculateDuration("09:00:00", undefined)).toBeNull();
      expect(calculateDuration("09:00:00", "")).toBeNull();
    });

    it("geçersiz veya mantıksız zamanlarda null döner", () => {
      expect(calculateDuration("10:00:00", "09:00:00")).toBeNull();
      expect(calculateDuration("geçersiz", "10:00:00")).toBeNull();
    });
  });

  describe("loadStaffNames (class_staff_names RPC & #228/#231)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("boş sınıf listesinde veritabanına gitmeden boş harita döner", async () => {
      const result = await loadStaffNames([]);
      expect(result.size).toBe(0);
      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("class_staff_names RPC'sini çağırır ve membership_id -> display_name eşlemesi kurar", async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            class_id: "cls-1",
            membership_id: "mem-1",
            display_name: "Ayşe Kaya",
          },
          {
            class_id: "cls-1",
            membership_id: "mem-2",
            display_name: "Mehmet Demir (Vekil)",
          },
        ],
        error: null,
      });

      const map = await loadStaffNames(["cls-1"]);

      expect(rpcMock).toHaveBeenCalledWith("class_staff_names", {
        target_class_ids: ["cls-1"],
      });
      expect(map.get("mem-1")).toBe("Ayşe Kaya");
      expect(map.get("mem-2")).toBe("Mehmet Demir (Vekil)");
    });

    it("⛔ profiles veya organization_memberships tablolarına doğrudan sorgu gitmez (#228)", async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            class_id: "cls-1",
            membership_id: "mem-1",
            display_name: "Ayşe Kaya",
          },
        ],
        error: null,
      });

      await loadStaffNames(["cls-1"]);

      expect(fromMock).not.toHaveBeenCalledWith("profiles");
      expect(fromMock).not.toHaveBeenCalledWith("organization_memberships");
    });

    it("RPC hatasında boş harita döner", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "timeout" } });
      const map = await loadStaffNames(["cls-1"]);
      expect(map.size).toBe(0);
    });
  });

  describe("mapScheduleRow (Tip Dürüstlüğü, K-22 ve Hafta Sonu Gate)", () => {
    const staffNames = new Map([["mem-1", "Ayşe Kaya"]]);

    it("ISO gün numarasını Türkçe gün etiketine doğru eşler (Hafta Sonu: 6=Cumartesi, 7=Pazar)", () => {
      const rawSaturday: RawScheduleRow = {
        id: "sch-sat",
        day_of_week: 6, // ISO 6 = Cumartesi
        starts_at: "10:00:00",
        ends_at: "10:50:00",
        title: "TYT Deneme Sınavı",
        room: "Salon A",
        class_id: "cls-1",
        subject_id: null,
        membership_id: "mem-1",
        classes: { name: "12-A" },
      };

      const mappedSaturday = mapScheduleRow(rawSaturday, staffNames);
      expect(mappedSaturday).not.toBeNull();
      expect(mappedSaturday?.day).toBe("Cumartesi");

      const rawSunday: RawScheduleRow = {
        id: "sch-sun",
        day_of_week: 7, // ISO 7 = Pazar
        starts_at: "09:30:00",
        ends_at: "10:20:00",
        title: "Pazar Etütü",
        room: "Salon B",
        class_id: "cls-1",
        subject_id: null,
        membership_id: null,
        classes: { name: "12-A" },
      };

      const mappedSunday = mapScheduleRow(rawSunday, staffNames);
      expect(mappedSunday).not.toBeNull();
      expect(mappedSunday?.day).toBe("Pazar");

      const rawMonday: RawScheduleRow = {
        ...rawSaturday,
        id: "sch-mon",
        day_of_week: 1, // ISO 1 = Pazartesi
      };
      const mappedMonday = mapScheduleRow(rawMonday, staffNames);
      expect(mappedMonday?.day).toBe("Pazartesi");
    });

    it("öğretmen adı çözülemediğinde null kalır, uydurulmuş dizge basılmaz (K-22)", () => {
      const raw: RawScheduleRow = {
        id: "sch-1",
        day_of_week: 2,
        starts_at: "09:00:00",
        ends_at: null,
        title: "Rehberlik",
        room: "Oda 1",
        class_id: "cls-1",
        membership_id: "mem-unknown", // Haritada yok
        classes: { name: "11-A" },
      };

      const mapped = mapScheduleRow(raw, staffNames);
      expect(mapped?.teacher).toBeNull();
    });

    it("servis tone alanı üretmez (undefined kalır)", () => {
      const raw: RawScheduleRow = {
        id: "sch-1",
        day_of_week: 3,
        starts_at: "09:00:00",
        ends_at: "09:45:00",
        title: "Kimya",
        room: "Lab",
        class_id: "cls-1",
        membership_id: "mem-1",
        classes: { name: "10-A" },
      };

      const mapped = mapScheduleRow(raw, staffNames);
      expect(mapped?.tone).toBeUndefined();
    });

    it("geçersiz ISO gün numarasında satır elenir (null döner)", () => {
      const raw: RawScheduleRow = {
        id: "sch-invalid",
        day_of_week: 0, // JS Pazar=0, ancak ISO'da geçersiz
        starts_at: "09:00:00",
        class_id: "cls-1",
        title: "Geçersiz Gün",
      };

      const mapped = mapScheduleRow(raw, staffNames);
      expect(mapped).toBeNull();
    });
  });

  describe("loadSchedule (Sorgu, Sıralama ve Kesilme Sözleşmesi)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      rpcMock.mockResolvedValue({ data: [], error: null });
    });

    it("ders programını gün ve başlangıç saatine göre artan sırada ve arşiv filtresiyle çeker", async () => {
      const spy: {
        isArgs?: [string, unknown];
        orderCalls?: [string, { ascending?: boolean }][];
        limitArg?: number;
        eqCalls?: [string, unknown][];
      } = {};

      fromMock.mockReturnValue(
        createScheduleQueryChain(
          {
            data: [
              {
                id: "entry-1",
                day_of_week: 6, // Cumartesi
                starts_at: "10:00:00",
                ends_at: "10:50:00",
                title: "Hafta Sonu Denemesi",
                room: "Derslik 101",
                class_id: "cls-1",
                subject_id: null,
                membership_id: null,
                classes: { name: "12-A" },
                subjects: null,
              },
            ],
            error: null,
          },
          spy
        )
      );

      const result = await loadSchedule("org-1", 50);

      expect(fromMock).toHaveBeenCalledWith("schedule_entries");
      expect(spy.eqCalls).toContainEqual(["organization_id", "org-1"]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      // Açık sıralama kuralı: gün, sonra başlangıç saati
      expect(spy.orderCalls).toEqual([
        ["day_of_week", { ascending: true }],
        ["starts_at", { ascending: true }],
        // Sayfalar arasında satır kaymasın diye eşitlik bozucu.
        ["id", { ascending: true }],
      ]);
      expect(spy.limitArg).toBe(50);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("Hafta Sonu Denemesi");
      expect(result.rows[0].day).toBe("Cumartesi");
      expect(result.rows[0].duration).toBe("50 dk");
      expect(result.truncated).toBe(false);
    });

    // ⛔ Bu testin sebebi: `truncated` bir ara sürümde EŞLENMİŞ satır sayısından
    // hesaplanıyordu. `mapScheduleRow` geçersiz gün numarasında satır düşürdüğü
    // için, sorgu tam limite dayanmışken bir satır elendiği anda bant sessizce
    // çizilmiyordu. Ölçüt HAM satır sayısı olmak zorunda.
    it("elenen satır olsa bile truncated ham satır sayısından hesaplanır", async () => {
      const mockRows = [
        {
          id: "entry-ok",
          day_of_week: 1,
          starts_at: "09:00:00",
          ends_at: null,
          title: "Geçerli Ders",
          class_id: "cls-1",
          classes: { name: "Sınıf 1" },
        },
        {
          id: "entry-bad",
          day_of_week: 0, // ISO'da geçersiz — mapScheduleRow bunu eler
          starts_at: "10:00:00",
          ends_at: null,
          title: "Geçersiz Gün",
          class_id: "cls-1",
          classes: { name: "Sınıf 1" },
        },
      ];

      fromMock.mockReturnValue(
        createScheduleQueryChain({ data: mockRows, error: null })
      );

      const result = await loadSchedule("org-1", 2);

      expect(result.rows).toHaveLength(1);
      expect(result.truncated).toBe(true);
    });

    it("satır sayısı limite eşitse truncated bayrağı true döner (K-03)", async () => {
      const mockRows = Array.from({ length: 3 }, (_, i) => ({
        id: `entry-${i}`,
        day_of_week: 1,
        starts_at: "09:00:00",
        ends_at: null,
        title: `Ders ${i}`,
        class_id: "cls-1",
        classes: { name: "Sınıf 1" },
      }));

      fromMock.mockReturnValue(
        createScheduleQueryChain({
          data: mockRows,
          error: null,
        })
      );

      const result = await loadSchedule("org-1", 3);

      expect(result.rows).toHaveLength(3);
      expect(result.truncated).toBe(true);
    });

    it("200'den fazla ders sayfa sayfa iner; haftanın son günleri kaybolmaz", async () => {
      // Eskiden tek sorgu 200 satırda kesiliyordu ve sıralama gün/saat
      // olduğu için bütün sınıfların Cuma-Cumartesi dersleri kayboluyordu.
      const mockRows = Array.from({ length: 2500 }, (_, i) => ({
        id: `entry-${String(i).padStart(5, "0")}`,
        day_of_week: i < 2400 ? 1 : 6,
        starts_at: "09:00:00",
        ends_at: null,
        title: `Ders ${i}`,
        class_id: `cls-${i % 50}`,
        classes: { name: `Sınıf ${i % 50}` },
      }));
      const spy: { rangeCalls?: [number, number][] } = {};
      fromMock.mockReturnValue(
        createScheduleQueryChain({ data: mockRows, error: null }, spy)
      );

      const result = await loadSchedule("org-1");

      expect(spy.rangeCalls).toEqual([
        [0, 499],
        [500, 999],
        [1000, 1499],
        [1500, 1999],
        [2000, 2499],
        [2500, 2999],
      ]);
      expect(result.rows).toHaveLength(2500);
      expect(result.rows.filter(r => r.day === "Cumartesi")).toHaveLength(100);
      expect(result.truncated).toBe(false);
    });

    it("varsayılan üst sınır 5000'dir", async () => {
      const spy: { rangeCalls?: [number, number][] } = {};
      fromMock.mockReturnValue(
        createScheduleQueryChain(
          {
            data: [],
            error: null,
          },
          spy
        )
      );

      await loadSchedule("org-1");

      // Boş programda yalnız ilk sayfa istenir; toplam tavan 5000.
      expect(spy.rangeCalls).toEqual([[0, 499]]);
      expect(SCHEDULE_TOTAL_CAP).toBe(5000);
    });

    it("kurum kimliği boşsa sorgu atmadan boş sonuç döner (fail-closed / K-04)", async () => {
      const result = await loadSchedule("");
      expect(fromMock).not.toHaveBeenCalled();
      expect(result).toEqual({ rows: [], truncated: false });
    });

    it("açık organization_id süzgeci taşır (R2 / K-24)", async () => {
      // ⚠️ `eqCalls` BOŞ DİZİYLE başlıyor, `undefined` ile değil. Süzgeç
      // kaldırıldığında zincir hiç `.eq()` çağırmaz; `undefined` bırakılsaydı
      // iddia okunabilir bir kırmızı yerine `TypeError` verirdi. K-23'ün
      // istediği şey testin kırmızıya dönmesi kadar **ne söylediğidir.**
      const spy: { eqCalls: [string, unknown][] } = { eqCalls: [] };
      fromMock.mockReturnValue(
        createScheduleQueryChain({ data: [], error: null }, spy)
      );

      await loadSchedule("org-test-123");

      expect(spy.eqCalls).toContainEqual(["organization_id", "org-test-123"]);
    });

    it("veritabanı hatasında anlamlı Türkçe hata fırlatır (K-04)", async () => {
      fromMock.mockReturnValue(
        createScheduleQueryChain({
          data: null,
          error: { message: "database error" },
        })
      );

      await expect(loadSchedule("org-1")).rejects.toThrow(
        "Ders programı yüklenemedi."
      );
    });
  });

  describe("createScheduleEntry (v1.4-11 · #287)", () => {
    it("yüke ASLA id koymaz ve subject_id doluyken title yazmaz (K-00 & K-06)", async () => {
      let capturedPayload: unknown;

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "entry-new-1" },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { select: mockSelect };
      });

      fromMock.mockReturnValue({
        insert: mockInsert,
      });

      const res = await createScheduleEntry({
        organizationId: "org-1",
        classId: "class-1",
        dayOfWeek: 1,
        startsAt: "09:00",
        endsAt: "10:00",
        subjectId: "sub-1",
        title: "Ders Başlığı Uydurma",
        membershipId: "mem-1",
        room: "A-101",
      });

      expect(fromMock).toHaveBeenCalledWith("schedule_entries");
      // ⛔ Yüke asla `id` konmaz
      expect(capturedPayload).not.toHaveProperty("id");
      // ⛔ subject_id doluyken ad dersten okunur — title'ı ona yazma kuralı
      expect((capturedPayload as { title: unknown }).title).toBeNull();
      expect((capturedPayload as { subject_id: unknown }).subject_id).toBe(
        "sub-1"
      );
      expect(res.id).toBe("entry-new-1");
    });

    it("subject_id yokken özel title yazar", async () => {
      let capturedPayload: unknown;

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "entry-new-2" },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { select: mockSelect };
      });

      fromMock.mockReturnValue({
        insert: mockInsert,
      });

      await createScheduleEntry({
        organizationId: "org-1",
        classId: "class-1",
        dayOfWeek: 2,
        startsAt: "14:00",
        title: "Rehberlik Saati",
      });

      expect(
        (capturedPayload as { subject_id: unknown }).subject_id
      ).toBeNull();
      expect((capturedPayload as { title: unknown }).title).toBe(
        "Rehberlik Saati"
      );
    });
  });

  describe("updateScheduleEntry", () => {
    it("yüke id, organization_id veya class_id KOYMAZ (UPDATE yetkisi sınırları)", async () => {
      let capturedPayload: unknown;

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "entry-1" }],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { eq: mockEqOrg };
      });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await updateScheduleEntry("org-1", "entry-1", {
        dayOfWeek: 3,
        startsAt: "10:00",
        endsAt: "11:00",
        room: "B-202",
      });

      expect(mockEqOrg).toHaveBeenCalledWith("organization_id", "org-1");
      expect(mockEqId).toHaveBeenCalledWith("id", "entry-1");
      expect(mockIs).toHaveBeenCalledWith("archived_at", null);
      // ⛔ id, organization_id veya class_id asla update yüküne girmez
      expect(capturedPayload).not.toHaveProperty("id");
      expect(capturedPayload).not.toHaveProperty("organization_id");
      expect(capturedPayload).not.toHaveProperty("class_id");
    });

    it("K-14: Sıfır satır etkilendiğinde hata fırlatır", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await expect(
        updateScheduleEntry("org-1", "entry-1", { startsAt: "11:00" })
      ).rejects.toThrow(
        "Ders programı kaydı bulunamadı veya güncelleme yetkiniz yok."
      );
    });
  });

  describe("archiveScheduleEntry", () => {
    it("satırı arşivler", async () => {
      let capturedPayload: unknown;

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "entry-1" }],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { eq: mockEqOrg };
      });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await archiveScheduleEntry("org-1", "entry-1");

      expect(mockEqOrg).toHaveBeenCalledWith("organization_id", "org-1");
      expect(mockEqId).toHaveBeenCalledWith("id", "entry-1");
      expect(mockIs).toHaveBeenCalledWith("archived_at", null);
      expect(capturedPayload).toHaveProperty("archived_at");
    });

    it("K-14: Sıfır satır etkilendiğinde hata fırlatır", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await expect(archiveScheduleEntry("org-1", "entry-1")).rejects.toThrow(
        "Ders programı kaydı bulunamadı veya işlem yetkiniz yok."
      );
    });
  });

  describe("translateScheduleError (23505 Çakışma ve Kural Çevirisi)", () => {
    it("23505 sınıf çakışmasını ayırt eder (schedule_entries_class_slot_idx)", () => {
      const err = {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "schedule_entries_class_slot_idx"',
      };
      expect(translateScheduleError(err)).toBe(
        "Bu saatte sınıfın başka bir dersi bulunuyor."
      );
    });

    it("23505 öğretmen çakışmasını ayırt eder (schedule_entries_teacher_slot_idx)", () => {
      const err = {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "schedule_entries_teacher_slot_idx"',
      };
      expect(translateScheduleError(err)).toBe(
        "Bu saatte öğretmenin başka bir dersi bulunuyor."
      );
    });

    it("23505 genel çakışma durumunda dürüst mesaj verir", () => {
      const err = {
        code: "23505",
        message: "duplicate key",
      };
      expect(translateScheduleError(err)).toBe(
        "Bu saatte çakışan bir ders programı kaydı var."
      );
    });

    it("23514 zaman kontrolü hatasını açıklar", () => {
      const err = {
        code: "23514",
        message: 'violates check constraint "schedule_entries_time_check"',
      };
      expect(translateScheduleError(err)).toBe(
        "Bitiş saati başlangıç saatinden sonra olmalıdır."
      );
    });

    it("23514 ders etiketi kontrolü hatasını açıklar", () => {
      const err = {
        code: "23514",
        message: 'violates check constraint "schedule_entries_label_check"',
      };
      expect(translateScheduleError(err)).toBe(
        "Ders seçilmeli veya bir ders başlığı girilmelidir."
      );
    });

    it("42501 yetki hatasını açıklar", () => {
      expect(translateScheduleError({ code: "42501" })).toBe(
        "Bu işlem için kurum yöneticisi yetkisi gerekiyor."
      );
    });
  });
});
