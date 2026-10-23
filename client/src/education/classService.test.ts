import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CLASS_LIMIT,
  loadClasses,
  mapClassRow,
  createClass,
  updateClass,
  archiveClass,
  restoreClass,
  loadClassEnrollments,
  enrollStudent,
  unenrollStudent,
  translateClassError,
} from "./classService";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args: unknown) => rpcMock(fn, args),
  },
}));

type QueryResult = { data: unknown; error: unknown };

function createClassQueryChain(
  result: QueryResult,
  spy?: {
    eqArgs?: [string, unknown][];
    isArgs?: [string, unknown];
    orderArgs?: [string, { ascending?: boolean }];
    limitArg?: number;
    insertArg?: unknown;
    updateArg?: unknown;
  }
) {
  const chain: Record<string, unknown> = {};
  if (spy && !spy.eqArgs) spy.eqArgs = [];

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (spy?.eqArgs) spy.eqArgs.push([col, val]);
    return chain;
  });
  chain.is = vi.fn((col: string, val: unknown) => {
    if (spy) spy.isArgs = [col, val];
    return chain;
  });
  chain.order = vi.fn((col: string, opts: { ascending?: boolean }) => {
    if (spy) spy.orderArgs = [col, opts];
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
  chain.single = vi.fn().mockResolvedValue(result);
  chain.in = vi.fn().mockResolvedValue(result);
  chain.then = (
    onfulfilled?: (value: unknown) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onfulfilled, onrejected);

  return chain;
}

describe("classService", () => {
  describe("mapClassRow (Eşleme ve Öğrenci Sayısı)", () => {
    it("yalnızca aktif kayıtları öğrenci sayısına dahil eder", () => {
      const row = {
        id: "class-1",
        name: "YKS Sayısal 12-A",
        program: "YKS",
        mentor_membership_id: "mem-1",
        branch_id: "br-1",
        capacity: 25,
        branches: { name: "Merkez Şube" },
        class_enrollments: [
          { id: "e-1", archived_at: null },
          { id: "e-2", archived_at: "2026-05-01T00:00:00Z" },
          { id: "e-3", archived_at: null },
        ],
      };

      const mentorMap = new Map([["mem-1", "Bahar Aydın"]]);
      const mapped = mapClassRow(row, mentorMap);

      expect(mapped.id).toBe("class-1");
      expect(mapped.name).toBe("YKS Sayısal 12-A");
      expect(mapped.program).toBe("YKS");
      expect(mapped.mentor).toBe("Bahar Aydın");
      expect(mapped.mentorMembershipId).toBe("mem-1");
      expect(mapped.branch).toBe("Merkez Şube");
      expect(mapped.branchId).toBe("br-1");
      expect(mapped.capacity).toBe(25);
      expect(mapped.studentCount).toBe(2);

      // K-03: Türetilmiş alanlar uydurulmaz
      expect(mapped.attendance).toBeUndefined();
      expect(mapped.nextLesson).toBeUndefined();
    });

    it("mentor veya şube atanmadığında alanlar null döner", () => {
      const row = {
        id: "class-2",
        name: "LGS 8-B",
        program: null,
        mentor_membership_id: null,
        branch_id: null,
        capacity: null,
        branches: null,
        class_enrollments: [],
      };

      const mapped = mapClassRow(row, new Map());

      expect(mapped.program).toBeNull();
      expect(mapped.mentor).toBeNull();
      expect(mapped.mentorMembershipId).toBeNull();
      expect(mapped.branch).toBeNull();
      expect(mapped.branchId).toBeNull();
      expect(mapped.capacity).toBeNull();
      expect(mapped.studentCount).toBe(0);
    });
  });

  describe("loadClasses (Sorgu ve Kesilme Sözleşmesi)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      rpcMock.mockResolvedValue({ data: [], error: null });
    });

    it("sınıfları ada göre artan sırada, kurum ve arşiv filtresiyle çeker (ROADMAP §4.12, #249)", async () => {
      const spy: {
        eqArgs?: [string, unknown][];
        isArgs?: [string, unknown];
        orderArgs?: [string, { ascending?: boolean }];
        limitArg?: number;
      } = {};

      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: [
              {
                id: "cls-1",
                name: "YKS 12-A",
                program: "YKS",
                mentor_membership_id: null,
                class_enrollments: [],
              },
            ],
            error: null,
          },
          spy
        )
      );

      const result = await loadClasses("org-123", { limit: 50 });

      expect(fromMock).toHaveBeenCalledWith("classes");
      expect(rpcMock).toHaveBeenCalledWith("class_staff_names", {
        target_class_ids: ["cls-1"],
      });
      expect(spy.eqArgs).toEqual([["organization_id", "org-123"]]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(spy.orderArgs).toEqual(["name", { ascending: true }]);
      expect(spy.limitArg).toBe(50);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("YKS 12-A");
      expect(result.truncated).toBe(false);
    });

    it("satır sayısı limite eşitse truncated bayrağı true döner (K-03)", async () => {
      const mockRows = Array.from({ length: 3 }, (_, i) => ({
        id: `cls-${i}`,
        name: `Sınıf ${i}`,
        program: "YKS",
        mentor_membership_id: null,
        class_enrollments: [],
      }));

      fromMock.mockReturnValue(
        createClassQueryChain({
          data: mockRows,
          error: null,
        })
      );

      const result = await loadClasses("org-123", { limit: 3 });

      expect(result.rows).toHaveLength(3);
      expect(result.truncated).toBe(true);
    });

    it("varsayılan üst sınır 100'dür", async () => {
      const spy: { limitArg?: number } = {};
      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: [],
            error: null,
          },
          spy
        )
      );

      await loadClasses("org-123");

      expect(spy.limitArg).toBe(DEFAULT_CLASS_LIMIT);
    });

    it("veritabanı hatasında anlamlı Türkçe hata fırlatır (K-04)", async () => {
      fromMock.mockReturnValue(
        createClassQueryChain({
          data: null,
          error: { message: "timeout" },
        })
      );

      await expect(loadClasses("org-123")).rejects.toThrow(
        "Sınıf listesi yüklenemedi."
      );
    });
  });

  describe("createClass & updateClass & archiveClass & restoreClass", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("createClass geçerli parametrelerle sınıf oluşturur", async () => {
      const spy: { insertArg?: unknown } = {};
      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: { id: "cls-new" },
            error: null,
          },
          spy
        )
      );

      const res = await createClass({
        organizationId: "org-1",
        branchId: "br-1",
        name: "11-A Sayısal",
        program: "YKS",
        mentorMembershipId: "mem-1",
        capacity: 20,
      });

      expect(fromMock).toHaveBeenCalledWith("classes");
      expect(spy.insertArg).toEqual({
        organization_id: "org-1",
        branch_id: "br-1",
        name: "11-A Sayısal",
        program: "YKS",
        mentor_membership_id: "mem-1",
        capacity: 20,
      });
      expect(res.id).toBe("cls-new");
    });

    it("updateClass sınıfı günceller", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: [{ id: "etkilenen-satir" }],
            error: null,
          },
          spy
        )
      );

      await updateClass("cls-1", {
        name: "11-A Eşit Ağırlık",
        capacity: 24,
      });

      expect(fromMock).toHaveBeenCalledWith("classes");
      expect(spy.updateArg).toEqual({
        name: "11-A Eşit Ağırlık",
        capacity: 24,
      });
      expect(spy.eqArgs).toEqual([["id", "cls-1"]]);
    });

    it("archiveClass sınıfı silmez, archived_at damgasını doldurur", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: [{ id: "etkilenen-satir" }],
            error: null,
          },
          spy
        )
      );

      await archiveClass("cls-1");

      expect(fromMock).toHaveBeenCalledWith("classes");
      expect(spy.updateArg).toHaveProperty("archived_at");
      expect(
        (spy.updateArg as { archived_at: string }).archived_at
      ).toBeDefined();
      expect(spy.eqArgs).toEqual([["id", "cls-1"]]);
    });

    it("restoreClass archived_at değerini null yapar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: [{ id: "etkilenen-satir" }],
            error: null,
          },
          spy
        )
      );

      await restoreClass("cls-1");

      expect(fromMock).toHaveBeenCalledWith("classes");
      expect(spy.updateArg).toEqual({ archived_at: null });
      expect(spy.eqArgs).toEqual([["id", "cls-1"]]);
    });
  });

  describe("class_enrollments (loadClassEnrollments, enrollStudent, unenrollStudent)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("loadClassEnrollments kayıtlı öğrencileri çeker ve eşler", async () => {
      const spy: {
        eqArgs?: [string, unknown][];
        isArgs?: [string, unknown];
      } = {};
      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: [
              {
                id: "enr-1",
                class_id: "cls-1",
                student_id: "stu-1",
                created_at: "2026-09-01T10:00:00Z",
                archived_at: null,
                students: {
                  full_name: "Ali Veli",
                  student_number: "201",
                },
              },
            ],
            error: null,
          },
          spy
        )
      );

      const enrollments = await loadClassEnrollments("org-1", "cls-1");

      expect(fromMock).toHaveBeenCalledWith("class_enrollments");
      expect(spy.eqArgs).toEqual([
        ["organization_id", "org-1"],
        ["class_id", "cls-1"],
      ]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(enrollments).toHaveLength(1);
      expect(enrollments[0].studentName).toBe("Ali Veli");
      expect(enrollments[0].studentNumber).toBe("201");
    });

    it("öğrenci satırı okunamadığında ad için etiket uydurmaz, null döner", () => {
      // Boş gelmesinin üç sebebi var (kayıt yok · RLS satırı vermedi · henüz
      // türetilmedi) ve uydurulmuş bir etiket üçünü birden birinciye indirir.
      // Servis null döner; ne gösterileceğine ekran karar verir.
      fromMock.mockReturnValue(
        createClassQueryChain({
          data: [
            {
              id: "enr-2",
              class_id: "cls-1",
              student_id: "stu-gizli",
              created_at: "2026-09-01T10:00:00Z",
              archived_at: null,
              students: null,
            },
          ],
          error: null,
        })
      );

      return loadClassEnrollments("org-1", "cls-1").then(enrollments => {
        expect(enrollments[0].studentName).toBeNull();
        expect(enrollments[0].studentNumber).toBeNull();
      });
    });

    it("enrollStudent öğrenciyi sınıfa kaydeder", async () => {
      const spy: { insertArg?: unknown } = {};
      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: { id: "enr-new" },
            error: null,
          },
          spy
        )
      );

      const res = await enrollStudent({
        organizationId: "org-1",
        classId: "cls-1",
        studentId: "stu-1",
      });

      expect(fromMock).toHaveBeenCalledWith("class_enrollments");
      expect(spy.insertArg).toEqual({
        organization_id: "org-1",
        class_id: "cls-1",
        student_id: "stu-1",
      });
      expect(res.id).toBe("enr-new");
    });

    it("unenrollStudent kaydı silmez, archived_at damgasını doldurur", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockReturnValue(
        createClassQueryChain(
          {
            data: [{ id: "etkilenen-satir" }],
            error: null,
          },
          spy
        )
      );

      await unenrollStudent("enr-1");

      expect(fromMock).toHaveBeenCalledWith("class_enrollments");
      expect(spy.updateArg).toHaveProperty("archived_at");
      expect(spy.eqArgs).toEqual([["id", "enr-1"]]);
    });
  });

  describe("translateClassError (Hata Çevirisi)", () => {
    it("23505 sınıf bağlamında 'Bu isimde bir sınıf bu kurumda zaten var' döner", () => {
      const err = { code: "23505", message: "duplicate key value" };
      expect(translateClassError(err, "class")).toBe(
        "Bu isimde bir sınıf bu kurumda zaten var (büyük/küçük harf fark etmez). Farklı bir sınıf adı girin."
      );
    });

    it("23505 kayıt bağlamında 'Bu öğrenci zaten bu sınıfa kayıtlı' döner", () => {
      const err = { code: "23505", message: "duplicate key value" };
      expect(translateClassError(err, "enrollment")).toBe(
        "Bu öğrenci zaten bu sınıfa kayıtlı."
      );
    });

    it("23514 sınıf bağlamında kontenjan ve ad kısıtını bildirir", () => {
      const err = { code: "23514", message: "check constraint failed" };
      expect(translateClassError(err, "class")).toBe(
        "Sınıf adı 1-120 karakter arasında olmalı veya kontenjan 1 ile 1000 arasında bir sayı olmalıdır."
      );
    });

    it("ORB03 mentor kısıtını bildirir", () => {
      const err = { code: "ORB03", message: "ORB03 mentor role check" };
      expect(translateClassError(err, "class")).toBe(
        "Rehber öğretmen olarak yalnızca öğretmen veya yönetici rolündeki bir üye seçilebilir."
      );
    });

    it("42501 yetki yetersizliğini bildirir", () => {
      const err = { code: "42501", message: "permission denied" };
      expect(translateClassError(err, "class")).toBe(
        "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor."
      );
    });
  });

  // =========================================================================
  // v1.4 ara denetimi · K-14 — sıfır satır etkileyen yazma "oldu" demez
  // =========================================================================
  //
  // Bu koruma v1.4-05'ten sonraki servislerde vardı, öncekilerde yoktu; ara
  // denetim turu (2026-09-13) farkı ölçtü ve hizaladı. Önemi somut: RLS satırı
  // gizlediğinde `.update()` HATA VERMEZ, sessizce sıfır satır günceller —
  // ekran da "arşivlendi" derdi.
  describe("K-14 sıfır satır koruması (v1.4 ara denetimi)", () => {
    const senaryolar: [string, () => Promise<unknown>, string][] = [
      [
        "updateClass",
        () => updateClass("cls-yok", { name: "X" }),
        "güncellenemedi",
      ],
      ["archiveClass", () => archiveClass("cls-yok"), "arşivlenemedi"],
      ["restoreClass", () => restoreClass("cls-yok"), "geri yüklenemedi"],
      ["unenrollStudent", () => unenrollStudent("kayit-yok"), "kaldırılamadı"],
    ];

    for (const [ad, cagir, beklenen] of senaryolar) {
      it(`${ad} sıfır satır etkilediğinde hata fırlatır`, async () => {
        fromMock.mockReturnValue(
          createClassQueryChain({ data: [], error: null })
        );
        await expect(cagir()).rejects.toThrow(beklenen);
      });
    }
  });
});
