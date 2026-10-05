import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { READ_PAGE_SIZE } from "@/lib/pagedRead";

(globalThis as unknown as { React: typeof React }).React = React;

import {
  HOMEWORK_TOTAL_CAP,
  archiveHomework,
  createHomework,
  extractClassName,
  extractSubjectName,
  loadHomework,
  loadHomeworkSubmissions,
  loadStaffNames,
  loadStudentHomeworkRatios,
  mapHomeworkRow,
  markSubmission,
  restoreHomework,
  setSubmissionsRecorded,
  translateHomeworkError,
  translateHomeworkSubmissionError,
  unmarkSubmission,
  updateHomework,
  type RawHomeworkRow,
} from "./homeworkService";
import { HomeworkCard } from "@/components/education/pages/HomeworkCard";
import { HomeworkPage } from "@/components/education/pages/HomeworkPage";
import { HomeworkCreateDialog } from "@/components/education/pages/HomeworkCreateDialog";
import { ReportsPage } from "@/components/education/pages/ReportsPage";
import type { Homework } from "@/components/education/types";

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
      membership: {
        role: "teacher",
        organizationId: "org-1",
        membershipId: "mem-1",
      },
      displayName: "Merve Hoca",
    },
  }),
}));

vi.mock("@/education/educationQueries", () => ({
  useSubjects: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog" }, children),
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-content" }, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-description" }, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-footer" }, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-header" }, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-slot": "dialog-title" }, children),
  useDialogComposition: () => ({
    isComposingRef: { current: false },
    handleCompositionStart: () => {},
    handleCompositionEnd: () => {},
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
  chain.in = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.order = vi.fn((col: string, opts: { ascending?: boolean }) => {
    if (spy) {
      if (!spy.orderArgs) spy.orderArgs = [];
      spy.orderArgs.push([col, opts]);
    }
    return chain;
  });
  chain.limit = vi.fn((limit: number) => {
    if (spy) spy.limitArg = limit;
    return chain;
  });
  // Sayfalı okuma (2026-10-05): `range(from, to)` verinin o dilimini döner;
  // `limitArg` istenen satırın üst ucu (to + 1).
  chain.range = vi.fn((from: number, to: number) => {
    if (spy) spy.limitArg = to + 1;
    const res = result as { data?: unknown; error?: unknown };
    if (res.error || !Array.isArray(res.data)) return Promise.resolve(result);
    return Promise.resolve({ ...res, data: res.data.slice(from, to + 1) });
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

describe("homeworkService (v1.4-05 · #273 Ödev Akışı)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  describe("Hata Çevirisi (translateHomeworkError)", () => {
    it("42501 kodunu kullanıcı dostu yetki mesajına çevirir", () => {
      const msg = translateHomeworkError({ code: "42501" });
      expect(msg).toContain("Bu işlem için yetkiniz yok");
      expect(msg).toContain("öğretmeni");
    });

    it("23503 kodunu sınıf veya ders bulunamadı mesajına çevirir", () => {
      const msg = translateHomeworkError({ code: "23503" });
      expect(msg).toContain("Seçilen sınıf veya ders bulunamadı");
    });

    it("23514 kodunda son teslim tarihi kuralını doğru açıklar", () => {
      const msg = translateHomeworkError({
        code: "23514",
        message: "check constraint homework_assignments_due_check violated",
      });
      expect(msg).toBe(
        "Son teslim tarihi ödevin verildiği tarihten önce olamaz."
      );
    });

    it("23514 kodunda başlık uzunluğu kısıtını açıklar", () => {
      const msg = translateHomeworkError({ code: "23514" });
      expect(msg).toBe("Ödev başlığı 1 ile 200 karakter arasında olmalıdır.");
    });
  });

  describe("Yardımcılar (extractClassName, extractSubjectName)", () => {
    it("arşivlenmiş sınıflar için null döner", () => {
      expect(
        extractClassName({ name: "12-A", archived_at: "2026-09-01T00:00:00Z" })
      ).toBeNull();
    });

    it("geçerli sınıf adını kırparak döner", () => {
      expect(extractClassName({ name: "  12-A  ", archived_at: null })).toBe(
        "12-A"
      );
    });

    it("arşivlenmiş dersler için null döner", () => {
      expect(
        extractSubjectName({
          name: "Fizik",
          archived_at: "2026-09-01T00:00:00Z",
        })
      ).toBeNull();
    });

    it("ders yoksa null döner", () => {
      expect(extractSubjectName(null)).toBeNull();
    });
  });

  describe("Ödevi Kimin Verdiği (loadStaffNames & K-22)", () => {
    it("class_staff_names RPC çağrısı ile üyelik adlarını toplar", async () => {
      rpcMock.mockResolvedValueOnce({
        data: [
          {
            class_id: "cls-1",
            membership_id: "mem-1",
            display_name: "Ali Öğretmen",
          },
        ],
        error: null,
      });

      const map = await loadStaffNames(["cls-1"]);
      expect(rpcMock).toHaveBeenCalledWith("class_staff_names", {
        target_class_ids: ["cls-1"],
      });
      expect(map.get("mem-1")).toBe("Ali Öğretmen");
    });

    it("adı çözülemeyen atayan için isim uydurulmaz — null kalır (K-22)", () => {
      const rawRow: RawHomeworkRow = {
        id: "hw-1",
        organization_id: "org-1",
        class_id: "cls-1",
        title: "Test Ödevi",
        assigned_by_membership_id: "unknown-mem",
        assigned_on: "2026-09-10",
        due_date: "2026-09-20",
        classes: { name: "12-A", archived_at: null },
      };

      const emptyStaffMap = new Map<string, string>();
      const mapped = mapHomeworkRow(rawRow, emptyStaffMap, "2026-09-11");
      expect(mapped.assignedBy).toBeNull();

      // Kart render edildiğinde uydurma isim veya sarkan ' · ' bulunmamalı
      const markup = renderToStaticMarkup(
        createElement(HomeworkCard, {
          homework: mapped,
          canSeeClassRatio: true,
        })
      );
      expect(markup).not.toContain("Öğretmen");
      expect(markup).not.toContain("12-A ·");
    });
  });

  describe("Durum Türetimi (mapHomeworkRow)", () => {
    it("vadesi geçmiş ödev Süresi Doldu olarak işaretlenir", () => {
      const rawRow: RawHomeworkRow = {
        id: "hw-past",
        organization_id: "org-1",
        class_id: "cls-1",
        title: "Eski Ödev",
        assigned_on: "2026-09-01",
        due_date: "2026-09-10",
      };
      const mapped = mapHomeworkRow(rawRow, new Map(), "2026-09-11");
      expect(mapped.status).toBe("Süresi Doldu");
    });

    it("vadesi gelmemiş veya bugünkü ödev Aktif olarak işaretlenir", () => {
      const rawRow: RawHomeworkRow = {
        id: "hw-future",
        organization_id: "org-1",
        class_id: "cls-1",
        title: "Gelecek Ödev",
        assigned_on: "2026-09-11",
        due_date: "2026-09-11",
      };
      const mapped = mapHomeworkRow(rawRow, new Map(), "2026-09-11");
      expect(mapped.status).toBe("Aktif");
    });
  });

  describe("createHomework (Tuzak Korumaları)", () => {
    it("kaydetme yükünde id ve assigned_by_membership_id YOKTUR", async () => {
      const spy: { insertArg?: unknown } = {};
      const chain = createQueryChain(
        { data: { id: "new-hw-id" }, error: null },
        spy
      );
      fromMock.mockReturnValueOnce(chain);

      await createHomework({
        organizationId: "org-1",
        classId: "cls-1",
        title: "Kuvvet ve Hareket",
        dueDate: "2026-09-25",
        description: "Problem seti",
      });

      expect(fromMock).toHaveBeenCalledWith("homework_assignments");
      expect(spy.insertArg).toBeDefined();

      const payload = spy.insertArg as Record<string, unknown>;
      // ⛔ 1. YASAK: authenticated için id ve assigned_by_membership_id salt okunurdur
      expect(payload).not.toHaveProperty("id");
      expect(payload).not.toHaveProperty("assigned_by_membership_id");

      // Gönderilen alanlar şemayla uyumlu
      expect(payload.organization_id).toBe("org-1");
      expect(payload.class_id).toBe("cls-1");
      expect(payload.title).toBe("Kuvvet ve Hareket");
      expect(payload.due_date).toBe("2026-09-25");
      expect(payload.description).toBe("Problem seti");
    });
  });

  describe("updateHomework (Yalnız İzin Verilen Beş Sütun ve Etkilenen Satır Kontrolü)", () => {
    it("yalnızca izin verilen 5 sütunu günceller ve açık organization_id + id süzgeci taşır", async () => {
      const spy: {
        updateArg?: unknown;
        eqArgs?: [string, unknown][];
        selectArg?: string;
      } = {};
      const chain = createQueryChain(
        { data: [{ id: "hw-1" }], error: null },
        spy
      );
      fromMock.mockReturnValueOnce(chain);

      await updateHomework("org-1", "hw-1", {
        title: "Yeni Başlık",
        description: "Yeni Açıklama",
        dueDate: "2026-09-30",
        subjectId: "sub-1",
        archivedAt: null,
      });

      expect(fromMock).toHaveBeenCalledWith("homework_assignments");
      const payload = spy.updateArg as Record<string, unknown>;
      const keys = Object.keys(payload);
      expect(
        keys.every(k =>
          [
            "title",
            "description",
            "due_date",
            "subject_id",
            "archived_at",
          ].includes(k)
        )
      ).toBe(true);
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "hw-1"]);
      expect(spy.selectArg).toBe("id");
    });

    it("güncelleme sıfır satır etkilediğinde hata fırlatır (R3 & K-14: gerçekleşmemiş yazma başarılı raporlanmaz)", async () => {
      const chain = createQueryChain({ data: [], error: null });
      fromMock.mockReturnValueOnce(chain);

      await expect(
        updateHomework("org-1", "hw-1", { title: "Test" })
      ).rejects.toThrow("Ödev bulunamadı veya güncellenemedi.");
    });
  });

  describe("archiveHomework & restoreHomework (Açık organizationId, homeworkId ve Satır Kontrolü)", () => {
    it("arşivleme açık (organizationId, homeworkId) ile archived_at sütununa zaman damgası koyar", async () => {
      const spy: {
        updateArg?: unknown;
        eqArgs?: [string, unknown][];
        selectArg?: string;
      } = {};
      const chain = createQueryChain(
        { data: [{ id: "hw-1" }], error: null },
        spy
      );
      fromMock.mockReturnValueOnce(chain);

      await archiveHomework("org-1", "hw-1");
      expect(fromMock).toHaveBeenCalledWith("homework_assignments");
      const payload = spy.updateArg as { archived_at: string };
      expect(payload.archived_at).toBeTruthy();
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "hw-1"]);
      expect(spy.selectArg).toBe("id");
    });

    it("arşivleme sıfır satır etkilediğinde hata fırlatır (R3 & K-14)", async () => {
      const chain = createQueryChain({ data: [], error: null });
      fromMock.mockReturnValueOnce(chain);

      await expect(archiveHomework("org-1", "hw-not-found")).rejects.toThrow(
        "Ödev bulunamadı veya arşivlenemedi."
      );
    });

    it("geri yükleme açık (organizationId, homeworkId) ile archived_at sütununu null yapar", async () => {
      const spy: {
        updateArg?: unknown;
        eqArgs?: [string, unknown][];
        selectArg?: string;
      } = {};
      const chain = createQueryChain(
        { data: [{ id: "hw-1" }], error: null },
        spy
      );
      fromMock.mockReturnValueOnce(chain);

      await restoreHomework("org-1", "hw-1");
      expect(fromMock).toHaveBeenCalledWith("homework_assignments");
      const payload = spy.updateArg as { archived_at: null };
      expect(payload.archived_at).toBeNull();
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "hw-1"]);
      expect(spy.selectArg).toBe("id");
    });

    it("geri yükleme sıfır satır etkilediğinde hata fırlatır (R3 & K-14)", async () => {
      const chain = createQueryChain({ data: [], error: null });
      fromMock.mockReturnValueOnce(chain);

      await expect(restoreHomework("org-1", "hw-not-found")).rejects.toThrow(
        "Ödev bulunamadı veya geri yüklenemedi."
      );
    });
  });

  describe("loadHomework (R1: Açık Limit ve Truncated Bayrağı)", () => {
    it("açık organization_id süzgeci ve due_date artan sıralaması uygular", async () => {
      const spy: {
        eqArgs?: [string, unknown][];
        isArgs?: [string, unknown];
        orderArgs?: [string, { ascending?: boolean }][];
        limitArg?: number;
      } = {};
      const chain = createQueryChain({ data: [], error: null }, spy);
      fromMock.mockReturnValueOnce(chain);

      const result = await loadHomework("org-123");

      expect(fromMock).toHaveBeenCalledWith("homework_assignments");
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-123"]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(spy.orderArgs).toContainEqual(["due_date", { ascending: true }]);
      expect(result.rows).toEqual([]);
      expect(result.truncated).toBe(false);
    });

    it("satır sayısı limite eşitse truncated bayrağı true döner (R1 & K-03 sessiz kesme engeli)", async () => {
      const mockRows = Array.from({ length: 3 }, (_, i) => ({
        id: `hw-${i}`,
        organization_id: "org-1",
        class_id: "cls-1",
        title: `Ödev ${i}`,
        assigned_on: "2026-09-01",
        due_date: "2026-09-10",
      }));
      const spy: { limitArg?: number } = {};
      fromMock.mockReturnValueOnce(
        createQueryChain({ data: mockRows, error: null }, spy)
      );

      const result = await loadHomework("org-1", { limit: 3 });

      expect(result.rows).toHaveLength(3);
      expect(result.truncated).toBe(true);
      expect(spy.limitArg).toBe(3);
    });

    it("satır sayısı limitten azsa truncated bayrağı false döner", async () => {
      const mockRows = [
        {
          id: "hw-1",
          organization_id: "org-1",
          class_id: "cls-1",
          title: "Tek Ödev",
          assigned_on: "2026-09-01",
          due_date: "2026-09-10",
        },
      ];
      fromMock.mockReturnValueOnce(
        createQueryChain({ data: mockRows, error: null })
      );

      const result = await loadHomework("org-1", { limit: 3 });

      expect(result.rows).toHaveLength(1);
      expect(result.truncated).toBe(false);
    });

    it("varsayılan toplam tavan 5000; ilk sayfa READ_PAGE_SIZE ister (2026-10-05)", async () => {
      const spy: { limitArg?: number } = {};
      fromMock.mockReturnValueOnce(
        createQueryChain({ data: [], error: null }, spy)
      );

      await loadHomework("org-1");

      expect(spy.limitArg).toBe(READ_PAGE_SIZE);
      expect(HOMEWORK_TOTAL_CAP).toBe(5000);
    });
  });
});

