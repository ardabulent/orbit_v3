-- Şifre değişimi izi uygulamadan da yazılır.
--
-- 20261016000000 izi `auth.audit_log_entries` tetikleyicisine bağlamıştı.
-- Yerelde çalıştı; ÜRETİMDE HİÇ ÇALIŞMAZ: barındırılan Supabase GoTrue olay
-- kayıtlarını veritabanına değil kendi günlük sistemine yazıyor. Üretimde
-- `auth.audit_log_entries` 2026-09-30'da ölçüldü: TOPLAM 0 satır, proje
-- açıldığından beri. Yerel yığın yazdığı için fark test ortamında
-- görünmedi — bir sağlayıcı ayrımı daha ancak üretimde ölçülerek bulundu.
--
-- Bu göç `log_own_password_change()` RPC'sini ekler: istemci
-- (`changeOwnPassword`) başarılı `updateUser`'dan hemen sonra çağırır.
-- Tetikleyici yerinde kalır (kendi sunucumuzda GoTrue bu tabloyu yazarsa iz
-- oradan da düşer); iki kaynak aynı olayı İKİ KEZ yazmasın diye ikisi de
-- "aynı kişinin son 2 dakikada kaydı var mı" diye bakar.
--
-- ⚠️ Bilinen zayıflık — açıkça: uygulamayı atlayıp GoTrue'yu doğrudan
-- çağıran biri şifresini değiştirip RPC'yi çağırmayabilir; o durumda iz
-- düşmez. Üretimde GoTrue'nun kendi olay günlüğü (Supabase panelinde
-- Auth Logs) yine vardır; bu kayıt kurum yöneticisinin görebildiği ikinci
-- bir iz, tek güvenlik kanıtı değil.
--
-- Sahte izi zorlaştırmak için RPC yalnız hesap son 5 dakikada güncellenmişse
-- (`auth.users.updated_at`) yazar ve kişi başına 2 dakikada en çok bir kayıt
-- düşer. Kimse başkası adına yazamaz: kişi her zaman `auth.uid()`.

create function public.log_own_password_change()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  kisi uuid := auth.uid();
  yazilan integer;
begin
  if kisi is null then
    raise exception 'Oturum yok' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users as u
     where u.id = kisi and u.updated_at > now() - interval '5 minutes'
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.audit_events as k
     where k.actor_user_id = kisi
       and k.action = 'account.password_changed'
       and k.created_at > now() - interval '2 minutes'
  ) then
    return false;
  end if;

  insert into public.audit_events (
    organization_id, branch_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  select uyelik.organization_id, uyelik.branch_id, kisi,
         'account.password_changed', 'organization_membership', uyelik.id, '{}'::jsonb
  from public.organization_memberships as uyelik
  where uyelik.user_id = kisi and uyelik.status = 'active';

  get diagnostics yazilan = row_count;
  return yazilan > 0;
end;
$$;

comment on function public.log_own_password_change() is
  'Kişi kendi şifresini değiştirdikten sonra istemcinin çağırdığı iz: etkin üyeliklerin kurumlarına account.password_changed. Yalnız hesap son 5 dakikada güncellendiyse; kişi başına 2 dakikada bir. Üretimde auth.audit_log_entries yazılmadığı için (2026-09-30 ölçümü) asıl yol budur; atlanabilir olduğu migration başlığında yazılı.';

revoke all on function public.log_own_password_change() from public, anon;
grant execute on function public.log_own_password_change() to authenticated;

-- Tetikleyici de aynı iki dakika kuralına uyar: ikisi birden çalışırsa tek iz.
create or replace function public.record_own_password_change()
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

  if exists (
    select 1 from public.audit_events as k
     where k.actor_user_id = kisi
       and k.action = 'account.password_changed'
       and k.created_at > now() - interval '2 minutes'
  ) then
    return new;
  end if;

  insert into public.audit_events (
    organization_id, branch_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  select uyelik.organization_id, uyelik.branch_id, kisi,
         'account.password_changed', 'organization_membership', uyelik.id, '{}'::jsonb
  from public.organization_memberships as uyelik
  where uyelik.user_id = kisi and uyelik.status = 'active';

  return new;
end;
$$;
