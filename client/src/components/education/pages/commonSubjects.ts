/**
 * "Yeni ders" diyaloğundaki hazır seçenekler.
 *
 * Dershanelerin çoğu aynı ders listesiyle başlıyor (YKS ve LGS); kurulumda
 * bunları tek tek yazdırmak gereksiz. Liste yalnız öneridir: veritabanına
 * tohum olarak girmez, kurum istemediğini seçmez, listede olmayanı elle yazar.
 * Adlar MEB müfredatındaki yazımla verildi.
 */
export const COMMON_SUBJECT_GROUPS: {
  label: string;
  subjects: readonly string[];
}[] = [
  {
    label: "YKS",
    subjects: [
      "Türkçe",
      "Matematik",
      "Geometri",
      "Fizik",
      "Kimya",
      "Biyoloji",
      "Türk Dili ve Edebiyatı",
      "Tarih",
      "Coğrafya",
      "Felsefe",
      "Din Kültürü ve Ahlak Bilgisi",
    ],
  },
  {
    label: "LGS",
    subjects: [
      "Türkçe",
      "Matematik",
      "Fen Bilimleri",
      "T.C. İnkılap Tarihi ve Atatürkçülük",
      "Din Kültürü ve Ahlak Bilgisi",
      "İngilizce",
    ],
  },
];

export const SUBJECT_NAME_MAX = 80;

const key = (name: string) => name.trim().toLocaleLowerCase("tr");

/**
 * Kurumda zaten açık olan dersleri çıkarır; aynı ders iki grupta geçiyorsa
 * yalnız ilk grupta gösterilir. Boş kalan grup dönmez.
 */
export function suggestSubjectGroups(
  existingNames: readonly string[]
): { label: string; subjects: string[] }[] {
  const taken = new Set(existingNames.map(key));
  const groups: { label: string; subjects: string[] }[] = [];
  for (const group of COMMON_SUBJECT_GROUPS) {
    const subjects = group.subjects.filter(name => {
      if (taken.has(key(name))) return false;
      taken.add(key(name));
      return true;
    });
    if (subjects.length > 0) groups.push({ label: group.label, subjects });
  }
  return groups;
}

/**
 * Seçilen hazır dersler ve elle yazılan ad → oluşturulacak adlar.
 * Büyük/küçük harf farkı aynı ders sayılır (Türkçe kurallarıyla); kurumda
 * zaten olan ad hata verir, sessizce atlanmaz — yönetici neden
 * eklenmediğini bilmeli.
 */
export function planSubjectNames(
  selected: readonly string[],
  typed: string,
  existingNames: readonly string[]
): { names: string[]; error: string | null } {
  const taken = new Set(existingNames.map(key));
  const names: string[] = [];
  const seen = new Set<string>();

  for (const raw of [...selected, typed]) {
    const name = raw.trim();
    if (!name) continue;
    if (name.length > SUBJECT_NAME_MAX) {
      return {
        names: [],
        error: `Ders adı en fazla ${SUBJECT_NAME_MAX} karakter olabilir.`,
      };
    }
    if (taken.has(key(name))) {
      return { names: [], error: `"${name}" dersi zaten var.` };
    }
    if (seen.has(key(name))) continue;
    seen.add(key(name));
    names.push(name);
  }

  if (names.length === 0) {
    return {
      names: [],
      error: "Listeden en az bir ders seçin ya da ders adını yazın.",
    };
  }
  return { names, error: null };
}
