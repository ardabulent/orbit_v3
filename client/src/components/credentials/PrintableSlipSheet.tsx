import type { IssuedCredentials } from "./IssuedCredentials";

/**
 * Toplu açılan hesapların kâğıt fişleri (ana plan 1.8): A4'te 2 sütun × 4
 * satır, kesme çizgili; her fişte ad, kime ait olduğu, giriş numarası ve
 * geçici şifre. Ekranda görünmez; `PrintPortal` içinde yalnız yazdırılır.
 * Tekil fişle (`CredentialsPanel` → `PrintableSlip`) aynı sade, yüksek
 * kontrastlı biçim.
 */
export type SlipEntry = {
  subjectLabel: string;
  subjectName: string;
  /** Örn. velinin çocuğu ya da öğrencinin sınıfı. */
  note?: string;
  credentials: IssuedCredentials;
};

const PER_PAGE = 8;

export function PrintableSlipSheet({ entries }: { entries: SlipEntry[] }) {
  const pages: SlipEntry[][] = [];
  for (let i = 0; i < entries.length; i += PER_PAGE)
    pages.push(entries.slice(i, i + PER_PAGE));

  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#000",
      }}
    >
      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridAutoRows: "62mm",
            breakAfter: pageIndex < pages.length - 1 ? "page" : "auto",
            pageBreakAfter: pageIndex < pages.length - 1 ? "always" : "auto",
          }}
        >
          {page.map((entry, index) => (
            <div
              key={index}
              style={{
                border: "1px dashed #555",
                padding: "10mm 8mm",
                boxSizing: "border-box",
              }}
            >
              <p
                style={{
                  fontSize: "9px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                ORBIT — {entry.subjectLabel} giriş bilgileri
              </p>
              <p
                style={{ fontSize: "15px", fontWeight: 800, margin: "6px 0 0" }}
              >
                {entry.subjectName}
              </p>
              {entry.note ? (
                <p style={{ fontSize: "10px", margin: "2px 0 0" }}>
                  {entry.note}
                </p>
              ) : null}
              <table
                style={{
                  marginTop: "10px",
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: "11px",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "3px 0", width: "40%" }}>
                      Giriş numarası
                    </td>
                    <td
                      style={{
                        padding: "3px 0",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "15px",
                        fontWeight: 800,
                        letterSpacing: ".06em",
                      }}
                    >
                      {entry.credentials.loginNumber}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "3px 0" }}>Geçici şifre</td>
                    <td
                      style={{
                        padding: "3px 0",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "15px",
                        fontWeight: 800,
                        letterSpacing: ".06em",
                      }}
                    >
                      {entry.credentials.temporaryPassword}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: "9px", margin: "8px 0 0" }}>
                İlk girişte şifrenizi değiştirmeniz istenecektir.
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
