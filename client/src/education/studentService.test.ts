import { beforeEach, describe, expect, it, vi } from "vitest";
import { READ_PAGE_SIZE } from "@/lib/pagedRead";
import {
  STUDENT_TOTAL_CAP,
  archiveStudent,
  createStudent,
  extractBranchName,
  extractClassName,
  extractGuardianName,
  linkStudentAccount,
  loadStudents,
  mapStudentRow,
  restoreStudent,
  translateStudentError,
  unlinkStudentAccount,
  updateStudent,
} from "./studentService";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args: unknown) => rpcMock(fn, args),
  },
}));

type QueryResult = { data: unknown; error: unknown };

function createQueryChain(
  result: QueryResult,
  spy?: {
    eqArgs?: [string, unknown][];
    orArgs?: string[];
    ilikeArgs?: [string, string][];
    isArgs?: [string, unknown];
    orderArgs?: [string, { ascending?: boolean }];
    limitArg?: number;
    inArgs?: [string, unknown[]];
    insertArg?: unknown;
    updateArg?: unknown;
  }
) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue(Promise.resolve(result));
  chain.insert = vi.fn((payload: unknown) => {
    if (spy) spy.insertArg = payload;
    return chain;
  });
  chain.update = vi.fn((payload: unknown) => {
    if (spy) spy.updateArg = payload;
    return chain;
  });
  chain.eq = vi.fn((col: string, val: unknown) => {
    if (spy) {
      if (!spy.eqArgs) spy.eqArgs = [];
      spy.eqArgs.push([col, val]);
    }
    return chain;
  });
  chain.ilike = vi.fn((col: string, pattern: string) => {
    if (spy) {
      if (!spy.ilikeArgs) spy.ilikeArgs = [];
      spy.ilikeArgs.push([col, pattern]);
    }
    return chain;
  });
  chain.or = vi.fn((filter: string) => {
    if (spy) {
      if (!spy.orArgs) spy.orArgs = [];
      spy.orArgs.push(filter);
    }
    return chain;
  });
  chain.is = vi.fn((col: string, val: unknown) => {
    if (spy) spy.isArgs = [col, val];
    return chain;
  });
  chain.in = vi.fn((col: string, vals: unknown[]) => {
    if (spy) spy.inArgs = [col, vals];
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
  // Sayfalı okuma (2026-10-05): `range(from, to)` verinin o dilimini döner;
  // `limitArg` istenen satırın üst ucu (to + 1).
  chain.range = vi.fn((from: number, to: number) => {
    if (spy) spy.limitArg = to + 1;
    const res = result as { data?: unknown; error?: unknown };
    if (res.error || !Array.isArray(res.data)) return Promise.resolve(result);
    return Promise.resolve({ ...res, data: res.data.slice(from, to + 1) });
  });
  chain.then = (
    resolve: (val: unknown) => unknown,
    reject: (err: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("studentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractBranchName", () => {
    it("nesne olarak gelen şube adını ayıklar", () => {
      expect(extractBranchName({ name: "Kadıköy Şubesi" })).toBe(
        "Kadıköy Şubesi"
      );
    });

    it("dizi olarak gelen şube adını ayıklar", () => {
      expect(extractBranchName([{ name: "Bakırköy Şubesi" }])).toBe(
        "Bakırköy Şubesi"
      );
    });

    it("şube yoksa veya boşsa null döner", () => {
      expect(extractBranchName(null)).toBeNull();
      expect(extractBranchName(undefined)).toBeNull();
      expect(extractBranchName([])).toBeNull();
      expect(extractBranchName({ name: "" })).toBeNull();
    });
  });

  describe("extractClassName", () => {
    it("aktif sınıf kaydını bulur ve sınıf adını döner", () => {
      const enrollments = [
        {
          archived_at: null,
          classes: { name: "12-A Sayısal", archived_at: null },
        },
      ];
      expect(extractClassName(enrollments)).toBe("12-A Sayısal");
    });

    it("arşivlenmiş kayıtları eler ve aktif olanı seçer", () => {
      const enrollments = [
        {
          archived_at: "2026-06-01T00:00:00Z",
          classes: { name: "11-A Sayısal", archived_at: null },
        },
        {
          archived_at: null,
          classes: { name: "12-A Sayısal", archived_at: null },
        },
      ];
      expect(extractClassName(enrollments)).toBe("12-A Sayısal");
    });

    it("aktif kayıt yoksa null döner", () => {
      const enrollments = [
        {
          archived_at: "2026-06-01T00:00:00Z",
          classes: { name: "11-A Sayısal", archived_at: null },
        },
      ];
      expect(extractClassName(enrollments)).toBeNull();
      expect(extractClassName([])).toBeNull();
      expect(extractClassName(null)).toBeNull();
    });

    it("sınıf dizisi içerisindeki ilk geçerli sınıfı döner", () => {
      const enrollments = [
        {
          archived_at: null,
          classes: [{ name: "10-B Eşit Ağırlık", archived_at: null }],
        },
      ];
      expect(extractClassName(enrollments)).toBe("10-B Eşit Ağırlık");
    });
  });

  describe("extractGuardianName", () => {
    it("aktif veli kaydını bulur ve adını döner", () => {
      const links = [
        {
          archived_at: null,
          guardians: { full_name: "Fatma Yılmaz", archived_at: null },
        },
      ];
      expect(extractGuardianName(links)).toBe("Fatma Yılmaz");
    });

    it("birden fazla aktif veli varsa virgülle birleştirir", () => {
      const links = [
        {
          archived_at: null,
          guardians: { full_name: "Ahmet Yılmaz", archived_at: null },
        },
        {
          archived_at: null,
          guardians: { full_name: "Ayşe Yılmaz", archived_at: null },
        },
      ];
      expect(extractGuardianName(links)).toBe("Ahmet Yılmaz, Ayşe Yılmaz");
    });

    it("arşivlenmiş veli kayıtlarını eler", () => {
      const links = [
        {
          archived_at: "2026-05-01T00:00:00Z",
          guardians: { full_name: "Eski Veli", archived_at: null },
        },
        {
          archived_at: null,
          guardians: { full_name: "Aktif Veli", archived_at: null },
        },
      ];
      expect(extractGuardianName(links)).toBe("Aktif Veli");
    });

    it("aktif veli yoksa null döner (K-22: yokluk durumunda dize uydurulmaz)", () => {
      expect(extractGuardianName([])).toBeNull();
      expect(extractGuardianName(null)).toBeNull();
      expect(extractGuardianName(undefined)).toBeNull();
    });
  });

  describe("mapStudentRow", () => {
    it("öğrenci satırını doğru biçimde Student tipine dönüştürür", () => {
      const raw = {
        id: "stu-123",
        full_name: "Mehmet Demir",
        student_number: "2024-001",
        auth_user_id: "auth-user-999",
        branch_id: "branch-abc",
        branches: { name: "Beşiktaş Şubesi" },
        class_enrollments: [
          {
            archived_at: null,
            classes: { name: "12-C", archived_at: null },
          },
        ],
        student_guardians: [
          {
            archived_at: null,
            guardians: { full_name: "Kemal Demir", archived_at: null },
          },
        ],
      };

      const mapped = mapStudentRow(raw, 95, 82, "Güncel");

      expect(mapped).toEqual({
        id: "stu-123",
        name: "Mehmet Demir",
        code: "2024-001",
        hasAccount: true,
        group: "12-C",
        branch: "Beşiktaş Şubesi",
        branchId: "branch-abc",
        parent: "Kemal Demir",
        attendance: 95,
        score: 82,
        payment: "Güncel",
      });
    });

    it("öğrenci numarası ve giriş hesabı olmadığında dürüstçe haritalar (K-22)", () => {
      const raw = {
        id: "stu-456",
        full_name: "Ayşe Kaya",
        student_number: null,
        auth_user_id: null,
        branch_id: null,
        branches: null,
        class_enrollments: [],
        student_guardians: [],
      };

      const mapped = mapStudentRow(raw);

      expect(mapped.code).toBeUndefined();
      expect(mapped.hasAccount).toBe(false);
      expect(mapped.branchId).toBeNull();
      expect(mapped.attendance).toBeUndefined();
      expect(mapped.score).toBeUndefined();
      expect(mapped.payment).toBeUndefined();
      expect(mapped.risk).toBeUndefined();
    });
  });

  describe("translateStudentError", () => {
    it("23505 kodunu kurumda kullanımda olan numara mesajına çevirir", () => {
      const msg = translateStudentError({ code: "23505" });
      expect(msg).toBe(
        "Bu öğrenci numarası kurumda zaten kullanımda. Farklı bir numara girin."
      );
    });

    it("23514 kodunu geçersiz numara biçimi mesajına çevirir", () => {
      const msg = translateStudentError({ code: "23514" });
      expect(msg).toBe(
        "Öğrenci numarası en fazla 32 karakter olmalı, başında ve sonunda boşluk bulunmamalıdır."
      );
    });

    it("42501 kodunu yönetici yetkisi / şifre değişimi mesajına çevirir", () => {
      const msg = translateStudentError({ code: "42501" });
      expect(msg).toBe(
        "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor."
      );
    });

    it("ORB03 kodunu bağlanamaz üyelik mesajına çevirir", () => {
      const msg = translateStudentError({ code: "ORB03" });
      expect(msg).toBe(
        "Bu üyelik bir öğrenci kaydına bağlanamaz. Lütfen aynı kurumda rolü öğrenci olan başka bir üyelik seçin."
      );
    });

    it("ORB04 kodunu zaten bağlı mesajına çevirir", () => {
      const msg = translateStudentError({ code: "ORB04" });
      expect(msg).toBe(
        "Bu kayıt veya hesap zaten başka bir bağa sahip. Önce mevcut bağı çözün."
      );
    });

    it("bilinmeyen hatalarda kullanıcıya ham kod sızdırmaz", () => {
      const msg = translateStudentError({ code: "99999" });
      expect(msg).toBe("İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.");
      expect(msg).not.toContain("99999");
    });
  });

  describe("loadStudents (v1.4-01 açık organization_id ve arama süzgeci)", () => {
    it("açık organization_id süzgeci taşır ve öğrencileri ada göre çeker", async () => {
      const studentRows = [
        {
          id: "stu-1",
          full_name: "Ali Can",
          student_number: "101",
          auth_user_id: "auth-1",
          branch_id: "br-1",
          branches: { name: "Şube 1" },
          class_enrollments: [],
          student_guardians: [],
        },
      ];

      const querySpy: {
        eqArgs?: [string, unknown][];
        orArgs?: string[];
        isArgs?: [string, unknown];
        orderArgs?: [string, { ascending?: boolean }];
        limitArg?: number;
      } = {};

      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({ data: studentRows, error: null }, querySpy);
        }
        return createQueryChain({ data: [], error: null });
      });

      rpcMock.mockImplementation((fn: string) => {
        if (fn === "student_attendance_counts") {
          return Promise.resolve({
            data: [
              {
                student_id: "stu-1",
                present_count: 5,
                late_count: 0,
                absent_count: 0,
              },
            ],
            error: null,
          });
        }
        if (fn === "student_latest_exam_scores") {
          return Promise.resolve({
            data: [{ student_id: "stu-1", score: "88.00" }],
            error: null,
          });
        }
        if (fn === "student_payment_summaries") {
          return Promise.resolve({
            data: [{ student_id: "stu-1", overdue_count: "0" }],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const result = await loadStudents("org-test-1", { limit: 50 });

      expect(fromMock).toHaveBeenCalledWith("students");
      // ROADMAP §4.12, #249: Açık organization_id süzgeci zorunludur
      expect(querySpy.eqArgs).toContainEqual(["organization_id", "org-test-1"]);
      expect(querySpy.isArgs).toEqual(["archived_at", null]);
      expect(querySpy.orderArgs).toEqual(["id", { ascending: true }]); // ad sıralamasından sonra eşitlik bozucu (sayfalı okuma);
      expect(querySpy.limitArg).toBe(50);
      expect(querySpy.orArgs).toBeUndefined();

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Ali Can");
      expect(result.rows[0].code).toBe("101");
      expect(result.rows[0].hasAccount).toBe(true);
      expect(result.rows[0].attendance).toBe(100);
      expect(result.rows[0].score).toBe(88);
      expect(result.rows[0].payment).toBe("Güncel");
      expect(result.truncated).toBe(false);
    });

    it("arama terimi Türkçe arama anahtarında aranır (2026-10-03)", async () => {
      const querySpy: { ilikeArgs?: [string, string][] } = {};

      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({ data: [], error: null }, querySpy);
        }
        return createQueryChain({ data: [], error: null });
      });
      rpcMock.mockResolvedValue({ data: [], error: null });

      await loadStudents("org-test-1", { search: "İlker IŞIK" });

      // "İlker IŞIK" → search_fold → "ilker isik"; sütun ad + numarayı taşır.
      expect(querySpy.ilikeArgs).toContainEqual(["search_key", "%ilker isik%"]);
    });

    it("boşluklu arama terimini kırparak gönderir, salt boşlukta süzgeç eklemez", async () => {
      const querySpy: { ilikeArgs?: [string, string][] } = {};

      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({ data: [], error: null }, querySpy);
        }
        return createQueryChain({ data: [], error: null });
      });
      rpcMock.mockResolvedValue({ data: [], error: null });

      await loadStudents("org-test-1", { search: "   " });
      expect(querySpy.ilikeArgs).toBeUndefined();

      await loadStudents("org-test-1", { search: "  101  " });
      expect(querySpy.ilikeArgs).toContainEqual(["search_key", "%101%"]);
    });

    it("R2 regresyonu: virgül/tırnak/ters bölü ve joker taşıyan terim deseni bozmaz", async () => {
      const querySpy: { ilikeArgs?: [string, string][] } = {};

      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({ data: [], error: null }, querySpy);
        }
        return createQueryChain({ data: [], error: null });
      });
      rpcMock.mockResolvedValue({ data: [], error: null });

      // `.ilike()` tek sütunluk süzgeç: virgül artık mantık ağacını bölemez.
      await loadStudents("org-test-1", { search: "Ali, Veli" });
      expect(querySpy.ilikeArgs).toContainEqual(["search_key", "%ali, veli%"]);

      // Ters bölü, % ve _ kaçırılır; aksi halde joker gibi davranırlardı.
      await loadStudents("org-test-1", { search: 'Test "1" \\ %_' });
      expect(querySpy.ilikeArgs).toContainEqual([
        "search_key",
        '%test "1" \\\\ \\%\\_%',
      ]);
    });

    it("yoklama kaydı, sınavı veya ödeme planı olmayan öğrencinin alanları undefined kalır (K-22)", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({
            data: [
              {
                id: "stu-no-att",
                full_name: "Yeni Öğrenci",
                branches: null,
                class_enrollments: [],
                student_guardians: [],
              },
            ],
            error: null,
          });
        }
        return createQueryChain({ data: [], error: null });
      });

      rpcMock.mockImplementation(() =>
        Promise.resolve({ data: [], error: null })
      );

      const result = await loadStudents("org-test-1");
      expect(result.rows[0].attendance).toBeUndefined();
      expect(result.rows[0].score).toBeUndefined();
      expect(result.rows[0].payment).toBeUndefined();
    });

    it("vadesi geçmiş taksiti olan öğrencinin payment alanı 'Takip gerekli' olur", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({
            data: [
              {
                id: "stu-debtor",
                full_name: "Borçlu Öğrenci",
                branches: null,
                class_enrollments: [],
                student_guardians: [],
              },
            ],
            error: null,
          });
        }
        return createQueryChain({ data: [], error: null });
      });

      rpcMock.mockImplementation((fn: string) => {
        if (fn === "student_payment_summaries") {
          return Promise.resolve({
            data: [{ student_id: "stu-debtor", overdue_count: "2" }],
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const result = await loadStudents("org-test-1");
      expect(result.rows[0].payment).toBe("Takip gerekli");
    });

    it("satır sayısı limite eşitse truncated bayrağı true döner (K-03)", async () => {
      const mockRows = Array.from({ length: 5 }, (_, i) => ({
        id: `stu-${i}`,
        full_name: `Öğrenci ${i}`,
        branches: null,
        class_enrollments: [],
        student_guardians: [],
      }));

      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({ data: mockRows, error: null });
        }
        return createQueryChain({ data: [], error: null });
      });
      rpcMock.mockResolvedValue({ data: [], error: null });

      const result = await loadStudents("org-test-1", { limit: 5 });

      expect(result.rows).toHaveLength(5);
      expect(result.truncated).toBe(true);
    });

    it("varsayılan toplam tavan 5000; ilk sayfa READ_PAGE_SIZE ister (2026-10-05)", async () => {
      const spy: { limitArg?: number } = {};
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({ data: [], error: null }, spy);
        }
        return createQueryChain({ data: [], error: null });
      });
      rpcMock.mockResolvedValue({ data: [], error: null });

      await loadStudents("org-test-1");

      expect(STUDENT_TOTAL_CAP).toBe(5000);
      expect(spy.limitArg).toBe(READ_PAGE_SIZE);
    });

    it("veritabanı hatasında anlamlı Türkçe hata fırlatır (K-04)", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({
            data: null,
            error: { message: "connection refused" },
          });
        }
        return createQueryChain({ data: [], error: null });
      });
      rpcMock.mockResolvedValue({ data: [], error: null });

      await expect(loadStudents("org-test-1")).rejects.toThrow(
        "Öğrenci listesi yüklenemedi."
      );
    });
  });

  describe("createStudent", () => {
    it("öğrenci kaydını doğru alanlarla oluşturur", async () => {
      const spy: { insertArg?: unknown } = {};
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain(
            { data: { id: "new-student-id" }, error: null },
            spy
          );
        }
        return createQueryChain({ data: null, error: null });
      });

      const res = await createStudent({
        organizationId: "org-1",
        branchId: "br-1",
        fullName: "Fatma Demir",
        studentNumber: "105",
      });

      expect(fromMock).toHaveBeenCalledWith("students");
      expect(spy.insertArg).toEqual({
        organization_id: "org-1",
        branch_id: "br-1",
        full_name: "Fatma Demir",
        student_number: "105",
      });
      expect(res).toEqual({ id: "new-student-id" });
    });

    it("numarasız öğrenci eklenebilir", async () => {
      const spy: { insertArg?: unknown } = {};
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain(
            { data: { id: "new-student-id-2" }, error: null },
            spy
          );
        }
        return createQueryChain({ data: null, error: null });
      });

      await createStudent({
        organizationId: "org-1",
        branchId: "br-1",
        fullName: "Numarasız Öğrenci",
      });

      expect(spy.insertArg).toEqual({
        organization_id: "org-1",
        branch_id: "br-1",
        full_name: "Numarasız Öğrenci",
      });
    });

    it("çakışan numarada 23505 hatasını Türkçe mesaja dönüştürür", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({
            data: null,
            error: { code: "23505" },
          });
        }
        return createQueryChain({ data: null, error: null });
      });

      await expect(
        createStudent({
          organizationId: "org-1",
          branchId: "br-1",
          fullName: "Çakışan Öğrenci",
          studentNumber: "101",
        })
      ).rejects.toThrow(
        "Bu öğrenci numarası kurumda zaten kullanımda. Farklı bir numara girin."
      );
    });

    it("biçimsiz numarada 23514 hatasını Türkçe mesaja dönüştürür", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({
            data: null,
            error: { code: "23514" },
          });
        }
        return createQueryChain({ data: null, error: null });
      });

      await expect(
        createStudent({
          organizationId: "org-1",
          branchId: "br-1",
          fullName: "Hatalı Numaralı",
          studentNumber: " 101 ",
        })
      ).rejects.toThrow(
        "Öğrenci numarası en fazla 32 karakter olmalı, başında ve sonunda boşluk bulunmamalıdır."
      );
    });
  });

  describe("updateStudent", () => {
    it("öğrenci bilgilerini günceller ve numarayı sıfırlayabilir", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain(
            { data: [{ id: "etkilenen-satir" }], error: null },
            spy
          );
        }
        return createQueryChain({
          data: [{ id: "etkilenen-satir" }],
          error: null,
        });
      });

      await updateStudent("stu-update-1", {
        fullName: "Yeni Ad Soyad",
        branchId: "br-new",
        studentNumber: null,
      });

      expect(spy.updateArg).toEqual({
        full_name: "Yeni Ad Soyad",
        branch_id: "br-new",
        student_number: null,
      });
      expect(spy.eqArgs).toContainEqual(["id", "stu-update-1"]);
    });

    it("hata durumunda Türkçeleştirilmiş hata fırlatır", async () => {
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain({
            data: null,
            error: { code: "42501" },
          });
        }
        return createQueryChain({ data: null, error: null });
      });

      await expect(
        updateStudent("stu-update-1", { fullName: "Test" })
      ).rejects.toThrow(
        "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor."
      );
    });
  });

  describe("archiveStudent & restoreStudent", () => {
    it("archiveStudent archived_at damgasını yazar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain(
            { data: [{ id: "etkilenen-satir" }], error: null },
            spy
          );
        }
        return createQueryChain({
          data: [{ id: "etkilenen-satir" }],
          error: null,
        });
      });

      await archiveStudent("stu-arch-1");

      expect(spy.updateArg).toHaveProperty("archived_at");
      expect(spy.eqArgs).toContainEqual(["id", "stu-arch-1"]);
    });

    it("restoreStudent archived_at damgasını null yapar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};
      fromMock.mockImplementation((table: string) => {
        if (table === "students") {
          return createQueryChain(
            { data: [{ id: "etkilenen-satir" }], error: null },
            spy
          );
        }
        return createQueryChain({
          data: [{ id: "etkilenen-satir" }],
          error: null,
        });
      });

      await restoreStudent("stu-arch-1");

      expect(spy.updateArg).toEqual({ archived_at: null });
      expect(spy.eqArgs).toContainEqual(["id", "stu-arch-1"]);
    });
  });

  describe("linkStudentAccount & unlinkStudentAccount (RPC çağrıları)", () => {
    it("linkStudentAccount RPC fonksiyonunu doğru argümanlarla çağırır", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });

      await linkStudentAccount("stu-123", "membership-456");

      expect(rpcMock).toHaveBeenCalledWith("link_student_account", {
        target_student_id: "stu-123",
        target_membership_id: "membership-456",
      });
    });

    it("ORB03 hatasında uygun mesajı fırlatır", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { code: "ORB03" },
      });

      await expect(
        linkStudentAccount("stu-123", "membership-456")
      ).rejects.toThrow(
        "Bu üyelik bir öğrenci kaydına bağlanamaz. Lütfen aynı kurumda rolü öğrenci olan başka bir üyelik seçin."
      );
    });

    it("ORB04 hatasında uygun mesajı fırlatır", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { code: "ORB04" },
      });

      await expect(
        linkStudentAccount("stu-123", "membership-456")
      ).rejects.toThrow(
        "Bu kayıt veya hesap zaten başka bir bağa sahip. Önce mevcut bağı çözün."
      );
    });

    it("unlinkStudentAccount RPC fonksiyonunu çağırır", async () => {
      rpcMock.mockResolvedValue({ data: null, error: null });

      await unlinkStudentAccount("stu-123");

      expect(rpcMock).toHaveBeenCalledWith("unlink_student_account", {
        target_student_id: "stu-123",
      });
    });

    it("unlinkStudentAccount yetki hatasında 42501 mesajını fırlatır", async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { code: "42501" },
      });

      await expect(unlinkStudentAccount("stu-123")).rejects.toThrow(
        "Bu işlem için kurum yöneticisi yetkisi gerekiyor veya şifre değişimi bekleniyor."
      );
    });
  });

  // v1.4 ara denetimi · K-14 — bkz. classService.test.ts'teki aynı blok.
  // RLS satırı gizlediğinde `.update()` hata vermez, sessizce sıfır satır
  // günceller; koruma olmadan ekran "arşivlendi" derdi.
  describe("K-14 sıfır satır koruması (v1.4 ara denetimi)", () => {
    const senaryolar: [string, () => Promise<unknown>, string][] = [
      [
        "updateStudent",
        () => updateStudent("ogr-yok", { fullName: "X" }),
        "güncellenemedi",
      ],
      ["archiveStudent", () => archiveStudent("ogr-yok"), "arşivlenemedi"],
      ["restoreStudent", () => restoreStudent("ogr-yok"), "geri yüklenemedi"],
    ];

    for (const [ad, cagir, beklenen] of senaryolar) {
      it(`${ad} sıfır satır etkilediğinde hata fırlatır`, async () => {
        fromMock.mockReturnValue(createQueryChain({ data: [], error: null }));
        await expect(cagir()).rejects.toThrow(beklenen);
      });
    }
  });
});
