import { describe, expect, it } from "vitest";
import {
  buildMessage,
  encodeHeader,
  isSafeAddress,
  orbitHtml,
} from "../../functions/_shared/mailMessage";

/**
 * Edge fonksiyonlarının e-posta biçimi (2026-10-13, #118).
 *
 * SMTP istemcisi paket değil, `_shared/mailer.ts`'te elle yazılı; iletinin
 * metni de `mailMessage.ts`'te. Burası Deno'ya bağlı olmadığı için `pnpm test`
 * içinde sınanır: Türkçe başlık bozulmadan kodlanıyor mu, başlığa satır sonu
 * sokulabiliyor mu, gövde satırları noktayla başlayabiliyor mu.
 */

function decodeBase64Utf8(value: string): string {
  return Buffer.from(value.replace(/\r\n/g, ""), "base64").toString("utf8");
}

const sender = { address: "orbit@example.com", name: "ORBIT" };
const at = new Date("2026-10-13T10:00:00Z");

describe("e-posta iletisi", () => {
  it("Türkçe başlığı RFC 2047 ile kodlar, ASCII'yi olduğu gibi bırakır", () => {
    expect(encodeHeader("ORBIT")).toBe("ORBIT");
    const kodlu = encodeHeader("ORBIT şifre sıfırlama");
    expect(kodlu).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    expect(decodeBase64Utf8(kodlu.slice(10, -2))).toBe("ORBIT şifre sıfırlama");
  });

  it("başlığa satır sonuyla ek başlık sokulamaz", () => {
    const ileti = buildMessage(
      sender,
      {
        to: "veli@example.com",
        subject: "a\r\nBcc: x@example.com",
        text: "t",
        html: "<p>t</p>",
      },
      at,
      "id1"
    );
    expect(ileti).not.toMatch(/^Bcc:/m);
    expect(isSafeAddress("veli@example.com\r\nBcc: x@example.com")).toBe(false);
    expect(() =>
      buildMessage(
        sender,
        { to: "a@b.com>\r\nX: y", subject: "s", text: "t", html: "h" },
        at,
        "id2"
      )
    ).toThrow("unsafe_address");
  });

  it("gövde base64'tür: satırlar 76 karakteri aşmaz ve noktayla başlamaz", () => {
    const metin = ".nokta ile başlayan satır\n" + "ğ".repeat(400);
    const ileti = buildMessage(
      sender,
      {
        to: "veli@example.com",
        subject: "s",
        text: metin,
        html: orbitHtml([metin]),
      },
      at,
      "id3"
    );
    const govde = ileti.split("\r\n\r\n").slice(1).join("\r\n\r\n");
    for (const satir of govde.split("\r\n")) {
      expect(satir.length).toBeLessThanOrEqual(76);
      expect(satir.startsWith(".")).toBe(false);
    }
    const parca = ileti
      .split("Content-Transfer-Encoding: base64\r\n\r\n")[1]
      .split("\r\n--")[0];
    expect(decodeBase64Utf8(parca)).toBe(metin);
  });

  it("HTML gövdesine yazılan metin kaçışlanır", () => {
    const html = orbitHtml(["<script>x</script>"], {
      label: "Aç",
      url: 'https://a.b/"x',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("https://a.b/&quot;x");
  });
});