describe("K-23 Regresyon Korumaları (Arayüz & Şema Sözleşmeleri)", () => {
  it("1. subject_id boş bir ödevde ders rozeti çizilmiyor ve 'Genel' gibi bir etiket yok", () => {
    const hwNoSubject: Homework = {
      id: "hw-genel-yok",
      classGroup: "12-A",
      subject: null,
      subjectId: null,
      title: "Haftalık Çalışma Planı",
      description: "Tüm dersler için haftalık soru hedefi.",
      assignedBy: "Zeynep Hoca",
      assignedDate: "10 Eylül 2026",
      dueDate: "15 Eylül 2026",
      rawDueDate: "2026-09-15",
      status: "Aktif",
    };

    const markup = renderToStaticMarkup(
      createElement(HomeworkCard, { homework: hwNoSubject })
    );

    // K-22: Yokluk etiketi de bir iddiadır. "Genel" uydurulamaz ve ders rozeti hiç çizilmez.
    expect(markup).not.toContain("Genel");
  });

  it("2. Yedinci bir ders adı ('Edebiyat' gibi) tipten geçiyor ve ekranda çiziliyor", () => {
    const hwLiterature: Homework = {
      id: "hw-lit-7",
      classGroup: "11-B",
      subject: "Edebiyat",
      title: "Tanzimat Dönemi Roman İncelemesi",
      description: "İntibah ve Mai ve Siyah karşılaştırması.",
      assignedBy: "Ahmet Hoca",
      assignedDate: "10 Eylül 2026",
      dueDate: "17 Eylül 2026",
      rawDueDate: "2026-09-17",
      status: "Aktif",
    };

    const markup = renderToStaticMarkup(
      createElement(HomeworkCard, { homework: hwLiterature })
    );

    // Yedinci ders rozeti ekranda çizilir
    expect(markup).toContain("Edebiyat");
  });

  it("3. 'Tamamlandı' ekranda hiçbir yerde yok", () => {
    const hwActive: Homework = {
      id: "hw-active",
      classGroup: "12-A",
      subject: "Matematik",
      title: "Türev",
      description: "Test 1",
      assignedBy: "Merve Hoca",
      assignedDate: "10 Eylül 2026",
      dueDate: "15 Eylül 2026",
      rawDueDate: "2026-09-15",
      status: "Aktif",
    };

    const markup = renderToStaticMarkup(
      createElement(HomeworkCard, { homework: hwActive })
    );

    expect(markup).not.toContain("Tamamlandı");
  });

  it("4. v1.4-15: 'Ödev tamamlama' kartı ReportsPage üzerinde hem öğretmen hem yönetici için çizilir", () => {
    const teacherReports = renderToStaticMarkup(
      createElement(ReportsPage, { role: "teacher" })
    );
    const adminReports = renderToStaticMarkup(
      createElement(ReportsPage, { role: "admin" })
    );

    expect(teacherReports).toContain("Ödev tamamlama");
    expect(adminReports).toContain("Ödev tamamlama");
  });

  it("5. R1 regresyonu: truncated: true olduğunda HomeworkPage üst sınır uyarısını ve arşivleme öğüdünü gösterir (K-22)", () => {
    const markup = renderToStaticMarkup(
      createElement(HomeworkPage, {
        role: "teacher",
        truncated: true,
        limit: 100,
      })
    );

    expect(markup).toContain("Liste üst sınıra (100 kayıt) ulaştı.");
    expect(markup).toContain("teslim tarihi geçmiş ödevleri arşivleyin");
    // Bandın öğüdü, ekranda gerçekten yapılabilen bir eylemi göstermeli (K-22,
    // #256'nın dersi) — arşivleme R2'de karta bağlandı, yani öğüt çalışıyor.
    // "Tamamlanan" ise bu dilimde KALDIRILAN kavramdır: teslim takibi yok,
    // dolayısıyla bir ödevin "tamamlandığı" bilinemez.
    expect(markup).not.toContain("tamamlanan");
  });

  it("6. R1 regresyonu: truncated: false olduğunda kesilme bandı çizilmez", () => {
    const markup = renderToStaticMarkup(
      createElement(HomeworkPage, {
        role: "teacher",
        truncated: false,
        limit: 100,
      })
    );

    expect(markup).not.toContain("Liste üst sınıra");
  });

  it("7. R2 regresyonu: yetkili kullanıcı için HomeworkCard üzerinde Düzenle ve Arşivle butonları çizilir", () => {
    const hw: Homework = {
      id: "hw-edit-test",
      classGroup: "12-A",
      subject: "Matematik",
      title: "Trigonometri",
      description: "Test",
      assignedBy: "Merve Hoca",
      assignedDate: "10 Eylül 2026",
      dueDate: "15 Eylül 2026",
      rawDueDate: "2026-09-15",
      status: "Aktif",
    };

    const markup = renderToStaticMarkup(
      createElement(HomeworkCard, {
        homework: hw,
        canSeeClassRatio: true,
        onEdit: vi.fn(),
        onArchive: vi.fn(),
      })
    );

    expect(markup).toContain("Düzenle");
    expect(markup).toContain("Arşivle");
  });

  it("8. R2 regresyonu: öğrenci ve veli için HomeworkCard üzerinde Düzenle ve Arşivle butonları ÇİZİLMEZ", () => {
    const hw: Homework = {
      id: "hw-read-only",
      classGroup: "12-A",
      subject: "Matematik",
      title: "Trigonometri",
      description: "Test",
      assignedBy: "Merve Hoca",
      assignedDate: "10 Eylül 2026",
      dueDate: "15 Eylül 2026",
      rawDueDate: "2026-09-15",
      status: "Aktif",
    };

    const markup = renderToStaticMarkup(
      createElement(HomeworkCard, {
        homework: hw,
        canSeeClassRatio: true,
      })
    );

    expect(markup).not.toContain("Düzenle");
    expect(markup).not.toContain("Arşivle");
  });

  it("9. R2 regresyonu: HomeworkCreateDialog düzenleme modunda 'Ödevi düzenle' ve 'Değişiklikleri kaydet' gösterir", () => {
    const existingHw: Homework = {
      id: "hw-edit-dialog",
      classGroup: "12-A",
      classId: "cls-1",
      subject: "Matematik",
      subjectId: "sub-1",
      title: "Mevcut Ödev",
      description: "Mevcut Açıklama",
      assignedBy: "Merve Hoca",
      assignedDate: "10 Eylül 2026",
      dueDate: "15 Eylül 2026",
      rawDueDate: "2026-09-15",
      status: "Aktif",
    };

    const markup = renderToStaticMarkup(
      createElement(HomeworkCreateDialog, {
        open: true,
        onOpenChange: vi.fn(),
        homework: existingHw,
        organizationId: "org-1",
        classes: [
          {
            id: "cls-1",
            name: "12-A",
            studentCount: 20,
            program: null,
            mentor: null,
            mentorMembershipId: null,
            branch: null,
            branchId: null,
            capacity: null,
          },
        ],
      })
    );

    expect(markup).toContain("Ödevi düzenle");
    expect(markup).toContain("Değişiklikleri kaydet");
    expect(markup).toContain(
      "Sınıf bilgisi ödev oluşturulduktan sonra değiştirilemez."
    );
  });
});

