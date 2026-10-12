-- ALLOW-DESTRUCTIVE: `workspace_documents` düşürülüyor (#148). v1.0'dan kalma, hiç politikası yok, tablo yetkileri 20260822221832'de kaldırıldı, üretimde 0 satır; içinde satır varsa göç aşağıda durur ve hiçbir şey silmez.
--
-- Kullanılmayan belge tablosu kaldırılır (2026-10-12, #148).
--
-- Tablo hiçbir role açık değildi (RLS açık, politika yok, yetki yok) ve
-- istemcideki tek okuyucusu `lib/documents.ts` hiçbir yerden çağrılmıyordu.
-- Zararsızdı ama yanıltıcıydı: kodu okuyan "belge yönetimi var" sanıyor,
-- güvenlik denetçisi kalıcı bir `rls_enabled_no_policy` uyarısı taşıyordu.
--
-- v1.6-01 (Storage) bu tabloyu kullanmayacak: o tasarım private bucket +
-- imzalı bağlantı istiyor, bu tablo public URL saklıyordu. Belgeler o gün
-- kendi şemasıyla yeniden kurulur.
--
-- Yabancı anahtar, tetikleyici, görünüm, fonksiyon ya da yayın bağı yok
-- (2026-10-12'de katalogdan ölçüldü).

do $$
begin
  if exists (select 1 from public.workspace_documents) then
    raise exception 'workspace_documents boş değil; düşürülmedi. Satırlar incelenmeden bu göç uygulanamaz.';
  end if;
end;
$$;

drop table public.workspace_documents;
