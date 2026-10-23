import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveSubject,
  createSubject,
  loadSubjects,
  restoreSubject,
  translateSubjectError,
  updateSubject,
} from "./subjectService";
import { supabase } from "@/lib/supabaseClient";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("subjectService (v1.4-11 · #287)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadSubjects", () => {
    it("kurum kimliğiyle süzer, arşivlenmemişleri alfabetik sıralar ve limit uygular", async () => {
      const mockOrder = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: "sub-1",
              organization_id: "org-1",
              name: "Biyoloji",
              archived_at: null,
              created_at: "2026-09-13T00:00:00Z",
              updated_at: "2026-09-13T00:00:00Z",
            },
          ],
          error: null,
        }),
      });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ is: mockIs });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await loadSubjects("org-1");

      expect(supabase.from).toHaveBeenCalledWith("subjects");
      expect(mockEq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(mockIs).toHaveBeenCalledWith("archived_at", null);
      expect(mockOrder).toHaveBeenCalledWith("name", { ascending: true });
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        id: "sub-1",
        organizationId: "org-1",
        name: "Biyoloji",
        archivedAt: null,
        createdAt: "2026-09-13T00:00:00Z",
        updatedAt: "2026-09-13T00:00:00Z",
      });
      expect(result.truncated).toBe(false);
    });

    it("includeArchived true iken arşiv süzgeci koymaz", async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await loadSubjects("org-1", { includeArchived: true });

      expect(mockEq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(mockOrder).toHaveBeenCalledWith("name", { ascending: true });
      expect(result.rows).toEqual([]);
      expect(result.truncated).toBe(false);
    });

    it("satır sayısı limite ulaştığında truncated true döner (K-03)", async () => {
      const mockData = Array.from({ length: 2 }, (_, i) => ({
        id: `sub-${i}`,
        organization_id: "org-1",
        name: `Ders ${i}`,
        archived_at: null,
      }));

      const mockLimit = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ is: mockIs });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await loadSubjects("org-1", { limit: 2 });
      expect(result.truncated).toBe(true);
    });

    it("K-22: Hata durumunda hatayı yutmaz, hata fırlatır", async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42501", message: "Yetkisiz erişim" },
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ is: mockIs });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(loadSubjects("org-1")).rejects.toThrow(
        "Bu işlem için kurum yöneticisi yetkisi gerekiyor."
      );
    });
  });

  describe("createSubject", () => {
    it("yüke ASLA id koymaz ve geçerli ders oluşturur (#287 / K-00)", async () => {
      let capturedPayload: unknown;

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "sub-generated-uuid",
          organization_id: "org-1",
          name: "Matematik",
          archived_at: null,
          created_at: "2026-09-13T00:00:00Z",
          updated_at: "2026-09-13T00:00:00Z",
        },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { select: mockSelect };
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>);

      const created = await createSubject({
        organizationId: "org-1",
        name: "  Matematik  ",
      });

      expect(supabase.from).toHaveBeenCalledWith("subjects");
      expect(capturedPayload).toEqual({
        organization_id: "org-1",
        name: "Matematik",
      });
      // ⛔ K-23: Yüke asla `id` konmaz
      expect(capturedPayload).not.toHaveProperty("id");
      expect(created.name).toBe("Matematik");
    });

    it("veritabanı hatası durumunda çevrilmiş hata fırlatır", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint",
        },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(
        createSubject({ organizationId: "org-1", name: "Matematik" })
      ).rejects.toThrow(
        "Bu isimde aktif bir ders zaten var (büyük/küçük harf fark etmez). Lütfen farklı bir ders adı seçin."
      );
    });
  });

  describe("updateSubject", () => {
    it("yüke id veya organization_id KOYMAZ ve günceller", async () => {
      let capturedPayload: unknown;

      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          {
            id: "sub-1",
            organization_id: "org-1",
            name: "İleri Matematik",
            archived_at: null,
          },
        ],
        error: null,
      });
      const mockEqId = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { eq: mockEqOrg };
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>);

      const updated = await updateSubject("org-1", "sub-1", {
        name: "  İleri Matematik  ",
      });

      expect(mockEqOrg).toHaveBeenCalledWith("organization_id", "org-1");
      expect(mockEqId).toHaveBeenCalledWith("id", "sub-1");
      expect(capturedPayload).toEqual({
        name: "İleri Matematik",
      });
      // ⛔ Yüke asla id veya organization_id konmaz
      expect(capturedPayload).not.toHaveProperty("id");
      expect(capturedPayload).not.toHaveProperty("organization_id");
      expect(updated.name).toBe("İleri Matematik");
    });

    it("K-14: Sıfır satır etkilendiğinde hata fırlatır", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockEqId = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(
        updateSubject("org-1", "sub-1", { name: "Yeni Ad" })
      ).rejects.toThrow("Ders bulunamadı veya güncelleme yetkiniz yok.");
    });
  });

  describe("archiveSubject", () => {
    it("archived_at tarihini günceller", async () => {
      let capturedPayload: unknown;

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "sub-1" }],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { eq: mockEqOrg };
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>);

      await archiveSubject("org-1", "sub-1");

      expect(mockEqOrg).toHaveBeenCalledWith("organization_id", "org-1");
      expect(mockEqId).toHaveBeenCalledWith("id", "sub-1");
      expect(mockIs).toHaveBeenCalledWith("archived_at", null);
      expect(capturedPayload).toHaveProperty("archived_at");
      expect(
        (capturedPayload as { archived_at: string }).archived_at
      ).toBeTruthy();
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

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(archiveSubject("org-1", "sub-1")).rejects.toThrow(
        "Ders bulunamadı veya işlem yetkiniz yok."
      );
    });
  });

  describe("restoreSubject", () => {
    it("archived_at alanını null yapar", async () => {
      let capturedPayload: unknown;

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "sub-1" }],
        error: null,
      });
      const mockNot = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ not: mockNot });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { eq: mockEqOrg };
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>);

      await restoreSubject("org-1", "sub-1");

      expect(capturedPayload).toEqual({ archived_at: null });
      expect(mockNot).toHaveBeenCalledWith("archived_at", "is", null);
    });

    it("K-14: Sıfır satır etkilendiğinde hata fırlatır", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockNot = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ not: mockNot });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqId });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(restoreSubject("org-1", "sub-1")).rejects.toThrow(
        "Ders bulunamadı veya işlem yetkiniz yok."
      );
    });
  });

  describe("translateSubjectError (K-23 Gerçek PostgREST Gövdesi)", () => {
    it("🔴 Gerçek PostgREST gövdesindeki details alanını ayrıştırır ve ham details basmaz", () => {
      // ⚠️ PostgREST hata alanının adı 'details' (çoğul).
      const rawError = {
        code: "ORB03",
        details: "atama=2, program=3",
        hint: "Önce bu dersin öğretmen atamalarını ve program satırlarını kaldırın.",
        message: "Bu ders kapatılamaz: hâlâ okutuluyor.",
      };

      const translated = translateSubjectError(rawError);

      // İki sayıyı da doğru taşımalı
      expect(translated).toContain("2 öğretmen ataması");
      expect(translated).toContain("3 ders programı satırı");
      // Ham "atama=2, program=3" dizesini basmamalı
      expect(translated).not.toContain("atama=2");
      expect(translated).not.toContain("program=3");
      // ⛔ Geçmiş kayıtlar için (sınav, ödev, yoklama) sunucunun söylemediği uyarı üretilmemeli
      expect(translated).not.toContain("sınav");
      expect(translated).not.toContain("ödev");
      expect(translated).not.toContain("yoklama");
    });

    it("yalnızca öğretmen ataması varken tekil doğru cümle kurar", () => {
      const rawError = {
        code: "ORB03",
        details: "atama=2, program=0",
        message: "Bu ders kapatılamaz: hâlâ okutuluyor.",
      };

      const translated = translateSubjectError(rawError);
      expect(translated).toBe(
        "Bu ders kapatılamaz: 2 öğretmen atamasında kullanılıyor. Önce bu dersin öğretmen atamalarını kaldırın."
      );
    });

    it("yalnızca program satırı varken tekil doğru cümle kurar", () => {
      const rawError = {
        code: "ORB03",
        details: "atama=0, program=4",
        message: "Bu ders kapatılamaz: hâlâ okutuluyor.",
      };

      const translated = translateSubjectError(rawError);
      expect(translated).toBe(
        "Bu ders kapatılamaz: 4 ders programı satırında kullanılıyor. Önce bu dersin program satırlarını kaldırın."
      );
    });

    it("details boş veya tanınmıyorsa nötr gerçek cümleyi korur (uydurma sebep üretilmez)", () => {
      const rawError = {
        code: "ORB03",
        details: "bilinmeyen=1",
        message: "Bu ders kapatılamaz: hâlâ okutuluyor.",
      };

      const translated = translateSubjectError(rawError);
      expect(translated).toBe("Bu ders kapatılamaz: hâlâ okutuluyor.");
    });

    it("23505 ad çakışması hatasını kullanıcı dostu açıklar", () => {
      expect(translateSubjectError({ code: "23505" })).toBe(
        "Bu isimde aktif bir ders zaten var (büyük/küçük harf fark etmez). Lütfen farklı bir ders adı seçin."
      );
    });

    it("23514 kontrol kısıtı hatasını açıklar", () => {
      expect(translateSubjectError({ code: "23514" })).toBe(
        "Ders adı 1 ile 80 karakter arasında olmalıdır."
      );
    });

    it("42501 yetki hatasını açıklar", () => {
      expect(translateSubjectError({ code: "42501" })).toBe(
        "Bu işlem için kurum yöneticisi yetkisi gerekiyor."
      );
    });
  });
});