describe("v1.4-15 Ödev Teslim Takibi (homework_submissions & K-23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("translateHomeworkSubmissionError", () => {
    it("ORB02 kodunu 'Öğrenci bu ödevin sınıfına kayıtlı değil.' olarak çevirir", () => {
      const err = {
        code: "ORB02",
        message: "ORB02: constraint failed",
        details: "student_id=c9... class_id=cf...",
      };
      expect(translateHomeworkSubmissionError(err)).toBe(
        "Öğrenci bu ödevin sınıfına kayıtlı değil."
      );
    });

    it("23505 tekil indeks hatasını 'Bu öğrencinin ödev teslimi zaten işaretlenmiş.' olarak çevirir", () => {
      const err = {
        code: "23505",
        message:
          "duplicate key value violates unique constraint homework_submissions_active_idx",
        details: "Key (homework_id, student_id)=(...) already exists.",
      };
      expect(translateHomeworkSubmissionError(err)).toBe(
        "Bu öğrencinin ödev teslimi zaten işaretlenmiş."
      );
    });

    it("42501 yetki hatasını kullanıcı dostu yetki mesajına çevirir", () => {
      const err = {
        code: "42501",
        message: "permission denied for table homework_submissions",
      };
      expect(translateHomeworkSubmissionError(err)).toBe(
        "Bu işlem için yetkiniz yok veya şifre değişimi bekleniyor. Ödev teslimini yalnızca kurum yöneticisi veya sınıfın öğretmeni işaretleyebilir."
      );
    });

    it("⛔ ham details ve veritabanı kısıt adı sızdırılmaz (K-19)", () => {
      const err = {
        code: "ORB02",
        message: "ORB02: constraint failed",
        details:
          "student_id=c9000000-0000-0000-0000-000000000001 ödevin class_id=cf000000-0000-0000-0000-000000000001",
      };
      const result = translateHomeworkSubmissionError(err);
      expect(result).not.toContain("student_id=c9");
      expect(result).not.toContain("class_id=cf");
      expect(result).toBe("Öğrenci bu ödevin sınıfına kayıtlı değil.");
    });
  });

  describe("markSubmission (K-23 Tuzak Korumaları)", () => {
    it("yüke id ve recorded_by_membership_id KOYMAZ; yalnız organization_id, homework_id, student_id gönderir", async () => {
      const spy: { insertArg?: unknown } = {};
      fromMock.mockImplementation(() =>
        createQueryChain({ data: { id: "sub-1" }, error: null }, spy)
      );

      const res = await markSubmission("org-1", "hw-1", "stu-1");

      expect(res).toEqual({ id: "sub-1" });
      const payload = spy.insertArg as Record<string, unknown>;
      expect(payload).toBeDefined();
      expect(payload).toEqual({
        organization_id: "org-1",
        homework_id: "hw-1",
        student_id: "stu-1",
      });
      // ⛔ Sunucu yazar, istemci gönderemez!
      expect(payload).not.toHaveProperty("id");
      expect(payload).not.toHaveProperty("recorded_by_membership_id");
    });
  });

  describe("unmarkSubmission (K-14 ve Arşiv Deseni)", () => {
    it("silme yapmaz, archived_at sütununa zaman damgası koyar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockImplementation(() =>
        createQueryChain({ data: [{ id: "sub-1" }], error: null }, spy)
      );

      await unmarkSubmission("org-1", "sub-1");

      expect(spy.updateArg).toHaveProperty("archived_at");
      expect(
        (spy.updateArg as { archived_at: string }).archived_at
      ).toBeTruthy();
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "sub-1"]);
    });

    it("sıfır satır etkilendiğinde hata fırlatır (K-14: gerçekleşmemiş yazma başarılı raporlanmaz)", async () => {
      fromMock.mockImplementation(() =>
        createQueryChain({ data: [], error: null })
      );

      await expect(unmarkSubmission("org-1", "non-existent")).rejects.toThrow(
        "Ödev teslimi bulunamadı veya işareti kaldırılamadı."
      );
    });
  });

  describe("loadHomeworkSubmissions (Açık Süzgeçler ve Tavan Yönetimi)", () => {
    it("açık organization_id, homework_id ve archived_at süzgeçleri uygular", async () => {
      const spy: {
        eqArgs?: [string, unknown][];
        isArgs?: [string, unknown];
        limitArg?: number;
      } = {};
      fromMock.mockImplementation(() =>
        createQueryChain({ data: [], error: null }, spy)
      );

      const res = await loadHomeworkSubmissions("org-1", "hw-1", { limit: 50 });

      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["homework_id", "hw-1"]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(spy.limitArg).toBe(50);
      expect(res.truncated).toBe(false);
    });

    it("satır sayısı limite eşit olduğunda truncated bayrağı true döner", async () => {
      const mockRows = [
        {
          id: "sub-1",
          organization_id: "org-1",
          homework_id: "hw-1",
          student_id: "stu-1",
          recorded_by_membership_id: "mem-1",
          archived_at: null,
          created_at: "2026-09-13T10:00:00Z",
          updated_at: "2026-09-13T10:00:00Z",
        },
      ];
      fromMock.mockImplementation(() =>
        createQueryChain({ data: mockRows, error: null })
      );

      const res = await loadHomeworkSubmissions("org-1", "hw-1", { limit: 1 });
      expect(res.rows).toHaveLength(1);
      expect(res.truncated).toBe(true);
    });
  });

  describe("setSubmissionsRecorded (v1.4-15 R1: Öğretmen Bitirdiğini Söyler)", () => {
    it("recorded=true olduğunda submissions_recorded_at sütununa zaman damgası koyar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockImplementation(() =>
        createQueryChain(
          {
            data: [
              {
                id: "hw-1",
                submissions_recorded_at: "2026-09-13T12:00:00Z",
              },
            ],
            error: null,
          },
          spy
        )
      );

      const res = await setSubmissionsRecorded("org-1", "hw-1", true);
      expect(res.submissionsRecordedAt).toBeDefined();
      expect(typeof res.submissionsRecordedAt).toBe("string");
      const updatePayload = spy.updateArg as Record<string, unknown>;
      expect(updatePayload).toBeDefined();
      expect(updatePayload.submissions_recorded_at).toBeDefined();
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "hw-1"]);
    });

    it("recorded=false olduğunda submissions_recorded_at sütununu null yapar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockImplementation(() =>
        createQueryChain(
          {
            data: [{ id: "hw-1", submissions_recorded_at: null }],
            error: null,
          },
          spy
        )
      );

      const res = await setSubmissionsRecorded("org-1", "hw-1", false);
      expect(res.submissionsRecordedAt).toBeNull();
      const updatePayload = spy.updateArg as Record<string, unknown>;
      expect(updatePayload.submissions_recorded_at).toBeNull();
    });

    it("sıfır satır etkilendiğinde hata fırlatır (K-14: gerçekleşmemiş yazma başarılı raporlanmaz)", async () => {
      fromMock.mockImplementation(() =>
        createQueryChain({ data: [], error: null })
      );

      await expect(
        setSubmissionsRecorded("org-1", "hw-non-existent", true)
      ).rejects.toThrow(
        "Ödev kaydı bulunamadı veya güncelleme gerçekleştirilemedi."
      );
    });
  });

  describe("loadStudentHomeworkRatios (v1.5-17 · #308: sayım sunucuda)", () => {
    // 🔴 Bu blok v1.5-17'de baştan yazıldı ve eski hali burada anılmaya değer.
    //
    // Önce üç ardışık PostgREST çağrısı vardı (sınıf kayıtları → bitirilmiş
    // ödevler → teslimler) ve testleri o üç `from()` zincirini taklit ediyordu.
    // Sayımın kendisi artık `student_homework_ratios` içinde, SQL'de; sayım
    // kurallarının testi de oraya taşındı: `supabase/tests/database/
    // homework_ratios.test.sql` (14 iddia — yarım işaretlenmiş ödev, kayıt
    // tarihi sınırı, kurum saati, ve dört rolün yetki kesişimi).
    //
    // ⛔ Burada eksilen bir test var ve bilinçli: "herhangi bir sorgu 1.000
    // satır tavanına dayandığında oran üretilmez". O test bir **azaltıcı
    // önlemi** sabitliyordu; önlemin koruduğu kırılma artık yok. Toplama
    // sunucuda yapıldığı için dönen satır sayısı istenen öğrenci sayısına eşit
    // (ekranda en fazla 100) ve tavan devreye giremiyor. Yerine aşağıdaki
    // "tek çağrı" testi kondu: kırılmanın yapısal karşılığı odur.
    // (`loadHomework`'un kendi tavan testi yerinde duruyor — o hâlâ satır
    // çekiyor.)

    it("öğrenci listesi boşsa RPC hiç çağrılmaz", async () => {
      const map = await loadStudentHomeworkRatios([]);
      expect(map.size).toBe(0);
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("🔴 üç tur bire indi: RPC bir kez, bütün kimliklerle çağrılır", async () => {
      rpcMock.mockResolvedValue({
        data: [
          { student_id: "stu-1", recorded_count: 4, submitted_count: 3 },
          { student_id: "stu-2", recorded_count: 2, submitted_count: 0 },
        ],
        error: null,
      });

      await loadStudentHomeworkRatios(["stu-1", "stu-2"]);

      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("student_homework_ratios", {
        target_student_ids: ["stu-1", "stu-2"],
      });
      // Eski hal: üç ardışık `from()` çağrısı. Yenisinde tablo sorgusu yok.
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("sunucunun saydığı değerleri 'pay/payda' biçiminde döndürür", async () => {
      rpcMock.mockResolvedValue({
        data: [
          { student_id: "stu-1", recorded_count: 4, submitted_count: 3 },
          { student_id: "stu-2", recorded_count: 2, submitted_count: 0 },
        ],
        error: null,
      });

      const map = await loadStudentHomeworkRatios(["stu-1", "stu-2"]);
      expect(map.get("stu-1")).toBe("3/4");
      expect(map.get("stu-2")).toBe("0/2");
    });

    it("aynı kimlik iki kez verilse de bir kez sorulur", async () => {
      rpcMock.mockResolvedValue({
        data: [{ student_id: "stu-1", recorded_count: 1, submitted_count: 1 }],
        error: null,
      });

      await loadStudentHomeworkRatios(["stu-1", "stu-1", "", "stu-1"]);

      expect(rpcMock).toHaveBeenCalledWith("student_homework_ratios", {
        target_student_ids: ["stu-1"],
      });
    });

    it("⛔ K-22: sunucunun döndürmediği öğrenci için oran uydurulmaz", async () => {
      rpcMock.mockResolvedValue({
        data: [{ student_id: "stu-1", recorded_count: 3, submitted_count: 1 }],
        error: null,
      });

      const map = await loadStudentHomeworkRatios([
        "stu-1",
        "stu-sorumlulugu-yok",
      ]);
      expect(map.get("stu-1")).toBe("1/3");
      // Sorumluluğu olmayan öğrenci çıktıda hiç yok; "0/0" ÜRETİLMEZ.
      expect(map.get("stu-sorumlulugu-yok")).toBeUndefined();
    });

    it("⛔ payda sıfır gelirse oran üretilmez (0/0 çizilmez)", async () => {
      rpcMock.mockResolvedValue({
        data: [{ student_id: "stu-1", recorded_count: 0, submitted_count: 0 }],
        error: null,
      });

      const map = await loadStudentHomeworkRatios(["stu-1"]);
      expect(map.get("stu-1")).toBeUndefined();
    });

    it("⛔ K-04: RPC hata verirse uydurma oran üretilmez", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      });

      const map = await loadStudentHomeworkRatios(["stu-1"]);
      expect(map.size).toBe(0);
    });

    it("bigint sayılar dizge olarak gelse de doğru okunur", async () => {
      // PostgREST `bigint`'i JSON'da dizge olarak döndürebilir; sayıya
      // çevrilmezse `"3" / "4"` değil `"3/4"` beklenen biçim bozulur.
      rpcMock.mockResolvedValue({
        data: [
          { student_id: "stu-1", recorded_count: "12", submitted_count: "9" },
        ],
        error: null,
      });

      const map = await loadStudentHomeworkRatios(["stu-1"]);
      expect(map.get("stu-1")).toBe("9/12");
    });

    it("⛔ okunamayan sayı gelirse o satır atlanır", async () => {
      rpcMock.mockResolvedValue({
        data: [
          {
            student_id: "stu-bozuk",
            recorded_count: "abc",
            submitted_count: 1,
          },
          { student_id: "stu-1", recorded_count: 2, submitted_count: 2 },
        ],
        error: null,
      });

      const map = await loadStudentHomeworkRatios(["stu-bozuk", "stu-1"]);
      expect(map.get("stu-bozuk")).toBeUndefined();
      expect(map.get("stu-1")).toBe("2/2");
    });
  });

  describe("🔴 R2-B: Üç sorguda sessiz tavan (POSTGREST_MAX_ROWS)", () => {
    it("loadHomework: class_enrollments tavana (1000 satır) ulaştığında totalStudents undefined bırakılır", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "homework_assignments") {
          return createQueryChain({
            data: [
              {
                id: "hw-1",
                organization_id: "org-1",
                class_id: "cls-1",
                title: "Ödev",
                assigned_on: "2026-09-10",
                due_date: "2026-09-20",
                submissions_recorded_at: "2026-09-13T12:00:00Z",
              },
            ],
            error: null,
          });
        }
        if (table === "class_enrollments") {
          // 1000 satır döndürerek tavana ulaşıldığını simüle et
          const fullRows = Array.from({ length: 1000 }, (_, i) => ({
            class_id: "cls-1",
            student_id: `stu-${i}`,
          }));
          return createQueryChain({ data: fullRows, error: null });
        }
        if (table === "homework_submissions") {
          return createQueryChain({ data: [], error: null });
        }
        return createQueryChain({ data: [], error: null });
      });

      const res = await loadHomework("org-1");
      // Tavana ulaşıldığında yarım/kesik sayı üretilmez, undefined bırakılır
      expect(res.rows[0].totalStudents).toBeUndefined();
    });

    it("loadHomework: homework_submissions tavana (1000 satır) ulaştığında submissionCount undefined bırakılır", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "homework_assignments") {
          return createQueryChain({
            data: [
              {
                id: "hw-1",
                organization_id: "org-1",
                class_id: "cls-1",
                title: "Ödev",
                assigned_on: "2026-09-10",
                due_date: "2026-09-20",
                submissions_recorded_at: "2026-09-13T12:00:00Z",
              },
            ],
            error: null,
          });
        }
        if (table === "class_enrollments") {
          return createQueryChain({
            data: [{ class_id: "cls-1", student_id: "stu-1" }],
            error: null,
          });
        }
        if (table === "homework_submissions") {
          const fullRows = Array.from({ length: 1000 }, (_, i) => ({
            homework_id: "hw-1",
            student_id: `stu-${i}`,
          }));
          return createQueryChain({ data: fullRows, error: null });
        }
        return createQueryChain({ data: [], error: null });
      });

      const res = await loadHomework("org-1");
      expect(res.rows[0].submissionCount).toBeUndefined();
    });
  });

  describe("HomeworkCard & Durum 'Tamamlandı'", () => {
    it("🔴 R2-C: submissions_recorded_at boşken submissionCount >= totalStudents olsa bile durum 'Tamamlandı' OLAMAZ", () => {
      const rawRow: RawHomeworkRow = {
        id: "hw-1",
        organization_id: "org-1",
        class_id: "cls-1",
        title: "Test Ödevi",
        assigned_on: "2026-09-10",
        due_date: "2026-09-20",
        submissions_recorded_at: null, // İşaretleme bitmemiş
        archived_at: null,
      };

      // 20 öğrenciden 20'si de teslim edilmiş görünse bile öğretmen bitirmedim dediği sürece Tamamlandı olamaz
      const hw = mapHomeworkRow(rawRow, new Map(), "2026-09-13", 20, 20);
      expect(hw.status).not.toBe("Tamamlandı");
      expect(hw.status).toBe("Aktif");
    });

    it("Ek madde 2: submissions_recorded_at doluyken ve submissionCount === 0 iken 0 korunur", () => {
      const rawRow: RawHomeworkRow = {
        id: "hw-1",
        organization_id: "org-1",
        class_id: "cls-1",
        title: "Test Ödevi",
        assigned_on: "2026-09-10",
        due_date: "2026-09-20",
        submissions_recorded_at: "2026-09-13T12:00:00Z",
        archived_at: null,
      };

      const hw = mapHomeworkRow(rawRow, new Map(), "2026-09-13", 0, 20);
      expect(hw.submissionCount).toBe(0);
    });

    it("🔴 payda UYDURULMAZ: pay paydadan büyük gelirse durum 'Tamamlandı' OLAMAZ", () => {
      // İlk düzeltmede payda `Math.max(totalStudents, submissionCount)` ile
      // şişirilmişti ki kartta "12 / 10" görünmesin. İki kusur üretiyordu:
      //   1. Payda uyduruluyordu (10 aktif + 2 ayrılmış teslimci = gerçekte 12
      //      kişilik kümede "7 / 10" yazıyordu).
      //   2. `submissionCount > totalStudents` olduğu an koşul HER ZAMAN doğru
      //      oluyor ve ödev "Tamamlandı" görünüyordu — sınıfın yarısı
      //      getirmemişken.
      // Payda artık çağıranda BİRLEŞİM olarak kuruluyor; `mapHomeworkRow`'a
      // tutarsız bir çift gelirse uydurmaz, "Tamamlandı" demez.
      const rawRow: RawHomeworkRow = {
        id: "hw-1",
        organization_id: "org-1",
        class_id: "cls-1",
        title: "Test Ödevi",
        assigned_on: "2026-09-10",
        due_date: "2026-09-20",
        submissions_recorded_at: "2026-09-13T12:00:00Z",
        archived_at: null,
      };

      const hw = mapHomeworkRow(rawRow, new Map(), "2026-09-13", 12, 10);
      expect(hw.submissionCount).toBe(12);
      // Payda ŞİŞİRİLMİYOR ve YAYIMLANMIYOR: iki sayı aynı kümeden gelmiyorsa
      // gösterilecek dürüst bir oran yoktur. Kart sayıyı hiç çizmez.
      expect(hw.totalStudents).toBeUndefined();
      expect(hw.status).not.toBe("Tamamlandı");
    });

    it("🔴 tamamlanma sayımı tek veritabanı çağrısından gelir (v1.5-24)", async () => {
      // Birleşim payda (sınıfın etkin öğrencileri ∪ teslim edenler) artık
      // sunucuda; kuralı `homework_completion_counts.test.sql` sınıyor.
      fromMock.mockImplementation(() =>
        createQueryChain({
          data: [
            {
              id: "hw-1",
              organization_id: "org-1",
              class_id: "cls-1",
              title: "Test",
              assigned_on: "2026-09-10",
              due_date: "2026-09-20",
              submissions_recorded_at: "2026-09-13T12:00:00Z",
              archived_at: null,
            },
          ],
          error: null,
        })
      );
      rpcMock.mockImplementation((fn: string) =>
        Promise.resolve(
          fn === "homework_completion_counts"
            ? {
                data: [
                  { homework_id: "hw-1", submitted_count: 2, total_count: "3" },
                ],
                error: null,
              }
            : { data: [], error: null }
        )
      );

      const res = await loadHomework("org-1");

      expect(rpcMock).toHaveBeenCalledWith("homework_completion_counts", {
        target_homework_ids: ["hw-1"],
      });
      // Sınıf kaydı ve teslim tablosu artık istemciden okunmuyor.
      expect(fromMock).not.toHaveBeenCalledWith("class_enrollments");
      expect(fromMock).not.toHaveBeenCalledWith("homework_submissions");
      expect(res.rows[0].submissionCount).toBe(2);
      expect(res.rows[0].totalStudents).toBe(3);
      expect(res.rows[0].status).not.toBe("Tamamlandı");
    });

    it("sayım alınamazsa oran uydurulmaz (ölçülemedi)", async () => {
      fromMock.mockImplementation(() =>
        createQueryChain({
          data: [
            {
              id: "hw-1",
              organization_id: "org-1",
              class_id: "cls-1",
              title: "Test",
              assigned_on: "2026-09-10",
              due_date: "2026-09-20",
              submissions_recorded_at: null,
              archived_at: null,
            },
          ],
          error: null,
        })
      );
      rpcMock.mockImplementation((fn: string) =>
        Promise.resolve(
          fn === "homework_completion_counts"
            ? { data: null, error: { code: "57014" } }
            : { data: [], error: null }
        )
      );

      const res = await loadHomework("org-1");

      expect(res.rows[0].submissionCount).toBeUndefined();
      expect(res.rows[0].totalStudents).toBeUndefined();
    });

    it("ödev tamamlandığında ve işaretleme bitirildiğinde rozet 'Tamamlandı' ve sayı çizilir", () => {
      const hwCompleted: Homework = {
        id: "hw-done",
        classGroup: "12-A",
        subject: "Fizik",
        title: "Dinamik",
        description: "Test",
        assignedDate: "10 Eylül 2026",
        dueDate: "15 Eylül 2026",
        rawDueDate: "2026-09-15",
        status: "Tamamlandı",
        submissionCount: 20,
        totalStudents: 20,
        submissionsRecordedAt: "2026-09-13T12:00:00Z",
      };

      const markup = renderToStaticMarkup(
        createElement(HomeworkCard, {
          homework: hwCompleted,
          canSeeClassRatio: true,
        })
      );

      expect(markup).toContain("Tamamlandı");
      expect(markup).toContain("20 / 20 teslim");
    });

    it("submissionsRecordedAt boşken teslim sayısı hiç çizilmez (R1 & K-22)", () => {
      const hwUnrecorded: Homework = {
        id: "hw-partial",
        classGroup: "12-A",
        subject: "Fizik",
        title: "Dinamik",
        description: "Test",
        assignedDate: "10 Eylül 2026",
        dueDate: "15 Eylül 2026",
        rawDueDate: "2026-09-15",
        status: "Aktif",
        submissionCount: 5,
        totalStudents: 20,
        submissionsRecordedAt: null,
      };

      const markup = renderToStaticMarkup(
        createElement(HomeworkCard, { homework: hwUnrecorded })
      );

      expect(markup).not.toContain("5 / 20 teslim");
      expect(markup).not.toMatch(/\d+\s*\/\s*\d+\s*teslim/);
    });

    it("⛔ teslim sayısı 0 olduğunda ve işaretleme bitmemişken '0/20' veya '0 teslim' uydurulmaz (K-22)", () => {
      const hwNoSubmissions: Homework = {
        id: "hw-empty",
        classGroup: "12-A",
        subject: "Kimya",
        title: "Gazlar",
        description: "Test",
        assignedDate: "10 Eylül 2026",
        dueDate: "15 Eylül 2026",
        rawDueDate: "2026-09-15",
        status: "Aktif",
        submissionCount: 0,
        totalStudents: 20,
        submissionsRecordedAt: null,
      };

      const markup = renderToStaticMarkup(
        createElement(HomeworkCard, { homework: hwNoSubmissions })
      );

      expect(markup).not.toContain("0 / 20 teslim");
      expect(markup).not.toContain("0/20");
      expect(markup).not.toContain("0 teslim");
    });
  });
});
