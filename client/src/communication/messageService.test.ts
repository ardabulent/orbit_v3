import { describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: (fn: string, args: unknown) => rpcMock(fn, args) },
}));

const { loadConversations, sendMessage, translateMessageError } =
  await import("./messageService");

describe("messageService (birebir mesajlaşma)", () => {
  it("veritabanının Türkçe kuralı olduğu gibi gösterilir", () => {
    expect(
      translateMessageError({ message: "Bu kişiye mesaj gönderemezsiniz." })
    ).toBe("Bu kişiye mesaj gönderemezsiniz.");
  });

  it("İngilizce teknik hata kullanıcıya geçmez", () => {
    expect(translateMessageError({ message: "permission denied" })).toBe(
      "Mesaj işlemi yapılamadı."
    );
  });

  it("konuşma listesi okunmamış ve 'siz' bilgisini taşır", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          conversation_id: "c1",
          other_membership_id: "m2",
          other_name: "Ayşe Koç",
          other_role: "parent",
          last_message: "Merhaba",
          last_message_at: "2026-10-12T10:00:00Z",
          last_from_me: false,
          unread: true,
        },
      ],
      error: null,
    });
    const rows = await loadConversations();
    expect(rows[0]).toMatchObject({
      id: "c1",
      otherName: "Ayşe Koç",
      unread: true,
      lastFromMe: false,
    });
  });

  it("gönderim hatası Türkçe fırlatılır", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          "Çok hızlı mesaj gönderiyorsunuz; bir dakika sonra tekrar deneyin.",
      },
    });
    await expect(sendMessage("c1", "x")).rejects.toThrow("Çok hızlı");
  });
});
