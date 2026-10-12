import { supabase } from "@/lib/supabaseClient";

/**
 * Sınıfların öğretmen, rehber ve vekil adları (`class_staff_names` RPC, #231).
 *
 * Sınıf, ödev, ders programı ve sınıf öğretmenleri ekranları aynı çözümü
 * kullanır; 2026-10-12'ye kadar dört serviste birebir kopyaydı.
 *
 * `profiles` ya da `organization_memberships` tablosuna doğrudan gidilmez
 * (#228): öğrenci ve veli o satırları göremez, RPC yalnız adı döndürür.
 *
 * Hata bilinçli olarak boş haritaya düşer: ad yalnız gösterim içindir ve
 * çözülemeyen ad için hiçbir şey uydurulmaz (K-22) — ekran "—" gösterir.
 * Yetki kararı burada verilmez.
 */
export async function loadClassStaffNames(
  classIds: string[]
): Promise<Map<string, string>> {
  const unique = classIds.filter(
    (id, index) => Boolean(id) && classIds.indexOf(id) === index
  );
  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("class_staff_names", {
    target_class_ids: unique,
  });

  if (error || !data) {
    return new Map();
  }

  const result = new Map<string, string>();
  for (const row of data as {
    class_id: string;
    membership_id: string;
    display_name: string;
  }[]) {
    if (row.membership_id && row.display_name) {
      result.set(row.membership_id, row.display_name);
    }
  }
  return result;
}
