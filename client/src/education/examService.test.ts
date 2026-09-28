import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import {
  archiveExam,
  createExam,
  formatExamSummary,
  loadExamParticipantCount,
  loadExamSheet,
  loadLatestExam,
  loadStudentLatestExamScores,
  mapLatestExamRow,
  saveExamResults,
  translateExamError,
  updateExam,
  type ExamSheet,
  type LatestExamDetail,
} from "./examService";
import { ExamDetailView as AssessmentsPage } from "@/components/education/pages/ExamDetailView";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args: unknown) => rpcMock(fn, args),
  },
}));

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({
    identity: {
      displayName: "Zeynep Kaya",
      membership: { organizationId: "org-1" },
    },
  }),
}));

type QueryResult = { data: unknown; error: unknown };

function createQueryChain(
  result: QueryResult,
  spy?: {
    selectArg?: string;
    isArgs?: [string, unknown];
    orderArgs?: [string, { ascending?: boolean }][];
    limitArg?: number;
    eqArgs?: [string, unknown][];
    insertArg?: unknown;
    updateArg?: unknown;
  }
) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn((columns?: string) => {
    if (spy && columns) spy.selectArg = columns;
    return chain;
  });
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (spy) {
      if (!spy.eqArgs) spy.eqArgs = [];
      spy.eqArgs.push([col, val]);
    }
    return chain;
  });
  chain.is = vi.fn((col: string, val: unknown) => {
    if (spy) spy.isArgs = [col, val];
    return chain;
  });
  chain.order = vi.fn((col: string, opts: { ascending?: boolean }) => {
    if (spy) {
      if (!spy.orderArgs) spy.orderArgs = [];
      spy.orderArgs.push([col, opts]);
    }
    return chain;
  });
  chain.limit = vi.fn((limit: number) => {
    if (spy) spy.limitArg = limit;
    return Promise.resolve(result);
  });
  chain.insert = vi.fn((payload: unknown) => {
    if (spy) spy.insertArg = payload;
    return chain;
  });
  chain.update = vi.fn((payload: unknown) => {
    if (spy) spy.updateArg = payload;
    return chain;
  });
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (
    onfulfilled?: (value: QueryResult) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onfulfilled, onrejected);
  return chain;
}

