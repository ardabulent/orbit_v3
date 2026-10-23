-- Aynı adlı sınıf ve ders büyük/küçük harf farkıyla da açılamaz (2026-10-23).
--
-- Ana plan 1.4, test turu B2/B3: tekillik kuralı adın birebir yazımına
-- bakıyordu; "Matematik" ile "matematik", "12-A Sayısal" ile "12-a sayısal"
-- iki ayrı kayıt olarak açılabiliyordu. Sonuç: içe aktarma sınıfı adla
-- (`turkish_name_key`) eşlediği için "birden çok sınıf var" deyip dosyanın
-- tamamını reddediyordu; listelerde aynı ad iki kez görünüyordu.
--
-- Kural artık içe aktarmanın kullandığı anahtarla aynı: `turkish_name_key`
-- (Türkçe I/İ/ı dahil küçük harf, kenar boşluğu atılmış). Kapsam önceki
-- kuralla aynı: kurum geneli, yalnız arşivlenmemiş kayıtlar.
--
-- Canlıda önce ölçüldü (salt okuma, 2026-10-23): 1 aktif sınıf, 1 aktif ders,
-- kopya ad grubu 0 — indeks mevcut veride kurulabilir. Arşivden geri alınan
-- bir kayıt artık aynı adlı aktif kayıtla çakışırsa 23505 döner; arşiv ekranı
-- bunu zaten "aynı adlı kayıt var" diye çeviriyor.

drop index if exists public.classes_organization_name_idx;
create unique index classes_organization_name_key_idx
  on public.classes (organization_id, public.turkish_name_key(name))
  where archived_at is null;

drop index if exists public.subjects_organization_name_idx;
create unique index subjects_organization_name_key_idx
  on public.subjects (organization_id, public.turkish_name_key(name))
  where archived_at is null;
