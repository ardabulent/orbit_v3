import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Öğrenci–veli bağlama akışında "yazma başarılı, ekran eski" kusurları
 * (ROADMAP §4.23 C-02 · C-03 · C-05), 2026-09-28'de kökleri bulunarak kapatıldı.
 *
 * Projede DOM test ortamı yok (vitest `node`), bu yüzden kapılar kaynağı
 * okur. Her biri, düzeltme geri alınırsa kırılacak biçimde yazıldı.
 */

const oku = (...parca: string[]) =>
  readFileSync(path.resolve(import.meta.dirname, ...parca), "utf-8");

describe("C-03 — öğrenci paneli listenin güncel satırını gösterir", () => {
  const platform = oku("EducationPlatform.tsx");

  it("panel tıklanan anın kopyasını değil, listeden türetilen öğrenciyi alır", () => {
    expect(platform).toMatch(
      /const selectedStudent = useMemo\(\(\) => \{[\s\S]*?activeStudents\.find\(\s*item => item\.id === selectedStudentSnapshot\.id\s*\)/
    );
    expect(platform).toMatch(/student=\{selectedStudent\}/);
    // Kopya yalnız kimlik için tutulur; doğrudan panele verilmez.
    expect(platform).not.toMatch(/student=\{selectedStudentSnapshot\}/);
  });

  it("veliye hesap bağlanınca öğrencinin veli listesi de tazelenir", () => {
    // Öğrenci detayındaki "Hesap bağlı değil" rozeti bu sorgudan gelir.
    const tazeleme = platform.slice(
      platform.indexOf("const handleLinkGuardianAccount"),
      platform.indexOf("const handleUnlinkGuardianAccount")
    );
    expect(tazeleme).toContain(
      "educationKeys.studentGuardians(organizationId)"
    );
  });

  it("hiçbir sorgunun kullanmadığı 'organization-members' anahtarı kalmadı", () => {
    expect(platform).not.toContain('"organization-members"');
    expect(oku("pages", "GuardianFormDialog.tsx")).not.toContain(
      '"organization-members"'
    );
  });
});

describe("C-02 / C-05 — yeni hesap, pencere nasıl kapanırsa kapansın listeye düşer", () => {
  it("üye oluşturulduktan sonra X / dışarı tıklama / Esc de onDone'u çağırır", () => {
    const pencere = oku("pages", "MemberCreateDialog.tsx");
    const kapanis = pencere.slice(
      pencere.indexOf("const handleOpenChange"),
      pencere.indexOf("const effectiveBranchKey")
    );
    expect(kapanis).toMatch(
      /if \(!next && credentials\) \{\s*reset\(\);\s*onDone\(\);\s*return;/
    );
  });
});
