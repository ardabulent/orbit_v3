import { beforeEach, describe, expect, it, vi } from "vitest";

const updateResult = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: () => {
      const chain = {
        update: () => chain,
        eq: () => chain,
        select: () => updateResult(),
      };
      return chain;
    },
  },
}));

const { mapArchivedRow, restoreArchived, translateRestoreError } =
  await import("./archiveService");

describe("archiveService (Ayarlar → Arşiv, B20)", () => {
  beforeEach(() => updateResult.mockReset());

  it("sınav satırında tarih ve sınıf adı ikinci satır olur", () => {
    const item = mapArchivedRow("exam", {
      id: "e1",
      name: "TYT Deneme 3",
      exam_date: "2026-10-01",
      archived_at: "2026-10-10T09:00:00Z",
      classes: { name: "12-A" },
    });
    expect(item.title).toBe("TYT Deneme 3");
    expect(item.detail).toBe("2026-10-01 · 12-A");
  });

  it("numarası olmayan öğrencide ikinci satır uydurulmaz", () => {
    const item = mapArchivedRow("student", {
      id: "s1",
      full_name: "Ayşe Yılmaz",
      student_number: null,
      archived_at: "2026-10-10T09:00:00Z",
    });
    expect(item.detail).toBeNull();
  });

  it("adı alınmış sınıfı geri alırken ne yapılacağını söyler", () => {
    expect(translateRestoreError("class", { code: "23505" })).toContain(
      "Aynı adla etkin bir sınıf var"
    );
    expect(translateRestoreError("exam", { code: "23505" })).toContain(
      "Aynı ad ve tarihle"
    );
  });

  it("İngilizce teknik hata metni kullanıcıya geçmez", () => {
    expect(
      translateRestoreError("guardian", { message: "numeric field overflow" })
    ).toBe("Kayıt geri alınamadı.");
  });

  it("⛔ sıfır satır etkileyen geri alma başarılı sayılmaz (K-14)", async () => {
    updateResult.mockResolvedValue({ data: [], error: null });
    await expect(restoreArchived("org-1", "student", "s1")).rejects.toThrow(
      "Kayıt bulunamadı veya geri alınamadı."
    );
  });

  it("veritabanı hatası Türkçe metne çevrilir", async () => {
    updateResult.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(restoreArchived("org-1", "class", "c1")).rejects.toThrow(
      "Aynı adla etkin bir sınıf var"
    );
  });
});
