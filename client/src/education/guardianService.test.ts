import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GUARDIAN_TOTAL_CAP,
  archiveGuardian,
  createGuardian,
  extractActiveStudentNames,
  linkGuardianAccount,
  linkStudentGuardian,
  loadGuardians,
  loadStudentGuardianLinks,
  mapGuardianRow,
  restoreGuardian,
  restoreStudentGuardianLink,
  translateGuardianError,
  unlinkGuardianAccount,
  unlinkStudentGuardian,
  updateGuardian,
  type RawGuardianRow,
} from "./guardianService";

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
    insertArg?: unknown;
    updateArg?: unknown;
    selectArg?: string;
  }
) {
  const chain: Record<string, unknown> = {};

  chain.select = vi.fn((sel?: string) => {
    if (spy && sel) spy.selectArg = sel;
    return chain;
  });
  chain.single = vi.fn().mockReturnValue(Promise.resolve(result));
  chain.maybeSingle = vi.fn().mockReturnValue(Promise.resolve(result));
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
  chain.order = vi.fn((col: string, opts: { ascending?: boolean }) => {
    if (spy) spy.orderArgs = [col, opts];
    return chain;
  });
  chain.limit = vi.fn((lim: number) => {
    if (spy) spy.limitArg = lim;
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

  // Thenable for queries ending with select() after update/delete
  chain.then = (
    resolve: (v: unknown) => unknown,
    reject: (err: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);

  return chain;
}

describe("guardianService (v1.4-10 · #275)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("translateGuardianError", () => {
    it("42501 için kurum yöneticisi yetkisi mesajı döner", () => {
      const msg = translateGuardianError({ code: "42501" });
      expect(msg).toContain("kurum yöneticisi yetkisi gerekiyor");
    });

    it("23505 için bağ/kayıt zaten mevcut mesajı döner", () => {
      const msg = translateGuardianError({ code: "23505" });
      expect(msg).toContain("zaten mevcut");
    });

    it("23514 guardians_phone_check hatasında telefon kuralını söyler", () => {
      const msg = translateGuardianError({
        code: "23514",
        message: "check constraint guardians_phone_check",
      });
      expect(msg).toContain("en az 7, en fazla 30");
    });

    it("23514 guardians_full_name_check hatasında isim kuralını söyler", () => {
      const msg = translateGuardianError({
        code: "23514",
        message: "check constraint guardians_full_name_check",
      });
      expect(msg).toContain("1 ile 120");
    });

    it("23503 için veli veya üyelik bulunamadı mesajı döner", () => {
      const msg = translateGuardianError({ code: "23503" });
      expect(msg).toContain("bulunamadı");
    });

    it("ORB03 için parent rolü şartını söyler", () => {
      const msg = translateGuardianError({ code: "ORB03" });
      expect(msg).toContain("rolü veli olan");
    });

    it("ORB04 için mevcut bağı çözme öğüdü verir", () => {
      const msg = translateGuardianError({ code: "ORB04" });
      expect(msg).toContain("Önce mevcut bağı çözün");
    });

    it("Tanınmayan hatada genel mesaj döner", () => {
      const msg = translateGuardianError(new Error("PGRST301 internal"));
      expect(msg).toBe("İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.");
    });
  });

  describe("extractActiveStudentNames ve mapGuardianRow", () => {
    it("aktif bağlı öğrencilerin adlarını toplar, arşivli olanları eler", () => {
      const links = [
        {
          id: "link-1",
          archived_at: null,
          students: { id: "s-1", full_name: "Ali Veli", archived_at: null },
        },
        {
          id: "link-2",
          archived_at: "2026-09-01T00:00:00Z",
          students: { id: "s-2", full_name: "Ayşe Kaya", archived_at: null },
        },
        {
          id: "link-3",
          archived_at: null,
          students: {
            id: "s-3",
            full_name: "Eski Öğrenci",
            archived_at: "2026-08-01T00:00:00Z",
          },
        },
      ];

      const names = extractActiveStudentNames(links);
      expect(names).toEqual(["Ali Veli"]);
    });

    it("mapGuardianRow bağlı hesap ve öğrenci sayısını türetir", () => {
      const raw: RawGuardianRow = {
        id: "g-1",
        organization_id: "org-1",
        full_name: "Fatma Demir",
        phone: "0532 111 22 33",
        auth_user_id: "user-1",
        student_guardians: [
          {
            id: "link-1",
            archived_at: null,
            students: { id: "s-1", full_name: "Ece Demir", archived_at: null },
          },
        ],
      };

      const mapped = mapGuardianRow(raw);
      expect(mapped.hasAccount).toBe(true);
      expect(mapped.phone).toBe("0532 111 22 33");
      expect(mapped.studentCount).toBe(1);
      expect(mapped.studentNames).toEqual(["Ece Demir"]);
    });

    it("hesabı olmayan velide hasAccount false ve authUserId null döner (K-22)", () => {
      const raw: RawGuardianRow = {
        id: "g-2",
        organization_id: "org-1",
        full_name: "Hesapsız Veli",
        phone: null,
        auth_user_id: null,
        student_guardians: [],
      };

      const mapped = mapGuardianRow(raw);
      expect(mapped.hasAccount).toBe(false);
      expect(mapped.authUserId).toBeNull();
      expect(mapped.phone).toBeNull();
      expect(mapped.studentCount).toBe(0);
    });
  });

  describe("loadGuardians", () => {
    it("açık organization_id süzgeci taşır ve arşivli olmayanları ada göre sıralar", async () => {
      const spy: {
        eqArgs?: [string, unknown][];
        isArgs?: [string, unknown];
        orderArgs?: [string, { ascending?: boolean }];
        limitArg?: number;
      } = {};

      fromMock.mockReturnValue(
        createQueryChain(
          {
            data: [
              {
                id: "g-1",
                organization_id: "org-1",
                full_name: "Ahmet Veli",
                phone: "0532 000 00 00",
                auth_user_id: null,
                student_guardians: [],
              },
            ],
            error: null,
          },
          spy
        )
      );

      const result = await loadGuardians("org-1", { limit: 50 });

      expect(fromMock).toHaveBeenCalledWith("guardians");
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(spy.orderArgs).toEqual(["id", { ascending: true }]); // ad sıralamasından sonra eşitlik bozucu (sayfalı okuma);
      expect(spy.limitArg).toBe(50);
      expect(result.rows).toHaveLength(1);
      expect(result.truncated).toBe(false);
    });

    it("arama terimi verildiğinde ad ve telefona göre süzgeç ekler", async () => {
      const spy: { ilikeArgs?: [string, string][] } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: [], error: null }, spy)
      );

      // search_key = search_fold(ad + telefon): telefon parçası da, Türkçe
      // harfsiz yazılmış ad da bulunur (2026-10-03).
      await loadGuardians("org-1", { search: "532" });
      expect(spy.ilikeArgs).toContainEqual(["search_key", "%532%"]);

      await loadGuardians("org-1", { search: "Çağrı" });
      expect(spy.ilikeArgs).toContainEqual(["search_key", "%cagri%"]);
    });

    it("veli listesinin toplam tavanı 5000 (2026-10-05, sayfalı okuma)", () => {
      expect(GUARDIAN_TOTAL_CAP).toBe(5000);
    });

    it("satır sayısı limite ulaştığında truncated true döner", async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        id: `g-${i}`,
        organization_id: "org-1",
        full_name: `Veli ${i}`,
        phone: null,
        auth_user_id: null,
        student_guardians: [],
      }));

      fromMock.mockReturnValue(createQueryChain({ data: rows, error: null }));

      const result = await loadGuardians("org-1", { limit: 10 });
      expect(result.truncated).toBe(true);
    });
  });

  describe("createGuardian — K-23 & K-14 Güvencesi", () => {
    it("kaydetme yükünde id ve auth_user_id KESİNLİKLE bulunmaz", async () => {
      const spy: { insertArg?: unknown } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: { id: "new-g-1" }, error: null }, spy)
      );

      const res = await createGuardian({
        organizationId: "org-1",
        fullName: "Yeni Veli",
        phone: "0532 111 22 33",
      });

      expect(res.id).toBe("new-g-1");
      expect(spy.insertArg).toEqual({
        organization_id: "org-1",
        full_name: "Yeni Veli",
        phone: "0532 111 22 33",
      });

      const payload = spy.insertArg as Record<string, unknown>;
      expect(payload).not.toHaveProperty("id");
      expect(payload).not.toHaveProperty("auth_user_id");
    });

    it("boş veya boşluklardan oluşan telefon null'a çevrilir (check constraint koruması)", async () => {
      const spy: { insertArg?: unknown } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: { id: "new-g-2" }, error: null }, spy)
      );

      await createGuardian({
        organizationId: "org-1",
        fullName: "Telefonsuz Veli",
        phone: "   ",
      });

      const payload = spy.insertArg as Record<string, unknown>;
      expect(payload.phone).toBeNull();
    });

    it("biçimi alışılmadık / uluslararası numara (+49 170 1234567) olduğu gibi korunur", async () => {
      const spy: { insertArg?: unknown } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: { id: "new-g-3" }, error: null }, spy)
      );

      await createGuardian({
        organizationId: "org-1",
        fullName: "Yurt Dışı Veli",
        phone: "+49 170 1234567",
      });

      const payload = spy.insertArg as Record<string, unknown>;
      expect(payload.phone).toBe("+49 170 1234567");
    });
  });

  describe("updateGuardian — K-23 & K-14 Güvencesi", () => {
    it("güncelleme yükünde id, auth_user_id ve organization_id bulunmaz", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: [{ id: "g-1" }], error: null }, spy)
      );

      await updateGuardian("org-1", "g-1", {
        fullName: "Güncel Veli",
        phone: "+90 532 999 88 77",
      });

      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "g-1"]);

      const payload = spy.updateArg as Record<string, unknown>;
      expect(payload).toEqual({
        full_name: "Güncel Veli",
        phone: "+90 532 999 88 77",
      });
      expect(payload).not.toHaveProperty("id");
      expect(payload).not.toHaveProperty("auth_user_id");
      expect(payload).not.toHaveProperty("organization_id");
    });

    it("sıfır satır etkileyen güncelleme hata fırlatır (K-14)", async () => {
      fromMock.mockReturnValue(createQueryChain({ data: [], error: null }));

      await expect(
        updateGuardian("org-1", "non-existent", { fullName: "Test" })
      ).rejects.toThrow("Veli kaydı bulunamadı veya güncellenemedi.");
    });
  });

  describe("archiveGuardian ve restoreGuardian — K-14 Güvencesi", () => {
    it("archiveGuardian açık organization_id ile archived_at zaman damgası koyar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: [{ id: "g-1" }], error: null }, spy)
      );

      await archiveGuardian("org-1", "g-1");

      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "g-1"]);
      expect(spy.updateArg).toEqual({ archived_at: expect.any(String) });
    });

    it("archiveGuardian sıfır satır etkilediğinde hata fırlatır (K-14)", async () => {
      fromMock.mockReturnValue(createQueryChain({ data: [], error: null }));

      await expect(archiveGuardian("org-1", "g-1")).rejects.toThrow(
        "Veli kaydı bulunamadı veya arşivlenemedi."
      );
    });

    it("restoreGuardian açık organization_id ile archived_at'i null yapar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: [{ id: "g-1" }], error: null }, spy)
      );

      await restoreGuardian("org-1", "g-1");

      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "g-1"]);
      expect(spy.updateArg).toEqual({ archived_at: null });
    });

    it("restoreGuardian sıfır satır etkilediğinde hata fırlatır (K-14)", async () => {
      fromMock.mockReturnValue(createQueryChain({ data: [], error: null }));

      await expect(restoreGuardian("org-1", "g-1")).rejects.toThrow(
        "Veli kaydı bulunamadı veya geri yüklenemedi."
      );
    });
  });

  describe("linkGuardianAccount ve unlinkGuardianAccount", () => {
    it("linkGuardianAccount doğru RPC argümanlarını geçer", async () => {
      rpcMock.mockReturnValue(Promise.resolve({ error: null }));

      await linkGuardianAccount("g-1", "mem-1");

      expect(rpcMock).toHaveBeenCalledWith("link_guardian_account", {
        target_guardian_id: "g-1",
        target_membership_id: "mem-1",
      });
    });

    it("unlinkGuardianAccount doğru RPC argümanını geçer", async () => {
      rpcMock.mockReturnValue(Promise.resolve({ error: null }));

      await unlinkGuardianAccount("g-1");

      expect(rpcMock).toHaveBeenCalledWith("unlink_guardian_account", {
        target_guardian_id: "g-1",
      });
    });
  });

  describe("student_guardians bağlama ve bağ koparma işlemleri", () => {
    it("loadStudentGuardianLinks aktif bağları döner", async () => {
      const spy: { eqArgs?: [string, unknown][]; isArgs?: [string, unknown] } =
        {};

      fromMock.mockReturnValue(
        createQueryChain(
          {
            data: [
              {
                id: "link-1",
                organization_id: "org-1",
                student_id: "stu-1",
                guardian_id: "g-1",
                archived_at: null,
                guardians: {
                  id: "g-1",
                  full_name: "Anne Veli",
                  phone: "0532 111 22 33",
                  auth_user_id: "user-1",
                  archived_at: null,
                },
              },
            ],
            error: null,
          },
          spy
        )
      );

      const links = await loadStudentGuardianLinks("org-1", "stu-1");

      expect(fromMock).toHaveBeenCalledWith("student_guardians");
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["student_id", "stu-1"]);
      expect(spy.isArgs).toEqual(["archived_at", null]);
      expect(links).toHaveLength(1);
      expect(links[0].guardian?.fullName).toBe("Anne Veli");
      expect(links[0].guardian?.hasAccount).toBe(true);
    });

    it("linkStudentGuardian yeni bağ ekler", async () => {
      // 1. Check existing -> null
      // 2. Insert -> new link
      let callCount = 0;
      fromMock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // maybeSingle call for existing link check
          return createQueryChain({ data: null, error: null });
        }
        // insert call
        return createQueryChain({ data: { id: "new-link-1" }, error: null });
      });

      const res = await linkStudentGuardian("org-1", "stu-1", "g-1");
      expect(res.id).toBe("new-link-1");
    });

    it("linkStudentGuardian önceden arşivlenmiş bağı yeniden canlandırır", async () => {
      let callCount = 0;
      const updateSpy: { updateArg?: unknown } = {};
      fromMock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createQueryChain({
            data: { id: "old-link-1", archived_at: "2026-09-01T00:00:00Z" },
            error: null,
          });
        }
        return createQueryChain(
          { data: [{ id: "old-link-1" }], error: null },
          updateSpy
        );
      });

      const res = await linkStudentGuardian("org-1", "stu-1", "g-1");
      expect(res.id).toBe("old-link-1");
      expect(updateSpy.updateArg).toEqual({ archived_at: null });
    });

    it("linkStudentGuardian zaten aktif bağ varsa hata fırlatır", async () => {
      fromMock.mockReturnValue(
        createQueryChain({
          data: { id: "active-link", archived_at: null },
          error: null,
        })
      );

      await expect(
        linkStudentGuardian("org-1", "stu-1", "g-1")
      ).rejects.toThrow("Bu veli bu öğrenciye zaten bağlı.");
    });

    it("unlinkStudentGuardian satır silmez, archived_at zaman damgası koyar", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: [{ id: "link-1" }], error: null }, spy)
      );

      await unlinkStudentGuardian("org-1", "link-1");

      expect(fromMock).toHaveBeenCalledWith("student_guardians");
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "link-1"]);
      expect(spy.updateArg).toEqual({ archived_at: expect.any(String) });
    });

    it("unlinkStudentGuardian sıfır satır etkilediğinde hata fırlatır (K-14)", async () => {
      fromMock.mockReturnValue(createQueryChain({ data: [], error: null }));

      await expect(
        unlinkStudentGuardian("org-1", "non-existent")
      ).rejects.toThrow("Öğrenci–veli bağı bulunamadı veya koparılamadı.");
    });

    it("restoreStudentGuardianLink archived_at'i null yaparak geri yükler", async () => {
      const spy: { updateArg?: unknown; eqArgs?: [string, unknown][] } = {};

      fromMock.mockReturnValue(
        createQueryChain({ data: [{ id: "link-1" }], error: null }, spy)
      );

      await restoreStudentGuardianLink("org-1", "link-1");

      expect(fromMock).toHaveBeenCalledWith("student_guardians");
      expect(spy.eqArgs).toContainEqual(["organization_id", "org-1"]);
      expect(spy.eqArgs).toContainEqual(["id", "link-1"]);
      expect(spy.updateArg).toEqual({ archived_at: null });
    });

    it("restoreStudentGuardianLink sıfır satır etkilediğinde hata fırlatır (K-14)", async () => {
      fromMock.mockReturnValue(createQueryChain({ data: [], error: null }));

      await expect(
        restoreStudentGuardianLink("org-1", "non-existent")
      ).rejects.toThrow("Öğrenci–veli bağı bulunamadı veya geri yüklenemedi.");
    });
  });
});