describe("examService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tarih biçimlendiricinin kendi testleri `trDate.test.ts`'te; burada
  // tekrarlanmıyor — aynı olgu iki yerde sınanırsa biri eskir (K-06).
  describe("formatExamSummary (K-22 & max_score Kuralı)", () => {
    it("max_score dolu olduğunda 'N üzerinden' ibaresini ekler", () => {
      const exam: LatestExamDetail = {
        id: "exam-1",
        name: "TYT Deneme 06",
        examDate: "2026-08-14",
        maxScore: 100,
        participantCount: 54,
      };

      const summary = formatExamSummary(exam);
      expect(summary).toBe("14 Ağustos 2026 · 54 katılımcı · 100 üzerinden");
    });

    it("max_score boş (null/undefined) olduğunda 'üzerinden' ibaresi KESİNLİKLE üretilmez (K-22, K-03)", () => {
      const examWithNull: LatestExamDetail = {
        id: "exam-2",
        name: "Kazanım Değerlendirme",
        examDate: "2026-08-14",
        maxScore: null,
        participantCount: 30,
      };

      const summary = formatExamSummary(examWithNull);
      expect(summary).toBe("14 Ağustos 2026 · 30 katılımcı");
      expect(summary).not.toContain("üzerinden");
    });

    it("katılımcı sayısı bilinmiyorken 'katılımcı' ibaresi üretilmez, 0 da yazılmaz (K-22)", () => {
      const examWithoutCount: LatestExamDetail = {
        id: "exam-3",
        name: "TYT Deneme 06",
        examDate: "2026-08-14",
        maxScore: 100,
        participantCount: null,
      };

      const summary = formatExamSummary(examWithoutCount);
      expect(summary).toBe("14 Ağustos 2026 · 100 üzerinden");
      expect(summary).not.toContain("katılımcı");
      // ⛔ "0 katılımcı" bir iddiadır: sınava kimsenin girmediğini söyler.
      expect(summary).not.toContain("0 katılımcı");
    });
  });

  describe("mapLatestExamRow", () => {
    it("sınav satırını eşler, sayı dönüşümünü yapar ve katılımcı sayısını dışarıdan alır", () => {
      const mapped = mapLatestExamRow(
        {
          id: "exam-1",
          name: "TYT Deneme 01",
          exam_date: "2026-09-01",
          max_score: "100.00", // PostgREST dizge döner
        },
        54
      );

      expect(mapped.id).toBe("exam-1");
      expect(mapped.name).toBe("TYT Deneme 01");
      expect(mapped.examDate).toBe("2026-09-01");
      expect(mapped.maxScore).toBe(100);
      expect(mapped.participantCount).toBe(54);
    });

    it("max_score null olduğunda null döner", () => {
      const mapped = mapLatestExamRow(
        {
          id: "exam-2",
          name: "Mini Test",
          exam_date: "2026-09-02",
          max_score: null,
        },
        null
      );

      expect(mapped.maxScore).toBeNull();
      expect(mapped.participantCount).toBeNull();
    });

    // ⛔ Satırla birlikte gelen `exam_results` dizisi çağıranın yetkisiyle
    // süzülmüştür; uzunluğu sınava kaç kişinin girdiğini DEĞİL, okuyanın kaç
    // satır görebildiğini ölçer. Biri onu yeniden okumaya kalkarsa bu test düşer.
    it("satıra iliştirilmiş exam_results dizisini katılımcı sayısı olarak KULLANMAZ", () => {
      const mapped = mapLatestExamRow(
        {
          id: "exam-4",
          name: "Kurum Geneli Deneme",
          exam_date: "2026-09-07",
          max_score: 100,
          // Öğrencinin göreceği hali: üç kişi girdi ama tek satır okunabiliyor.
          exam_results: [{ id: "res-1" }],
        } as Parameters<typeof mapLatestExamRow>[0],
        3
      );

      expect(mapped.participantCount).toBe(3);
    });
  });

  describe("loadExamParticipantCount (RPC exam_participant_count)", () => {
    it("sayıyı fonksiyondan okur; exam_results satırı saymaz", async () => {
      rpcMock.mockResolvedValue({ data: 54, error: null });

      const count = await loadExamParticipantCount("exam-1");

      expect(count).toBe(54);
      expect(rpcMock).toHaveBeenCalledWith("exam_participant_count", {
        target_exam_id: "exam-1",
      });
      expect(fromMock).not.toHaveBeenCalledWith("exam_results");
      expect(rpcMock).not.toHaveBeenCalledWith(
        "exam_ranking",
        expect.anything()
      );
    });

    it("PostgREST bigint'i dizge verdiğinde de sayıya çevirir", async () => {
      rpcMock.mockResolvedValue({ data: "54", error: null });
      await expect(loadExamParticipantCount("exam-1")).resolves.toBe(54);
    });

    it("yetkisiz çağırana fonksiyon null döner; sayı uydurulmaz, 0 yazılmaz (K-22)", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });
      await expect(loadExamParticipantCount("exam-1")).resolves.toBeNull();
    });

    it("sorgu hatasında null döner, 0 değil (K-04)", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      });
      await expect(loadExamParticipantCount("exam-1")).resolves.toBeNull();
    });
  });

  describe("loadStudentLatestExamScores (RPC student_latest_exam_scores & #257 Altı Sütun)", () => {
    it("boş öğrenci listesinde veritabanına sorgu atmadan boş map döner", async () => {
      const result = await loadStudentLatestExamScores([]);
      expect(result.size).toBe(0);
      expect(rpcMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("PostgREST'ten dönen altı sütunun HEPSİNİ taşır (#257) ve dizge puanları sayıya çevirir", async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            student_id: "stu-1",
            score: "84.00",
            exam_id: "exam-101",
            exam_name: "TYT Deneme 01",
            exam_date: "2026-09-01",
            max_score: "100.00",
          },
          {
            student_id: "stu-2",
            score: "72.50",
            exam_id: "exam-102",
            exam_name: "LGS Deneme 03",
            exam_date: "2026-09-05",
            max_score: "90.00",
          },
          {
            student_id: "stu-3",
            score: "0.00", // 0 geçerli bir puandır
            exam_id: "exam-103",
            exam_name: "Kazanım Testi",
            exam_date: "2026-09-08",
            max_score: null,
          },
        ],
        error: null,
      });

      const map = await loadStudentLatestExamScores([
        "stu-1",
        "stu-2",
        "stu-3",
        "stu-4", // sınav sonucu olmayan öğrenci
      ]);

      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("student_latest_exam_scores", {
        target_student_ids: ["stu-1", "stu-2", "stu-3", "stu-4"],
      });

      // ⛔ ENGELLEYİCİ KONTROLLER
      // 1. exam_results tablosuna doğrudan sorgu GİTMEZ
      expect(fromMock).not.toHaveBeenCalledWith("exam_results");
      // 2. exam_ranking SIRALAMA fonksiyonu çağrılmaz (2.B)
      expect(rpcMock).not.toHaveBeenCalledWith(
        "exam_ranking",
        expect.anything()
      );

      // #257: Altı sütunun tamamının taşındığı doğrulaması
      const stu1 = map.get("stu-1");
      expect(stu1).toBeDefined();
      expect(stu1?.studentId).toBe("stu-1");
      expect(stu1?.score).toBe(84);
      expect(typeof stu1?.score).toBe("number");
      expect(stu1?.examId).toBe("exam-101");
      expect(stu1?.examName).toBe("TYT Deneme 01");
      expect(stu1?.examDate).toBe("2026-09-01");
      expect(stu1?.maxScore).toBe(100);

      const stu2 = map.get("stu-2");
      expect(stu2?.score).toBe(72.5);
      expect(stu2?.examName).toBe("LGS Deneme 03");
      expect(stu2?.maxScore).toBe(90);

      const stu3 = map.get("stu-3");
      expect(stu3?.score).toBe(0);
      expect(stu3?.maxScore).toBeNull();

      // K-22, K-03: Sınavı olmayan öğrencinin puanı undefined kalır, 0 uydurulmaz
      expect(map.get("stu-4")).toBeUndefined();
    });

    it("veritabanı hatasında fail-closed davranır ve boş map döner (K-04)", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: "database timeout" },
      });

      const map = await loadStudentLatestExamScores(["stu-1"]);
      expect(map.size).toBe(0);
      expect(fromMock).not.toHaveBeenCalledWith("exam_results");
    });
  });

  describe("loadLatestExam (Sınav Başlığı & Açık organization_id)", () => {
    it("açık organization_id süzgeci taşır (#249), tarih ve id azalan sırayla çeker, arşivliyi eler", async () => {
      const spy: {
        selectArg?: string;
        isArgs?: [string, unknown];
        orderArgs?: [string, { ascending?: boolean }][];
        limitArg?: number;
        eqArgs?: [string, unknown][];
      } = {};

      fromMock.mockReturnValue(
        createQueryChain(
          {
            data: [
              {
                id: "exam-latest",
                name: "TYT Deneme 06",
                exam_date: "2026-08-14",
                max_score: "100.00",
              },
            ],
            error: null,
          },
          spy
        )
      );
      rpcMock.mockResolvedValue({ data: "54", error: null });

      const result = await loadLatestExam("org-1");

      expect(fromMock).toHaveBeenCalledWith("exams");
      // Açık organization_id süzgeci doğrulaması (#249)
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);

      // ⛔ exam_results tablosuna doğrudan sorgu atılmaz
      expect(fromMock).not.toHaveBeenCalledWith("exam_results");
      expect(rpcMock).not.toHaveBeenCalledWith(
        "exam_ranking",
        expect.anything()
      );
      // ⛔ Ve gömülü olarak da çekilmez: gömülü dizi RLS ile süzülür, uzunluğu
      // katılımcı sayısı değildir. Sayı fonksiyondan gelir.
      expect(spy.selectArg).not.toContain("exam_results");
      expect(rpcMock).toHaveBeenCalledWith("exam_participant_count", {
        target_exam_id: "exam-latest",
      });

      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(spy.orderArgs).toEqual([
        ["exam_date", { ascending: false }],
        ["id", { ascending: false }],
      ]);
      expect(spy.limitArg).toBe(1);

      expect(result.exam).not.toBeNull();
      expect(result.exam?.id).toBe("exam-latest");
      expect(result.exam?.name).toBe("TYT Deneme 06");
      expect(result.exam?.participantCount).toBe(54);
      expect(result.exam?.maxScore).toBe(100);
    });

    it("katılımcı sayısı alınamazsa sınav yine çizilir, sayı null kalır (K-04)", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: [
            {
              id: "exam-latest",
              name: "TYT Deneme 06",
              exam_date: "2026-08-14",
              max_score: "100.00",
            },
          ],
          error: null,
        })
      );
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      });

      const result = await loadLatestExam("org-1");

      expect(result.exam?.name).toBe("TYT Deneme 06");
      expect(result.exam?.participantCount).toBeNull();
    });

    it("aktif sınav yoksa exam: null döner ve katılımcı sayısı hiç sorulmaz (K-03)", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: [],
          error: null,
        })
      );

      const result = await loadLatestExam("org-1");
      expect(result.exam).toBeNull();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("veritabanı hatasında translateExamError üzerinden hata fırlatır", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: null,
          error: { code: "ORB02" },
        })
      );

      await expect(loadLatestExam("org-1")).rejects.toThrow(
        "Öğrenci bu sınavın sınıfına kayıtlı değil."
      );
    });
  });

  describe("createExam (v1.4-04 & #270 Sınav Oluşturma)", () => {
    it("⛔ Sınav oluştururken `id` GÖNDERİLMEZ (K-03 / Güvenlik Tuzağı) ve dönen id geri okunur", async () => {
      const spy: {
        insertArg?: Record<string, unknown>;
        selectArg?: string;
      } = {};

      fromMock.mockReturnValue(
        createQueryChain(
          {
            data: { id: "new-generated-exam-id" },
            error: null,
          },
          spy
        )
      );

      const res = await createExam({
        organizationId: "org-1",
        classId: "cls-1",
        name: "YKS Deneme 01",
        examDate: "2026-09-15",
        maxScore: 100,
      });

      expect(fromMock).toHaveBeenCalledWith("exams");
      expect(spy.insertArg).toBeDefined();

      // ⛔ EN KRİTİK KONTROL: id yükün içinde GÖNDERİLMEZ
      expect(spy.insertArg).not.toHaveProperty("id");

      expect(spy.insertArg).toEqual({
        organization_id: "org-1",
        class_id: "cls-1",
        name: "YKS Deneme 01",
        exam_date: "2026-09-15",
        max_score: 100,
      });

      expect(spy.selectArg).toBe("id");
      expect(res.id).toBe("new-generated-exam-id");
    });

    it("hata oluştuğunda translateExamError üzerinden hata fırlatır", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: null,
          error: { code: "23514" },
        })
      );

      await expect(
        createExam({
          organizationId: "org-1",
          classId: "cls-1",
          name: "",
          examDate: "2026-09-15",
        })
      ).rejects.toThrow("Sınav adı 1 ile 160 karakter arasında olmalıdır.");
    });
  });

  describe("updateExam ve archiveExam (Açık organization_id)", () => {
    it("updateExam açık organization_id ve id süzgeciyle günceller", async () => {
      const spy: { eqArgs?: [string, unknown][]; updateArg?: unknown } = {};
      fromMock.mockReturnValue(
        createQueryChain(
          { data: [{ id: "etkilenen-satir" }], error: null },
          spy
        )
      );

      await updateExam("org-1", "exam-1", {
        name: "Yeni Sınav Adı",
        maxScore: 120,
      });

      expect(fromMock).toHaveBeenCalledWith("exams");
      expect(spy.updateArg).toEqual({ name: "Yeni Sınav Adı", max_score: 120 });
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "exam-1"]);
    });

    it("archiveExam açık organization_id ile archived_at zaman damgası koyar", async () => {
      const spy: { eqArgs?: [string, unknown][]; updateArg?: unknown } = {};
      fromMock.mockReturnValue(
        createQueryChain(
          { data: [{ id: "etkilenen-satir" }], error: null },
          spy
        )
      );

      await archiveExam("org-1", "exam-1");

      expect(fromMock).toHaveBeenCalledWith("exams");
      expect(spy.updateArg).toEqual({ archived_at: expect.any(String) });
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "exam-1"]);
    });

    it("loadExamSheet sınavı, sınıf öğrencilerini ve varsa sonuçları yükler", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "exams") {
          return createQueryChain({
            data: {
              id: "exam-1",
              organization_id: "org-1",
              class_id: "cls-1",
              name: "Deneme 1",
              exam_date: "2026-09-10",
              max_score: "100",
              classes: { name: "12-A" },
            },
            error: null,
          });
        }
        if (table === "class_enrollments") {
          return createQueryChain({
            data: [
              {
                student_id: "stu-1",
                students: { full_name: "Ali Can", student_number: 101 },
              },
              {
                student_id: "stu-2",
                students: { full_name: "Zeynep Kaya", student_number: 102 },
              },
            ],
            error: null,
          });
        }
        if (table === "exam_results") {
          return createQueryChain({
            data: [{ id: "res-1", student_id: "stu-2", score: "90" }],
            error: null,
          });
        }
        return createQueryChain({ data: null, error: null });
      });

      const sheet = await loadExamSheet("org-1", "exam-1");

      expect(sheet.exam.name).toBe("Deneme 1");
      expect(sheet.students).toHaveLength(2);
      expect(sheet.students[0].studentName).toBe("Ali Can");
      expect(sheet.students[0].score).toBeNull(); // Puanı olmayan öğrenci null (K-03)
      expect(sheet.students[1].studentName).toBe("Zeynep Kaya");
      expect(sheet.students[1].score).toBe(90);
    });
  });

  describe("saveExamResults (v1.4-04 & #270 Sonuç Yazma RPC)", () => {
    it("⛔ Düz upsert KULLANMAZ, yalnız record_exam_results RPC'sini çağırır ve eksi neti kabul eder", async () => {
      rpcMock.mockResolvedValue({ data: 2, error: null });

      const count = await saveExamResults("exam-1", [
        { studentId: "stu-1", score: 85 },
        { studentId: "stu-2", score: -5 }, // Eksi net puanlama geçerlidir!
      ]);

      expect(count).toBe(2);
      expect(rpcMock).toHaveBeenCalledWith("record_exam_results", {
        target_exam_id: "exam-1",
        entries: [
          { student_id: "stu-1", score: 85 },
          { student_id: "stu-2", score: -5 },
        ],
      });

      // ⛔ Düz upsert ASLA kullanılmaz (ÖLÇÜLDÜ: 42501)
      expect(fromMock).not.toHaveBeenCalledWith("exam_results");
    });

    it("RPC tavan aşımında (ORB05) anlamlı Türkçe mesaj fırlatır", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { code: "ORB05" },
      });

      await expect(
        saveExamResults("exam-1", [{ studentId: "stu-1", score: 105 }])
      ).rejects.toThrow("Girilen puan sınavın tam puanını aşıyor.");
    });
  });

  describe("translateExamError (v1.4-04 Beş Hata Kodu Sözleşmesi)", () => {
    it("ORB05 tavan aşımında tavanı söyler ve düzenleme önerir", () => {
      const msg = translateExamError({ code: "ORB05" });
      expect(msg).toContain("Girilen puan sınavın tam puanını aşıyor.");
      expect(msg).toContain("sınav kaydını düzenleyin");
    });

    it("ORB02 kayıt dışı öğrenci hatasında sınıf ekranına yönlendirir", () => {
      const msg = translateExamError({ code: "ORB02" });
      expect(msg).toContain("Öğrenci bu sınavın sınıfına kayıtlı değil.");
      expect(msg).toContain("Sınıflar ekranından");
    });

    it("42501 yetki hatasında yönetici veya sınıfın öğretmenini işaret eder", () => {
      const msg = translateExamError({ code: "42501" });
      expect(msg).toContain(
        "Bu işlem için yetkiniz yok veya şifre değişimi bekleniyor."
      );
      expect(msg).toContain(
        "kurum yöneticisi veya sınavın sınıfını okutan öğretmen"
      );
    });

    it("23503 sınav yok hatasında listeyi tazelemeyi önerir", () => {
      const msg = translateExamError({ code: "23503" });
      expect(msg).toContain("Sınav bulunamadı veya arşivlenmiş.");
      expect(msg).toContain("Listeyi tazeleyip tekrar deneyin");
    });

    it("23514 geçersiz sınav adı hatasında kabul edilen uzunluğu söyler", () => {
      const msg = translateExamError({ code: "23514" });
      expect(msg).toContain("Sınav adı 1 ile 160 karakter arasında olmalıdır.");
    });

    it("beş hata kodu birbirinden tamamen farklı beş ayrı Türkçe mesaja çevrilir", () => {
      const m1 = translateExamError({ code: "ORB05" });
      const m2 = translateExamError({ code: "ORB02" });
      const m3 = translateExamError({ code: "42501" });
      const m4 = translateExamError({ code: "23503" });
      const m5 = translateExamError({ code: "23514" });

      const set = new Set([m1, m2, m3, m4, m5]);
      expect(set.size).toBe(5);
    });
  });

  describe("AssessmentsPage UI davranışları (K-22, K-03 & #237 Temizliği)", () => {
    it('puanı olmayan öğrenci BOŞTUR (value=""), 0 uydurulmaz (K-03)', () => {
      const sheet: ExamSheet = {
        exam: {
          id: "exam-1",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          subjectId: null,
          subjectName: null,
          name: "TYT Deneme 06",
          examDate: "2026-08-14",
          maxScore: 100,
        },
        students: [
          {
            studentId: "stu-1",
            studentName: "Ali Can",
            studentCode: "101",
            score: null, // Puanı YOK!
          },
          {
            studentId: "stu-2",
            studentName: "Zeynep Kaya",
            studentCode: "102",
            score: 85,
          },
        ],
      };

      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "teacher",
          onNavigate: vi.fn(),
          initialSheet: sheet,
          isDemo: false,
        })
      );

      // Ali Can listelenir
      expect(html).toContain("Ali Can");
      // Zeynep Kaya ve puanı 85 yer alır
      expect(html).toContain("Zeynep Kaya");
      expect(html).toContain('value="85"');
      // Puanı olmayan Ali Can için input boş gelir; 0 yazılmaz (K-03)
      expect(html).toContain('placeholder="Girilmedi"');
      expect(html).toContain('value=""');
    });

    it("max_score boş (null) iken payda (/) KESİNLİKLE ÇİZİLMEZ (#237, K-03)", () => {
      const sheetWithoutMax: ExamSheet = {
        exam: {
          id: "exam-2",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          subjectId: null,
          subjectName: null,
          name: "Kazanım Testi",
          examDate: "2026-08-14",
          maxScore: null, // Tam puan YOK
        },
        students: [
          {
            studentId: "stu-1",
            studentName: "Ali Can",
            score: 45,
          },
        ],
      };

      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "teacher",
          onNavigate: vi.fn(),
          initialSheet: sheetWithoutMax,
          isDemo: false,
        })
      );

      expect(html).toContain("Kazanım Testi");
      // Sınav başlığında ve input yanında '/ 100' gibi uydurma payda çizilmez
      expect(html).not.toContain("üzerinden");
      expect(html).not.toContain("/ null");
      expect(html).not.toContain("/ 100");
    });

    it("⛔ #237 ile kaldırılan dört öğe ekranda KESİNLİKLE BULUNMAZ", () => {
      const exam: LatestExamDetail = {
        id: "exam-1",
        name: "TYT Deneme 06",
        examDate: "2026-08-14",
        maxScore: 100,
        participantCount: 54,
      };

      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "admin",
          onNavigate: vi.fn(),
          exam,
          isDemo: false,
        })
      );

      // Bağlanan gerçek alanlar:
      expect(html).toContain("TYT Deneme 06");
      expect(html).toContain("14 Ağustos 2026 · 54 katılımcı · 100 üzerinden");

      // ⛔ KALDIRILAN DÖRT ÖĞE (#237):
      // 1. "Odak alan: Geometri"
      expect(html).not.toContain("Odak alan: Geometri");
      // 2. Tavsiye metinleri ("... etüdü öneriliyor" / "Takip önerisi")
      expect(html).not.toContain("Takip önerisi");
      expect(html).not.toContain(
        "Geometri konularında kısa tekrar ve soru çözüm etüdü öneriliyor."
      );
      // 4. Sabit ders ortalaması "Matematik 82" ve genel "Ders ortalaması" etiketi (R1)
      expect(html).not.toContain("Matematik 82");
      expect(html).not.toContain("Ders ortalaması");
    });

    it("ortalama kartı 'Sınav ortalaması' olarak adlandırılır ve kapsadığı öğrenci sayısını belirtir (v1.4-04 R1)", () => {
      const sheet: ExamSheet = {
        exam: {
          id: "exam-1",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          subjectId: null,
          subjectName: null,
          name: "TYT Deneme 06",
          examDate: "2026-08-14",
          maxScore: 100,
        },
        students: [
          { studentId: "stu-1", studentName: "Ali Can", score: 80 },
          { studentId: "stu-2", studentName: "Zeynep Kaya", score: 90 },
          { studentId: "stu-3", studentName: "Mehmet Demir", score: null }, // Puanı girilmemiş
        ],
      };

      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "teacher",
          onNavigate: vi.fn(),
          initialSheet: sheet,
          isDemo: false,
        })
      );

      // R1.1: Etiket 'Sınav ortalaması'dır; 'Ders ortalaması' DEĞİLDİR (#237 / R1)
      expect(html).toContain("Sınav ortalaması");
      expect(html).not.toContain("Ders ortalaması");

      // R1.2: detail kaç öğrencinin puanının ortalaması olduğunu açıkça söyler
      expect(html).toContain("2 öğrencinin ortalaması");
      expect(html).toContain("85 / 100 puan");
    });

    it("öğretmen ve yönetici rolünde sınav oluşturma ve sonuç kaydetme açıktır (rol kilitlenmesi yok)", () => {
      const sheet: ExamSheet = {
        exam: {
          id: "exam-1",
          organizationId: "org-1",
          classId: "cls-1",
          className: "12-A",
          subjectId: null,
          subjectName: null,
          name: "TYT Deneme 06",
          examDate: "2026-08-14",
          maxScore: 100,
        },
        students: [{ studentId: "stu-1", studentName: "Ali Can", score: 80 }],
      };

      // Öğretmen için render
      const teacherHtml = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "teacher",
          onNavigate: vi.fn(),
          initialSheet: sheet,
          isDemo: false,
        })
      );

      expect(teacherHtml).toContain("Yeni sınav");
      expect(teacherHtml).toContain("Sonuçları Kaydet");

      // Yönetici için render
      const adminHtml = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "admin",
          onNavigate: vi.fn(),
          initialSheet: sheet,
          isDemo: false,
        })
      );

      expect(adminHtml).toContain("Yeni sınav");
      expect(adminHtml).toContain("Sonuçları Kaydet");
    });

    it("üretimde sınav kaydı yoksa 'Henüz sınav kaydı yok' boş durumunu gösterir (K-03)", () => {
      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "admin",
          onNavigate: vi.fn(),
          exam: null,
          isDemo: false,
        })
      );

      expect(html).toContain("Henüz sınav kaydı yok");
      expect(html).not.toContain("TYT Deneme 06");
    });

    it("demo modunda örnek sınav ve verilerle çizilir", () => {
      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "admin",
          onNavigate: vi.fn(),
          isDemo: true,
        })
      );

      expect(html).toContain("TYT Deneme 06");
      expect(html).toContain("Sınav Sonuçları");
    });
  });

  // v1.4 ara denetimi · K-14 — bkz. classService.test.ts'teki aynı blok.
  describe("K-14 sıfır satır koruması (v1.4 ara denetimi)", () => {
    const senaryolar: [string, () => Promise<unknown>, string][] = [
      [
        "updateExam",
        () => updateExam("org-1", "sinav-yok", { name: "X" }),
        "güncellenemedi",
      ],
      ["archiveExam", () => archiveExam("org-1", "sinav-yok"), "arşivlenemedi"],
    ];

    for (const [ad, cagir, beklenen] of senaryolar) {
      it(`${ad} sıfır satır etkilediğinde hata fırlatır`, async () => {
        fromMock.mockReturnValue(createQueryChain({ data: [], error: null }));
        await expect(cagir()).rejects.toThrow(beklenen);
      });
    }
  });

  // =========================================================================
  // v1.4 ara denetimi (2026-09-13) — v1.4-04'ün karşılanmamış iddiası
  // =========================================================================
  //
  // v1.4-04 "sınav ekle/düzenle/arşivle" diye kapandı; ölçüm `updateExam` ve
  // `archiveExam`'in HİÇBİR ekrandan çağrılmadığını gösterdi. ExamFormDialog
  // yalnız `createExam`'i import ediyordu. Bu blok iddiayı çiviliyor.
  describe("sınav düzenleme ve arşivleme (v1.4 ara denetimi)", () => {
    const aktifSinav: ExamSheet = {
      exam: {
        id: "exam-1",
        organizationId: "org-1",
        classId: "cls-1",
        className: "12-A",
        subjectId: null,
        subjectName: null,
        name: "TYT Deneme 06",
        examDate: "2026-08-14",
        maxScore: 100,
      },
      students: [{ studentId: "stu-1", studentName: "Ali Can", score: 80 }],
    };

    it("yönetkili rolde 'Düzenle' ve 'Arşivle' eylemleri çizilir", () => {
      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "teacher",
          onNavigate: vi.fn(),
          initialSheet: aktifSinav,
          isDemo: false,
        })
      );

      expect(html).toContain("Düzenle");
      expect(html).toContain("Arşivle");
    });

    it("öğrenci rolünde bu eylemler KESİNLİKLE çizilmez", () => {
      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "student",
          onNavigate: vi.fn(),
          initialSheet: aktifSinav,
          isDemo: false,
        })
      );

      expect(html).not.toContain("Arşivle");
    });

    // ⚠️ Uydurma yer tutucunun ("Yeni Sınav", bugünün tarihi, tam puan null)
    // korumasi bir DEĞİL bir TİP: `onDone` artık `LatestExamDetail` alıyor,
    // yani diyalog kullanıcının yazdığı değerleri geri vermek zorunda.
    // İmzayı `(id: string)`e döndürdüğümde `tsc` tam da uydurmanın yapıldığı
    // satırda patlıyor — statik çizim bunu göremez, derleyici görür.
    //
    // Burada gözlenebilen şey, ekranın sınavın GERÇEK adını göstermesi.
    it("ekran sınavın gerçek adını gösterir, yer tutucu bir ad değil", () => {
      const html = renderToStaticMarkup(
        createElement(AssessmentsPage, {
          role: "teacher",
          onNavigate: vi.fn(),
          initialSheet: aktifSinav,
          isDemo: false,
        })
      );

      expect(html).toContain("TYT Deneme 06");
      // Diyalog kapalıyken düzenleme başlığı çizilmez.
      expect(html).not.toContain("Sınavı Düzenle");
    });
  });
});
