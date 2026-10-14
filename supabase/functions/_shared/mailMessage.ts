/**
 * E-posta iletisinin metni (RFC 5322 + MIME) — ağ yok, yalnız biçim.
 *
 * `mailer.ts` bunu SMTP'ye yazar. Ayrı dosyada durmasının sebebi test:
 * Deno'ya bağlı olmadığı için `pnpm test` içinden sınanabiliyor
 * (`supabase/tests/deployment/mailMessage.test.ts`).
 *
 * Başlıklar ve gövde base64 ile kodlanır: Türkçe harfler 7 bitlik SMTP
 * hattından bozulmadan geçer ve base64 satırı hiçbir zaman nokta ile
 * başlamaz (SMTP'de tek başına "." iletinin sonu demektir).
 */

export type MailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailSender = {
  address: string;
  name: string;
};

const LINE = 76;

function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function wrap(value: string): string {
  const lines: string[] = [];
  for (let i = 0; i < value.length; i += LINE) {
    lines.push(value.slice(i, i + LINE));
  }
  return lines.join("\r\n");
}

/** RFC 2047 kodlu başlık değeri; yalnız ASCII ise olduğu gibi. */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${utf8Base64(value)}?=`;
}

/** Başlık enjeksiyonuna karşı: adreste satır sonu ve açılı ayraç olamaz. */
export function isSafeAddress(address: string): boolean {
  return /^[^\s<>@,;"]+@[^\s<>@,;"]+\.[^\s<>@,;"]+$/.test(address);
}

export function buildMessage(
  sender: MailSender,
  mail: MailContent,
  now: Date,
  messageId: string
): string {
  if (!isSafeAddress(sender.address) || !isSafeAddress(mail.to)) {
    throw new Error("unsafe_address");
  }

  const boundary = `orbit-${messageId.replace(/[^A-Za-z0-9]/g, "")}`;
  const domain = sender.address.split("@")[1];

  const headers = [
    `From: ${encodeHeader(sender.name.replace(/[\r\n"]/g, " "))} <${sender.address}>`,
    `To: <${mail.to}>`,
    `Subject: ${encodeHeader(mail.subject.replace(/[\r\n]/g, " "))}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${messageId}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const part = (type: string, body: string) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset=UTF-8`,
      "Content-Transfer-Encoding: base64",
      "",
      wrap(utf8Base64(body)),
    ].join("\r\n");

  return [
    headers.join("\r\n"),
    "",
    part("text/plain", mail.text),
    part("text/html", mail.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** HTML içine güvenle yazılacak metin. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ORBIT e-postalarının ortak sade gövdesi. */
export function orbitHtml(
  paragraphs: string[],
  action?: { label: string; url: string }
): string {
  const body = paragraphs
    .map(
      p =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#334155">${escapeHtml(p)}</p>`
    )
    .join("");
  const button = action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px">${escapeHtml(action.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="tr"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif"><div style="max-width:520px;margin:0 auto;padding:28px 20px"><p style="margin:0 0 18px;font-size:18px;font-weight:800;color:#0f172a">ORBIT</p>${body}${button}<p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#94a3b8">Bu e-postayı siz istemediyseniz dikkate almayın; hesabınızda bir değişiklik yapılmaz.</p></div></body></html>`;
}
