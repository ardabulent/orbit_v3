import { buildMessage, type MailContent } from "./mailMessage.ts";

/**
 * SMTP ile e-posta gönderimi (2026-10-13, #118).
 *
 * **Neden paket değil, kırk satır protokol.** Gereken yalnız EHLO → AUTH →
 * MAIL → RCPT → DATA; bir SMTP kütüphanesi bunun için bağımlılık zinciri ve
 * `deps.ts`'e yeni bir pin getirirdi. SMTP standart bir arayüz: sağlayıcı
 * Gmail'den ORBIT'in kendi adresine ya da başka bir servise geçtiğinde yalnız
 * aşağıdaki ortam değişkenleri değişir (AGENTS.md kısıt 6).
 *
 * **Port 465 (doğrudan TLS).** Supabase Edge fonksiyonlarından 25 ve 587
 * portlarına çıkış kapalı (docs: functions/limits). Gmail 465'i destekliyor.
 * Yerelde Supabase'in posta yakalayıcısı düz bağlantı bekler; 465 dışındaki
 * her port düz bağlantı sayılır ve şifre gönderilmez.
 *
 * Ortam değişkenleri (Supabase → Edge Functions → Secrets):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_FROM_NAME
 *
 * Kişisel veri loga yazılmaz: hata kayıtları alıcı adresini taşımaz.
 */

type SmtpConfig = {
  host: string;
  port: number;
  user: string | null;
  password: string | null;
  from: string;
  fromName: string;
};

export function smtpConfig(): SmtpConfig | null {
  const host = Deno.env.get("SMTP_HOST")?.trim();
  const from = Deno.env.get("SMTP_FROM")?.trim();
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
  if (!host || !from || !Number.isInteger(port) || port <= 0) return null;
  return {
    host,
    port,
    user: Deno.env.get("SMTP_USER")?.trim() || null,
    password: Deno.env.get("SMTP_PASSWORD")?.replace(/\s+/g, "") || null,
    from,
    fromName: Deno.env.get("SMTP_FROM_NAME")?.trim() || "ORBIT",
  };
}

class SmtpSession {
  private buffer = "";
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();

  constructor(private readonly conn: Deno.Conn) {}

  private async readReply(): Promise<{ code: number; text: string }> {
    const chunk = new Uint8Array(4096);
    for (;;) {
      // Çok satırlı yanıt: "250-..." satırları "250 ..." ile biter.
      const lines = this.buffer.split("\r\n");
      for (let i = 0; i < lines.length - 1; i += 1) {
        if (/^\d{3} /.test(lines[i])) {
          this.buffer = lines.slice(i + 1).join("\r\n");
          return {
            code: Number(lines[i].slice(0, 3)),
            text: lines.slice(0, i + 1).join("\n"),
          };
        }
      }
      const read = await this.conn.read(chunk);
      if (read === null) throw new Error("smtp_closed");
      this.buffer += this.decoder.decode(chunk.subarray(0, read), {
        stream: true,
      });
    }
  }

  async expect(codes: number[]): Promise<void> {
    const reply = await this.readReply();
    if (!codes.includes(reply.code)) {
      // Sunucu metni adres taşıyabilir; yalnız kod yazılır.
      throw new Error(`smtp_${reply.code}`);
    }
  }

  async command(line: string, codes: number[]): Promise<void> {
    await this.write(line + "\r\n");
    await this.expect(codes);
  }

  async write(data: string): Promise<void> {
    const bytes = this.encoder.encode(data);
    let written = 0;
    while (written < bytes.length) {
      written += await this.conn.write(bytes.subarray(written));
    }
  }
}

function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Bütün gönderimin üst sınırı; bağlanma adımı dahil. */
const SEND_TIMEOUT_MS = 15_000;

/**
 * Gönderir; başarısızlıkta `Error("smtp_…")` fırlatır.
 *
 * 2026-10-14 ölçüldü: canlıdaki ilk gönderim hiçbir kayıt bırakmadan
 * kayboldu. Süre sınırı bağlantı KURULDUKTAN sonra başlıyordu; bağlanma
 * adımı takılırsa işlem fonksiyon kapanana kadar bekliyor ve sessizce
 * kesiliyordu. Artık sınır en baştan başlar ve hata, takıldığı adımın adını
 * taşır (`smtp_timeout_connect` gibi). Başarı da kayda düşer — adres
 * olmadan.
 */
export async function sendMail(
  config: SmtpConfig,
  mail: MailContent
): Promise<void> {
  const message = buildMessage(
    { address: config.from, name: config.fromName },
    mail,
    new Date(),
    crypto.randomUUID()
  );

  let step = "connect";
  let conn: Deno.Conn | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const closeQuietly = () => {
    try {
      conn?.close();
    } catch (closeError) {
      // Zaten kapanmış bağlantıyı ikinci kez kapatmak hata verir; gönderimin
      // sonucunu değiştirmez ama sessiz de geçilmez.
      console.warn("[mailer] bağlantı zaten kapalı", String(closeError));
    }
    conn = null;
  };

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      closeQuietly();
      reject(new Error(`smtp_timeout_${step}`));
    }, SEND_TIMEOUT_MS);
  });

  const exchange = async () => {
    conn =
      config.port === 465
        ? await Deno.connectTls({ hostname: config.host, port: config.port })
        : await Deno.connect({ hostname: config.host, port: config.port });
    const smtp = new SmtpSession(conn);
    step = "greeting";
    await smtp.expect([220]);
    step = "ehlo";
    await smtp.command("EHLO orbit", [250]);
    if (config.user && config.password) {
      step = "auth";
      await smtp.command(
        "AUTH PLAIN " + base64(`\u0000${config.user}\u0000${config.password}`),
        [235]
      );
    }
    step = "envelope";
    await smtp.command(`MAIL FROM:<${config.from}>`, [250]);
    await smtp.command(`RCPT TO:<${mail.to}>`, [250, 251]);
    step = "data";
    await smtp.command("DATA", [354]);
    // Satır başındaki nokta ikilenir (RFC 5321 §4.5.2).
    await smtp.write(message.replace(/\r\n\./g, "\r\n..") + "\r\n.\r\n");
    await smtp.expect([250]);
    step = "quit";
    await smtp.write("QUIT\r\n");
  };

  try {
    await Promise.race([exchange(), timeout]);
    console.log("[mailer] gönderildi");
  } catch (sendError) {
    const reason = sendError instanceof Error ? sendError.message : "unknown";
    // Sunucu kodları (`smtp_535`) ve zaman aşımları olduğu gibi; ağ hataları
    // takıldığı adımın adıyla.
    throw new Error(
      reason.startsWith("smtp_") ? reason : `smtp_${step}_${reason}`
    );
  } finally {
    clearTimeout(timer);
    closeQuietly();
  }
}
