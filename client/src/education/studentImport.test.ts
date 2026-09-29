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
  parseStudentCsv,
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

  it("başlıklar farklı sırada ve farklı yazımla eşleşir", () => {
    const parsed = parseStudentCsv(
      "veli telefon;SINIF;ad soyad;Öğrenci No\n0555 111 22 33;12-A;Selin Koç;42"
    );
    expect(parsed).toEqual({
      ok: true,
      rows: [
        {
          full_name: "Selin Koç",
          student_number: "42",
          class_name: "12-A",
          guardian_name: "",
          guardian_phone: "0555 111 22 33",
        },
      ],
    });
  });

  it("'Ad Soyad' başlığı yoksa sebebini söyler", () => {
    const parsed = parseStudentCsv("İsim;Sınıf\nSelin;12-A");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain('"Ad Soyad"');
  });

  it("500'den fazla satır istemcide reddedilir", () => {
    const body = Array.from({ length: 501 }, (_, i) => `Öğrenci ${i}`).join(
      "\n"
    );
    const parsed = parseStudentCsv(`Ad Soyad\n${body}`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain("en çok 500");
  });

  it("şablon Türkçe Excel'de açılır: BOM ve noktalı virgül, başlıklar geri okunur", () => {
    const template = importTemplateCsv();
    expect(template.charCodeAt(0)).toBe(0xfeff);
    const parsed = parseStudentCsv(template);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.rows[0].full_name).toBe("Örnek Öğrenci");
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
        onCancel: () => {},
      })
    );
    expect(html).toContain("1 hata — hiçbir şey kaydedilmedi");
    expect(html).toContain("2. satır");
    expect(html).toContain("Sınıf:");
    expect(html).not.toContain("öğrenciyi kaydet");
    expect(html).toContain("Düzeltip yeniden yükle");
  });

  it("hatasızsa kaydet düğmesi öğrenci sayısını söyler", () => {
    const html = renderToStaticMarkup(
      createElement(ImportPreview, {
        fileName: "liste.csv",
        rows,
        result: { saved: false, rowCount: 1, errors: [] },
        saving: false,
        onSave: () => {},
        onCancel: () => {},
      })
    );
    expect(html).toContain("hata yok, kaydedilmeye hazır");
    expect(html).toContain("1 öğrenciyi kaydet");
  });
});
