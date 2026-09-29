-- Şifre değişimi iz bırakır.
--
-- Ayarlar → Güvenlik'e "Şifremi değiştir" eklendi (karar 2026-09-29).
-- 2026-08-24 kararı değiştirme ile sıfırlamayı iki ayrı akış olarak
-- tanımlamıştı ama kişinin kendi isteğiyle şifresini değiştireceği bir yer
-- yoktu. Şifre değişimi de bugüne kadar hiçbir denetim kaydı bırakmıyordu.
--
-- Kaydın nereye bağlandığı ÖLÇÜLEREK seçildi (2026-09-29, yerel):
--
--   * İlk taslak `handle_password_change` (auth.users tetikleyicisi) içinde
--     `auth.uid() = new.id` koşuluyla yazıyordu. Veritabanı testi geçti ama
--     tarayıcıdan gerçek değişimde HİÇ kayıt düşmedi: şifreyi Supabase Auth
--     (GoTrue) kendi bağlantısıyla yazar ve o bağlantıda `auth.uid()` boştur.
--     Test, oturum kimliğini elle koyarak gerçekte olmayan bir durumu
--     sınıyordu. O taslak geri alındı; `handle_password_change` değişmedi.
--   * GoTrue her kimlik olayını `auth.audit_log_entries`'e yazar. Kişi kendi
--     şifresini değiştirince eylem `user_updated_password` ve `actor_id`
--     kişinin kendisidir. Yönetici arayüzünden konan şifre (bizde
--     `reset-member-password`) ise `user_modified` olarak yazılır — o işlem
--     Edge Function'da zaten `membership.password_reset` olarak kaydediliyor,
--     iki kez yazılmaz.
--
-- Bu göç `auth.audit_log_entries`'e bir tetikleyici ekler: yalnız
-- `user_updated_password` olayında, kişinin etkin üyeliği olan HER kurumun
-- kaydına `account.password_changed` düşer. İlk girişteki zorunlu değişim ve
-- sıfırlama bağlantısıyla yapılan değişim de kişinin kendi işlemidir; onlar
-- da yazılır. `metadata` boştur — şifreye dair hiçbir şey yazılmaz.
--
-- Taşınabilirlik notu (AGENTS kısıt 6): bu tablo GoTrue'ya özgüdür; kendi
-- sunucumuzdaki Supabase de GoTrue kullandığı için taşınma bunu bozmaz. Auth
-- sağlayıcısı değişirse bu tetikleyicinin karşılığı yazılmalıdır.
--
-- Tetikleyici HATA FIRLATMAZ: denetim kaydı yazılamazsa (ör. profil yok)
-- kullanıcının şifre değişimi düşmemeli. Bu yüzden yalnız eşleşen üyelikler
-- için ekleme yapılır, başka hiçbir kontrol hata üretmez.

create function public.record_own_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kisi uuid;
begin
  if new.payload is null
     or (new.payload ->> 'action') is distinct from 'user_updated_password' then
    return new;
  end if;

  begin
    kisi := (new.payload ->> 'actor_id')::uuid;
  exception when invalid_text_representation then
    return new;
  end;

  insert into public.audit_events (
    organization_id, branch_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  select
    uyelik.organization_id,
    uyelik.branch_id,
    kisi,
    'account.password_changed',
    'organization_membership',
    uyelik.id,
    '{}'::jsonb
  from public.organization_memberships as uyelik
  where uyelik.user_id = kisi
    and uyelik.status = 'active';

  return new;
end;
$$;

comment on function public.record_own_password_change() is
  'auth.audit_log_entries tetikleyicisi: GoTrue `user_updated_password` yazdığında (kişi kendi şifresini değiştirdi) kişinin etkin üyeliklerinin kurumlarına `account.password_changed` denetim kaydı ekler. Yönetici sıfırlaması `user_modified` olduğu için buradan geçmez (Edge Function kendi kaydını yazar). metadata boş.';

revoke all on function public.record_own_password_change() from public, anon, authenticated;

create trigger on_auth_password_updated_by_user
after insert on auth.audit_log_entries
for each row
execute function public.record_own_password_change();
