import { describe, expect, it } from "vitest";
import { describeLastMail, mailFailureText } from "./memberMailService";

describe("üyenin son e-postası", () => {
  const base = {
    hasRecoveryEmail: true,
    lastKind: "password_reset" as const,
    lastReason: null,
    lastAt: "2026-10-14T06:51:00Z",
  };

  it("gönderilen e-posta tür, zaman ve sonuçla yazılır", () => {
    const sonuc = describeLastMail({ ...base, lastStatus: "sent" });
    expect(sonuc?.tone).toBe("ok");
    expect(sonuc?.text).toMatch(/^Şifre sıfırlama · .+ · gönderildi$/);
  });

  it("başarısızlık sebebi yöneticinin anlayacağı dile çevrilir", () => {
    expect(mailFailureText("smtp_535")).toBe(
      "e-posta hesabı şifresi reddedildi"
    );
    expect(mailFailureText("smtp_timeout_connect")).toBe(
      "e-posta sunucusuna ulaşılamadı"
    );
    expect(mailFailureText("link_failed")).toBe("bağlantı üretilemedi");
    expect(mailFailureText("smtp_ehlo_ConnectionReset")).toBe("gönderilemedi");
    expect(
      describeLastMail({
        ...base,
        lastStatus: "failed",
        lastReason: "smtp_535",
      })?.tone
    ).toBe("bad");
  });

  it("hiç e-posta gitmediyse satır yok", () => {
    expect(
      describeLastMail({
        hasRecoveryEmail: false,
        lastKind: null,
        lastStatus: null,
        lastReason: null,
        lastAt: null,
      })
    ).toBeNull();
  });
});
