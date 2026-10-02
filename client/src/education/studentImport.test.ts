import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { React: typeof React }).React = React;

import { supabase } from "@/lib/supabaseClient";
import { ImportPreview } from "@/components/education/pages/ImportPreview";
import {
  importStudents,
  importTemplateCsv,
  splitCsv,
  type ImportRow,
} from "./studentImport";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

type RpcResult = Awaited<ReturnType<typeof supabase.rpc>>;
const BOM = String.fromCharCode(0xfeff);

describe("CSV okuma (2026-09-29)", () => {
  it("Türkçe Excel: noktalı virgül, BOM, CRLF, tırnaklı hücre", () => {
    const text =
      BOM + 'Ad Soyad;Sınıf\r\n"Koç; Selin";12-A\r\n"Ali ""Can"" Er";\r\n\r\n';
    expect(splitCsv(text)).toEqual([
      ["Ad Soyad", "Sınıf"],
      ["Koç; Selin", "12-A"],
      ['Ali "Can" Er', ""],
    ]);
  });

  it("virgül ayırıcı da tanınır", () => {
    expect(splitCsv("Ad Soyad,Sınıf\nDeniz,12-B")).toEqual([
      ["Ad Soyad", "Sınıf"],
      ["Deniz", "12-B"],
    ]);
  });

  it("şablon Türkçe Excel'de açılır: BOM ve noktalı virgül, başlıklar geri okunur", () => {
    const template = importTemplateCsv();
    expect(template.charCodeAt(0)).toBe(0xfeff);
    const table = splitCsv(template);
    expect(table[0]).toEqual([
      "Ad Soyad",
      "Öğrenci No",
      "Sınıf",
      "Veli Ad Soyad",
      "Veli Telefon",
    ]);
    expect(table[1][0]).toBe("Örnek Öğrenci");
  });
});

describe("importStudents", () => {
  beforeEach(() => vi.clearAllMocks());

  const rows: ImportRow[] = [
    {
      full_name: "Selin Koç",
      student_number: "",
      class_name: "",
      guardian_name: "",
      guardian_phone: "",
    },
  ];

  it("ön izleme ve kayıt aynı veritabanı fonksiyonuna gider", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { saved: false, row_count: 1, errors: [] },
      error: null,
    } as unknown as RpcResult);

    const result = await importStudents("org-1", rows, true);

    expect(supabase.rpc).toHaveBeenCalledWith("import_students", {
      p_organization_id: "org-1",
      p_rows: rows,
      p_dry_run: true,
    });
    expect(result).toMatchObject({ saved: false, rowCount: 1, errors: [] });
  });

  it("yetki hatası Türkçe söylenir", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: "42501", message: "x" },
    } as unknown as RpcResult);

    await expect(importStudents("org-1", rows, false)).rejects.toThrow(
      "yalnız kurum yöneticisi"
    );
  });
});

describe("ImportPreview", () => {
  const rows: ImportRow[] = [
    {
      full_name: "Selin Koç",
      student_number: "42",
      class_name: "12-Z",
      guardian_name: "",
      guardian_phone: "",
    },
  ];

  it("hata varken kaydet düğmesi yok; satır numarası dosyadaki satırdır", () => {
    const html = renderToStaticMarkup(
      createElement(ImportPreview, {
        fileName: "liste.csv",
        rows,
        rowLabels: ["4. satır"],
        result: {
          saved: false,
          rowCount: 1,
          errors: [
            {
              row: 1,
              field: "class_name",
              message: '"12-Z" adında bir sınıf yok',
            },
          ],
        },
        saving: false,
        onSave: () => {},
        onBack: () => {},
        onCancel: () => {},
      })
    );
    expect(html).toContain("1 hata — hiçbir şey kaydedilmedi");
    // Başlık 3. satırdaysa ilk öğrenci dosyanın 4. satırıdır.
    expect(html).toContain("4. satır");
    expect(html).toContain("Eşlemeyi değiştir");
    expect(html).toContain("Sınıf:");
    expect(html).not.toContain("öğrenciyi kaydet");
    expect(html).toContain("Düzeltip yeniden yükle");
  });

  it("hatasızsa kaydet düğmesi öğrenci sayısını söyler", () => {
    const html = renderToStaticMarkup(
      createElement(ImportPreview, {
        fileName: "liste.csv",
        rows,
        rowLabels: ["2. satır"],
        result: { saved: false, rowCount: 1, errors: [] },
        saving: false,
        onSave: () => {},
        onBack: () => {},
        onCancel: () => {},
      })
    );
    expect(html).toContain("hata yok, kaydedilmeye hazır");
    expect(html).toContain("1 öğrenciyi kaydet");
  });
});
