import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveFeedPost,
  createFeedPost,
  DEFAULT_FEED_LIMIT,
  loadFeedPosts,
  restoreFeedPost,
  translateFeedError,
  updateFeedPost,
} from "./feedService";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe("feedService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadFeedPosts", () => {
    it("kurum kimliği boşsa sorgu atmadan boş dizi döner", async () => {
      const result = await loadFeedPosts("");
      expect(result.rows).toEqual([]);
      expect(result.truncated).toBe(false);
      expect(fromMock).not.toHaveBeenCalled();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("kurum kimliğiyle arşivlenmemiş duyuruları getirir, feed_post_authors ile kurum geneli dahil yazar adlarını çözer (#288 R1)", async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            id: "post-1",
            organization_id: "org-1",
            class_id: "cls-1",
            title: "Yarın ders saat 10'da",
            body: "Önemli duyurudur.",
            author_membership_id: "mem-1",
            created_at: "2026-09-13T10:00:00Z",
            updated_at: "2026-09-13T10:00:00Z",
            archived_at: null,
            classes: { id: "cls-1", name: "12-A" },
          },
          {
            id: "post-2",
            organization_id: "org-1",
            class_id: null,
            title: "Genel Deneme Sınavı",
            body: null,
            author_membership_id: "mem-2",
            created_at: "2026-09-12T10:00:00Z",
            updated_at: "2026-09-12T10:00:00Z",
            archived_at: null,
            classes: null,
          },
          {
            id: "post-3",
            organization_id: "org-1",
            class_id: "cls-1",
            title: "Öğretmeni Ayrılmış Duyuru",
            body: null,
            author_membership_id: "mem-ghost",
            created_at: "2026-09-11T10:00:00Z",
            updated_at: "2026-09-11T10:00:00Z",
            archived_at: null,
            classes: { id: "cls-1", name: "12-A" },
          },
        ],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ is: mockIs });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      fromMock.mockReturnValue({
        select: mockSelect,
      });

      rpcMock.mockResolvedValue({
        data: [
          {
            post_id: "post-1",
            display_name: "Ali Hoca",
          },
          {
            post_id: "post-2",
            display_name: "Müdür Hanım",
          },
        ],
        error: null,
      });

      const result = await loadFeedPosts("org-1");

      expect(fromMock).toHaveBeenCalledWith("daily_feed_posts");
      expect(mockEq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(mockIs).toHaveBeenCalledWith("archived_at", null);
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockLimit).toHaveBeenCalledWith(DEFAULT_FEED_LIMIT);

      // 🔴 feed_post_authors RPC'si duyuru kimlikleriyle çağrılır (class_staff_names DEĞİL)
      expect(rpcMock).toHaveBeenCalledWith("feed_post_authors", {
        target_post_ids: ["post-1", "post-2", "post-3"],
      });

      expect(result.rows).toHaveLength(3);

      // 1. Sınıf duyurusu yazar adı çözülür
      expect(result.rows[0]).toEqual({
        id: "post-1",
        organizationId: "org-1",
        classId: "cls-1",
        className: "12-A",
        title: "Yarın ders saat 10'da",
        body: "Önemli duyurudur.",
        authorMembershipId: "mem-1",
        authorName: "Ali Hoca",
        createdAt: "2026-09-13T10:00:00Z",
        updatedAt: "2026-09-13T10:00:00Z",
        archivedAt: null,
        audience: "all",
        pinned: false,
      });

      // 2. 🔴 R1 ASIL İDDİA: Kurum geneli duyurunun (class_id: null) yazar adı BAŞARIYLA ÇÖZÜLÜR!
      expect(result.rows[1].authorName).toBe("Müdür Hanım");
      expect(result.rows[1].classId).toBeNull();
      expect(result.rows[1].className).toBeNull();

      // 3. Yazar adı feed_post_authors çıktısında bulunamadığında 'adı okunamadı' döner (K-22)
      expect(result.rows[2].authorName).toBe("adı okunamadı");
    });

    it("includeArchived: true olduğunda archived_at süzgeci koymaz", async () => {
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      fromMock.mockReturnValue({
        select: mockSelect,
      });

      await loadFeedPosts("org-1", { includeArchived: true });
      expect(mockEq).toHaveBeenCalledWith("organization_id", "org-1");
    });

    it("classId null ise kurum geneli süzgeci (class_id is null) uygular", async () => {
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIsClass = vi.fn().mockReturnValue({ order: mockOrder });
      const mockIsArchive = vi.fn().mockReturnValue({ is: mockIsClass });
      const mockEq = vi.fn().mockReturnValue({ is: mockIsArchive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      fromMock.mockReturnValue({
        select: mockSelect,
      });

      await loadFeedPosts("org-1", { classId: null });
      expect(mockIsClass).toHaveBeenCalledWith("class_id", null);
    });

    it("satır sayısı limite eşit olduğunda truncated true döner (K-06)", async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            id: "p-1",
            organization_id: "org-1",
            class_id: null,
            title: "Test",
            body: null,
            author_membership_id: "mem-1",
            created_at: "",
            updated_at: "",
            archived_at: null,
          },
        ],
        error: null,
      });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ is: mockIs });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      fromMock.mockReturnValue({
        select: mockSelect,
      });

      const result = await loadFeedPosts("org-1", { limit: 1 });
      expect(result.truncated).toBe(true);
    });
  });

  describe("createFeedPost", () => {
    it("yüke id ve author_membership_id ASLA konmaz (#288 / K-00)", async () => {
      let capturedPayload: unknown;

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "new-post-1",
          organization_id: "org-1",
          class_id: "cls-1",
          title: "Yeni Duyuru",
          body: "Açıklama",
          author_membership_id: "server-assigned-id",
          created_at: "2026-09-13T10:00:00Z",
          updated_at: "2026-09-13T10:00:00Z",
          archived_at: null,
        },
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

      const result = await createFeedPost({
        organizationId: "org-1",
        classId: "cls-1",
        title: "  Yeni Duyuru  ",
        body: "  Açıklama  ",
      });

      expect(capturedPayload).toEqual({
        organization_id: "org-1",
        class_id: "cls-1",
        title: "Yeni Duyuru",
        body: "Açıklama",
      });

      // 🔴 K-23 kırmızı kontrolü: id veya author_membership_id yükte olamaz
      expect(capturedPayload).not.toHaveProperty("id");
      expect(capturedPayload).not.toHaveProperty("author_membership_id");
      expect(result.id).toBe("new-post-1");
    });

    it("geçersiz başlıklı duyuru oluşturulduğunda sunucuya gider ve 23514 hatası çevrilir (#292 / B)", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23514",
          details: "Failing row contains (..., ...)",
          message:
            'new row for relation "daily_feed_posts" violates check constraint "daily_feed_posts_title_check"',
        },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      fromMock.mockReturnValue({ insert: mockInsert });

      await expect(
        createFeedPost({
          organizationId: "org-1",
          title: "   ",
        })
      ).rejects.toThrow(
        "Duyuru başlığı 1 ile 200 karakter arasında olmalıdır."
      );

      // 🔴 B iddiası: Sunucuya gitti
      expect(fromMock).toHaveBeenCalledWith("daily_feed_posts");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "",
          organization_id: "org-1",
        })
      );
    });
  });

  describe("updateFeedPost", () => {
    it("yüke id ve author_membership_id ASLA konmaz", async () => {
      let capturedPayload: unknown;

      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          {
            id: "post-1",
            organization_id: "org-1",
            class_id: "cls-1",
            title: "Güncel Başlık",
            body: null,
            author_membership_id: "mem-1",
            created_at: "",
            updated_at: "",
            archived_at: null,
          },
        ],
        error: null,
      });
      const mockEqPost = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqPost });
      const mockUpdate = vi.fn().mockImplementation(payload => {
        capturedPayload = payload;
        return { eq: mockEqOrg };
      });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await updateFeedPost("org-1", "post-1", {
        title: "Güncel Başlık",
        body: "",
      });

      expect(capturedPayload).toEqual({
        title: "Güncel Başlık",
        body: null,
      });
      expect(capturedPayload).not.toHaveProperty("id");
      expect(capturedPayload).not.toHaveProperty("author_membership_id");
    });

    it("sıfır satır etkilendiğinde hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockEqPost = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqPost });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await expect(
        updateFeedPost("org-1", "post-1", { title: "Yeni" })
      ).rejects.toThrow(
        "Duyuru güncellenemedi veya bu işlem için yetkiniz bulunmuyor."
      );
    });

    it("kurum veya duyuru kimliği boşsa veritabanına gitmeden hata fırlatır (fail-closed / K-04)", async () => {
      await expect(
        updateFeedPost("", "post-1", { title: "Yeni" })
      ).rejects.toThrow("Kurum ve duyuru kimliği gereklidir.");
      expect(fromMock).not.toHaveBeenCalled();

      await expect(
        updateFeedPost("org-1", "", { title: "Yeni" })
      ).rejects.toThrow("Kurum ve duyuru kimliği gereklidir.");
      expect(fromMock).not.toHaveBeenCalled();
    });

    it("geçersiz başlıklı duyuru güncellendiğinde sunucuya gider ve 23514 hatası çevrilir (#292 / B)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23514",
          details: "Failing row contains (..., ...)",
          message:
            'new row for relation "daily_feed_posts" violates check constraint "daily_feed_posts_title_check"',
        },
      });
      const mockEqPost = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqPost });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });
      fromMock.mockReturnValue({ update: mockUpdate });

      await expect(
        updateFeedPost("org-1", "post-1", { title: "   " })
      ).rejects.toThrow(
        "Duyuru başlığı 1 ile 200 karakter arasında olmalıdır."
      );

      expect(fromMock).toHaveBeenCalledWith("daily_feed_posts");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "" })
      );
    });
  });

  describe("archiveFeedPost", () => {
    it("archived_at zamanını doldurur ve sıfır satırda hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "post-1" }],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqPost = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqPost });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await archiveFeedPost("org-1", "post-1");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ archived_at: expect.any(String) })
      );
    });

    it("arşivlemede sıfır satır etkilendiğinde hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockIs = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqPost = vi.fn().mockReturnValue({ is: mockIs });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqPost });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await expect(archiveFeedPost("org-1", "post-1")).rejects.toThrow(
        "Duyuru arşivlenemedi veya bu işlem için yetkiniz bulunmuyor."
      );
    });
  });

  describe("restoreFeedPost", () => {
    it("archived_at alanını null yapar ve sıfır satırda hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: "post-1" }],
        error: null,
      });
      const mockNot = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqPost = vi.fn().mockReturnValue({ not: mockNot });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqPost });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await restoreFeedPost("org-1", "post-1");
      expect(mockUpdate).toHaveBeenCalledWith({ archived_at: null });
    });

    it("geri getirmede sıfır satır etkilendiğinde hata fırlatır (K-14)", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockNot = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqPost = vi.fn().mockReturnValue({ not: mockNot });
      const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqPost });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqOrg });

      fromMock.mockReturnValue({
        update: mockUpdate,
      });

      await expect(restoreFeedPost("org-1", "post-1")).rejects.toThrow(
        "Duyuru arşivden çıkarılamadı veya bu işlem için yetkiniz bulunmuyor."
      );
    });
  });

  describe("translateFeedError", () => {
    it("42501 yetki hatasını Türkçe mesaja çevirir", () => {
      const msg = translateFeedError({ code: "42501", message: "RLS denied" });
      expect(msg).toContain("Bu işlem için yetkiniz yok");
    });

    it("23514 başlık kontrol hatasını Türkçe mesaja çevirir", () => {
      const msg = translateFeedError({
        code: "23514",
        details: "daily_feed_posts_title_check violation",
      });
      expect(msg).toContain(
        "Duyuru başlığı 1 ile 200 karakter arasında olmalıdır"
      );
    });

    it("23503 sınıf yabancı anahtar hatasını Türkçe mesaja çevirir", () => {
      const msg = translateFeedError({ code: "23503" });
      expect(msg).toContain("Seçilen sınıf bulunamadı");
    });

    it("details çoğul alanından hata kodu çözer (K-23)", () => {
      const msg = translateFeedError({
        message: "Error",
        details: "violates 42501 permission",
      });
      expect(msg).toContain("Bu işlem için yetkiniz yok");
    });
  });
});
