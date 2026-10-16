import { useState } from "react";
import { toast } from "sonner";
import type { IssuedCredentials } from "./IssuedCredentials";
import { PrintPortal } from "./PrintPortal";

/**
 * Kurum kurulduktan veya üye şifresi sıfırlandıktan sonra giriş bilgilerinin
 * bir kez gösterildiği ekran.
 *
 * Geçici şifre hiçbir yere kaydedilmiyor — ne veritabanına, ne denetim
 * kaydına, ne tarayıcı deposuna. Bu ekran kapandığında şifre geri getirilemez;
 * kaybolursa yenisi üretilir. Bkz. `.ai/DECISION_LOG.md` — "Hesaplar davet
 * e-postasıyla değil, doğrudan geçici şifreyle açılır".
 */
export function CredentialsPanel({
  subjectLabel,
  subjectName,
  organizationCode,
  credentials,
  onDone,
}: {
  subjectLabel: string;
  subjectName: string;
  organizationCode?: number;
  credentials: IssuedCredentials;
  onDone: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  const labelPadded = subjectLabel.padEnd(12, " ");
  const plainText = [
    `${labelPadded}: ${subjectName}`,
    `${"Giriş no".padEnd(12, " ")}: ${credentials.loginNumber}`,
    `${"Geçici şifre".padEnd(12, " ")}: ${credentials.temporaryPassword}`,
    ...(credentials.passwordLockSet === false
      ? []
      : ["", "İlk girişte şifrenizi değiştirmeniz istenecektir."]),
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      toast.success("Giriş bilgileri kopyalandı");
    } catch {
      // Pano izni yoksa veya güvenli bağlam değilse sessizce başarısız olmak
      // yanıltıcı olurdu; kullanıcı kopyaladığını sanıp ekranı kapatabilir.
      toast.error("Kopyalanamadı", {
        description: "Bilgileri ekrandan elle not alın.",
      });
    }
  };

  return (
    <div className="space-y-5">
      {/*
        Kâğıda basılacak sürüm ayrı bir kökte yaşıyor ve ekranda görünmüyor.
        Ekran düzenini doğrudan bastırmayı denemek boş sayfa üretmişti; bkz.
        `PrintPortal` ve `index.css`.
      */}
      <PrintPortal>
        <PrintableSlip
          subjectLabel={subjectLabel}
          subjectName={subjectName}
          credentials={credentials}
        />
      </PrintPortal>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] leading-5 text-amber-900">
        <p className="font-bold">Bu şifre bir daha gösterilmeyecek.</p>
        <p className="mt-1">
          Hiçbir yere kaydedilmiyor. Bu pencereyi kapatmadan önce bilgileri
          alın; kaybolursa yeni bir şifre üretmeniz gerekir.
        </p>
      </div>

      <dl className="space-y-3 rounded-xl bg-muted/60 p-4">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
            {subjectLabel}
          </dt>
          <dd className="mt-0.5 text-[14px] font-bold">{subjectName}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
            Giriş numarası
          </dt>
          <dd className="mt-0.5 font-mono text-[20px] font-extrabold tracking-[.08em]">
            {credentials.loginNumber}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
            Geçici şifre
          </dt>
          <dd className="mt-0.5 font-mono text-[20px] font-extrabold tracking-[.08em]">
            {credentials.temporaryPassword}
          </dd>
        </div>
      </dl>

      <div className="space-y-2" aria-live="polite">
        {credentials.passwordLockSet === false ? (
          <div
            role="alert"
            className="rounded-xl border-2 border-rose-400 bg-rose-50 p-3 text-[12px] leading-5 text-rose-900"
          >
            İlk giriş kilidi kurulamadı. Bu hesap geçici şifresini değiştirmeden
            sisteme girebilir. Kullanıcıya şifresini ilk girişte kendisinin
            değiştirmesi gerektiğini bildirin ve şifre sıfırlamayı tekrar
            deneyin.
          </div>
        ) : null}

        {credentials.auditWritten === false ? (
          <div
            role="alert"
            className="rounded-xl border-2 border-rose-400 bg-rose-50 p-3 text-[12px] leading-5 text-rose-900"
          >
            Bu işlemin denetim kaydı yazılamadı. İşlem gerçekleşti ancak denetim
            listesinde görünmeyecek.
          </div>
        ) : null}
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">
        Kullanıcı bu numarayla giriş yapar
        {credentials.passwordLockSet === false
          ? "."
          : " ve ilk girişte şifresini değiştirmek zorundadır."}
        {organizationCode !== undefined ? (
          <>
            {" "}
            Giriş numarasının ilk dört hanesi kurum kodudur (
            <span className="font-mono">{organizationCode}</span>); bu kurumun
            diğer kullanıcıları da aynı kodla başlayan numaralar alır.
          </>
        ) : null}
      </p>

      <label className="flex cursor-pointer items-start gap-2.5 text-[12px]">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={event => setAcknowledged(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
        />
        <span>Giriş bilgilerini not aldım.</span>
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-xl border border-border px-4 py-2.5 text-[12px] font-bold transition hover:bg-muted"
        >
          Kopyala
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-border px-4 py-2.5 text-[12px] font-bold transition hover:bg-muted"
        >
          Yazdır
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={!acknowledged}
          title={
            acknowledged ? undefined : "Önce bilgileri aldığınızı onaylayın"
          }
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

/**
 * Kâğıda basılan sürüm.
 *
 * Ekran sürümünden ayrı: kâğıtta koyu tema, gölge, düğme ve onay kutusu işe
 * yaramaz. Basılan şey elden teslim edilecek bir fiş olduğu için sade ve
 * yüksek kontrastlı tutuluyor.
 */
function PrintableSlip({
  subjectLabel,
  subjectName,
  credentials,
}: {
  subjectLabel: string;
  subjectName: string;
  credentials: IssuedCredentials;
}) {
  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#000",
        padding: "24px",
        maxWidth: "480px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          fontWeight: 700,
          margin: 0,
        }}
      >
        ORBIT — {subjectLabel} Giriş Bilgileri
      </p>

      <h1 style={{ fontSize: "20px", fontWeight: 800, margin: "12px 0 0" }}>
        {subjectName}
      </h1>

      <table
        style={{
          marginTop: "20px",
          borderCollapse: "collapse",
          width: "100%",
          fontSize: "13px",
        }}
      >
        <tbody>
          <tr>
            <td style={{ padding: "8px 0", width: "40%" }}>Giriş numarası</td>
            <td
              style={{
                padding: "8px 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: ".08em",
              }}
            >
              {credentials.loginNumber}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px 0" }}>Geçici şifre</td>
            <td
              style={{
                padding: "8px 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: ".08em",
              }}
            >
              {credentials.temporaryPassword}
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: "20px", fontSize: "12px", lineHeight: 1.6 }}>
        Giriş ekranında <strong>giriş numaranızı</strong> ve geçici şifrenizi
        yazın.
        {credentials.passwordLockSet === false
          ? null
          : " İlk girişte şifrenizi değiştirmeniz istenecektir."}
      </p>

      <p style={{ marginTop: "16px", fontSize: "11px", color: "#444" }}>
        Bu belgeyi başkasıyla paylaşmayın. Şifrenizi değiştirdikten sonra imha
        edin.
      </p>
    </div>
  );
}
