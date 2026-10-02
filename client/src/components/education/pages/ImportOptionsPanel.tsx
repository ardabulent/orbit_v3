import { AlertTriangle } from "lucide-react";
import { turkishNameKey, type ClassMap } from "@/education/importNormalize";

const SELECT =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] outline-none focus:border-blue-500";
const NO_CLASS = "__sinifsiz__";

export type SheetChoice = "all" | number;

/**
 * "Dosyayı olduğu gibi yükle" seçenekleri (2026-10-02). Kurumun listesini
 * ORBIT'in biçimine elle yeniden yazmamak için hücre farkları burada çözülür:
 * hangi sayfalar, dosyadaki sınıf adlarının ORBIT karşılığı, BÜYÜK HARFLİ
 * adlar ve zaten kayıtlı öğrenciler.
 */
export function ImportOptionsPanel({
  sheetNames,
  sheetChoice,
  onSheetChoice,
  sheetAsClass,
  onSheetAsClass,
  classValues,
  classNames,
  classMap,
  onClassChoice,
  capsSample,
  fixCaps,
  onFixCaps,
  canSkipExisting,
  skipExisting,
  onSkipExisting,
}: {
  sheetNames: string[];
  sheetChoice: SheetChoice;
  onSheetChoice: (choice: SheetChoice) => void;
  sheetAsClass: boolean;
  onSheetAsClass: (on: boolean) => void;
  classValues: string[];
  classNames: string[];
  classMap: ClassMap;
  /** `""` sınıfsız bırak demektir. */
  onClassChoice: (fileValue: string, orbitClass: string) => void;
  /** Büyük harfli bir adın düzeltilmiş hali (örnek göstermek için). */
  capsSample: { from: string; to: string } | null;
  fixCaps: boolean;
  onFixCaps: (on: boolean) => void;
  canSkipExisting: boolean;
  skipExisting: boolean;
  onSkipExisting: (on: boolean) => void;
}) {
  const many = sheetNames.length > 1;
  const waiting = classValues.filter(v => !(turkishNameKey(v) in classMap));

  return (
    <div className="space-y-4">
      {many ? (
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-[12px] font-extrabold text-slate-800">
            Excel sayfaları
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Dosyada {sheetNames.length} sayfa var: {sheetNames.join(", ")}.
            Sayfaların sütun düzeni aynıysa hepsi birlikte aktarılabilir.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-[11px] font-bold text-slate-600">
              Hangi sayfalar?
              <select
                value={sheetChoice}
                onChange={e =>
                  onSheetChoice(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
                className={SELECT}
              >
                <option value="all">Bütün sayfalar</option>
                {sheetNames.map((name, index) => (
                  <option key={name} value={index}>
                    Yalnız “{name}”
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                checked={sheetAsClass}
                onChange={e => onSheetAsClass(e.target.checked)}
              />
              Sayfa adı sınıftır (her sınıf ayrı sayfada)
            </label>
          </div>
        </section>
      ) : null}

      {classValues.length > 0 ? (
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-[12px] font-extrabold text-slate-800">
            Sınıflar
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Dosyadaki her sınıf adının ORBIT'teki karşılığını bir kez seçin;
            satırları tek tek düzeltmeniz gerekmez. Benzer adları sizin için
            eşledik.
          </p>
          {classNames.length === 0 ? (
            <p className="mt-2 text-[11px] font-bold text-amber-700">
              Kurumda henüz sınıf yok. Önce Sınıflar sekmesinden açın ya da
              öğrencileri sınıfsız aktarın.
            </p>
          ) : null}
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
                  <th className="px-3 py-2">Dosyada</th>
                  <th className="px-3 py-2">ORBIT'te</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classValues.map(value => {
                  const chosen = classMap[turkishNameKey(value)];
                  return (
                    <tr
                      key={value}
                      className={chosen === undefined ? "bg-amber-50/60" : ""}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {value}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`${value} sınıfının ORBIT karşılığı`}
                          value={
                            chosen === undefined
                              ? ""
                              : chosen === ""
                                ? NO_CLASS
                                : chosen
                          }
                          onChange={e =>
                            onClassChoice(
                              value,
                              e.target.value === NO_CLASS ? "" : e.target.value
                            )
                          }
                          className={SELECT}
                        >
                          <option value="" disabled>
                            Seçin…
                          </option>
                          {classNames.map(name => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                          <option value={NO_CLASS}>— Sınıfsız aktar —</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {waiting.length > 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {waiting.length} sınıf adı için seçim bekleniyor.
            </p>
          ) : null}
        </section>
      ) : null}

      {capsSample || canSkipExisting ? (
        <section className="space-y-2 rounded-xl border border-slate-200 p-4">
          {capsSample ? (
            <label className="flex items-start gap-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={fixCaps}
                onChange={e => onFixCaps(e.target.checked)}
              />
              <span>
                BÜYÜK HARFLE yazılmış adları düzelt
                <span className="block text-[11px] text-slate-500">
                  ör. “{capsSample.from}” → “{capsSample.to}”
                </span>
              </span>
            </label>
          ) : null}
          {canSkipExisting ? (
            <label className="flex items-start gap-2 text-[12px] text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={skipExisting}
                onChange={e => onSkipExisting(e.target.checked)}
              />
              <span>
                Numarası zaten kayıtlı öğrencileri atla
                <span className="block text-[11px] text-slate-500">
                  Güncellenmiş listeyi yeniden yüklerken yalnız yeni öğrenciler
                  eklenir; kayıtlılara dokunulmaz.
                </span>
              </span>
            </label>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
