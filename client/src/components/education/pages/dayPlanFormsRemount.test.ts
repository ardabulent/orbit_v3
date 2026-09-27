import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Gün Planı formları her açılışta sıfırdan kurulur.
 *
 * `TaskFormDialog` ve `CalendarEventFormDialog` alanlarını `useState`
 * başlangıç değerinden okuyor — yani yalnız İLK kuruluşta. Pencereler sayfada
 * hep kurulu kaldığı için sonraki açılışlarda gelen görev ve tarih hiç
 * okunmuyordu: "Görevi Düzenle" başlık, tarih ve not alanları BOŞ açılıyordu
 * ve "Bugün" sütunundaki "+" tarihi doldurmuyordu (ölçüldü, 2026-09-27).
 *
 * Düzeltme, her açılışta artan bir `formSession` sayacını `key` yapmak.
 * Projede DOM test ortamı yok (vitest `node`), bu yüzden kapı kaynağı okur:
 * iki pencerenin de `formSession`'a bağlı bir `key` taşıdığını ve her açılış
 * yolunun sayacı artırdığını denetler. Biri `key`'i kaldırırsa bu test kırılır.
 */

const kaynak = readFileSync(
  path.resolve(import.meta.dirname, "DayPlanPage.tsx"),
  "utf-8"
);

describe("Gün Planı formları her açılışta yeniden kurulur", () => {
  it("görev penceresi formSession'a bağlı bir key taşır", () => {
    expect(kaynak).toMatch(
      /<TaskFormDialog\s+key=\{`task-\$\{formSession\}`\}/
    );
  });

  it("görüşme penceresi formSession'a bağlı bir key taşır", () => {
    expect(kaynak).toMatch(
      /<CalendarEventFormDialog\s+key=\{`event-\$\{formSession\}`\}/
    );
  });

  it("dört açılış yolunun dördü de sayacı artırır", () => {
    const acilislar = kaynak.match(/set(Task|Calendar)FormOpen\(true\)/g) ?? [];
    const artislar =
      kaynak.match(
        /setFormSession\(session => session \+ 1\);\s*\n\s*set(Task|Calendar)FormOpen\(true\)/g
      ) ?? [];

    expect(acilislar).toHaveLength(4);
    expect(artislar).toHaveLength(acilislar.length);
  });
});
