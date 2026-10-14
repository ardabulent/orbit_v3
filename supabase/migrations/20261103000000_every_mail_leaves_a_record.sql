-- ALLOW-DESTRUCTIVE: `password_reset_requests` sayaç tablosu kaldırılır (2026-10-13'te açıldı, adres ya da numara taşımıyordu; görevi `email_deliveries`'e geçer). Fonksiyon gövdelerindeki "delete from" yalnız 30 günden eski gönderim kayıtlarını siler (KVKK: veri en az).
--
-- Her e-posta bir kayıt bırakır (2026-10-14, kurum sahibinin isteği).
--
-- İlk canlı şifre sıfırlama e-postası gönderilmiş ama Spam'e düşmüştü; hiçbir
-- yerde izi olmadığı için "gönderilmedi" sanıldı. Fonksiyon kayıtları ücretsiz
-- planda yaklaşık bir gün tutuluyor — "veli kod gelmedi diyor" şikâyetini iki
-- gün sonra incelemek mümkün değildi.
--
-- `email_deliveries`: kime (hesap), ne (kod / sıfırlama), ne zaman, sonuç ve
-- başarısızsa sebep (`smtp_535` gibi). **Tutulmayanlar bilinçli:** e-posta
-- adresi (profilde zaten var), kod ve bağlantı (deftere bakabilen biri
-- başkasının hesabını açabilirdi). 30 gün sonra silinir.
--
-- Şifremi unuttum hız sınırı artık bu defterden sayılır; ayrı sayaç tablosu
-- (`password_reset_requests`) kalkar — iki yerde tutulan kayıt (K-06).
--
-- Kurum yöneticisi Ayarlar → Üyeler'de her üyenin kurtarma adresi olup
-- olmadığını (adresin kendisini değil) ve son e-postasının sonucunu görür:
-- "kod gelmedi" diyen veliye "gönderilmiş, Spam'e bakın" diyebilsin.

-- 1. Defter ------------------------------------------------------------------------

create table public.email_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('recovery_code', 'password_reset')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  reason text check (reason is null or char_length(reason) <= 80),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index email_deliveries_user_idx on public.email_deliveries (user_id, created_at desc);
create index email_deliveries_created_idx on public.email_deliveries (created_at);

comment on table public.email_deliveries is
  'Gönderilen e-postaların defteri: kime (hesap), ne, ne zaman, sonuç. Adres, kod ve bağlantı TUTULMAZ. 30 gün sonra silinir. Politika yok: yalnız security definer fonksiyonlar dokunur.';

alter table public.email_deliveries enable row level security;
revoke all on public.email_deliveries from anon, authenticated;

-- 2. Defter yazımı (yalnız Edge fonksiyonları) -------------------------------------

create function public.internal_begin_email_delivery(target_user_id uuid, delivery_kind text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  kimlik bigint;
begin
  delete from public.email_deliveries as eski
  where eski.created_at < now() - interval '30 days';

  insert into public.email_deliveries (user_id, kind)
  values (target_user_id, delivery_kind)
  returning id into kimlik;
  return kimlik;
end;
$$;

create function public.internal_finish_email_delivery(
  delivery_id bigint,
  delivery_status text,
  failure_reason text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_deliveries as kayit
  set status = delivery_status,
      reason = left(failure_reason, 80),
      finished_at = now()
  where kayit.id = delivery_id;
$$;

revoke all on function public.internal_begin_email_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.internal_finish_email_delivery(bigint, text, text) from public, anon, authenticated;

-- 3. Şifremi unuttum: sayaç defterden ---------------------------------------------

-- Dönüş tipi değişiyor (`delivery_id` eklendi); `create or replace` bunu kabul
-- etmez.
drop function public.internal_claim_password_reset(text);

create function public.internal_claim_password_reset(target_login_email text)
returns table (user_id uuid, auth_email text, destination text, delivery_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  kullanici uuid;
  giris text;
  hedef text;
begin
  select kisi.id, kisi.email into kullanici, giris
  from auth.users as kisi
  where lower(kisi.email) = lower(btrim(target_login_email))
    and kisi.deleted_at is null
    and (kisi.banned_until is null or kisi.banned_until <= now());

  if kullanici is null then
    return;
  end if;

  if not exists (
       select 1 from public.organization_memberships as uyelik
       where uyelik.user_id = kullanici and uyelik.status = 'active')
     and not exists (
       select 1 from public.platform_operators as operator
       where operator.user_id = kullanici and operator.status = 'active')
  then
    return;
  end if;

  select nullif(btrim(profil.recovery_email), '') into hedef
  from public.profiles as profil where profil.id = kullanici;

  if hedef is null and giris not like '%@orbit.invalid' then
    hedef := giris;
  end if;
  if hedef is null then
    return;
  end if;

  -- Eşzamanlı iki istek aynı sayımı birlikte geçmesin.
  perform pg_advisory_xact_lock(hashtext('email_deliveries:password_reset'));

  if (select count(*) from public.email_deliveries as kayit
      where kayit.kind = 'password_reset' and kayit.user_id = kullanici
        and kayit.created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.email_deliveries as kayit
         where kayit.kind = 'password_reset'
           and kayit.created_at > now() - interval '1 hour') >= 100
  then
    return;
  end if;

  user_id := kullanici;
  auth_email := giris;
  destination := hedef;
  delivery_id := public.internal_begin_email_delivery(kullanici, 'password_reset');
  return next;
end;
$$;

revoke all on function public.internal_claim_password_reset(text) from public, anon, authenticated;

drop table public.password_reset_requests;

-- 4. Yönetici görünümü ------------------------------------------------------------

-- Ayarlar → Üyeler. Tam yetkili yönetici kurumundaki bütün üyeleri, şube
-- yöneticisi kendi şubesindekileri görür (üyelik listesiyle aynı ölçüt,
-- göç 20261027000000'daki dizi fonksiyonları). Kurtarma ADRESİ dönmez, yalnız
-- var olup olmadığı.
create function public.member_email_status()
returns table (
  membership_id uuid,
  has_recovery_email boolean,
  last_kind text,
  last_status text,
  last_reason text,
  last_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    uyelik.id,
    profil.recovery_email is not null,
    son.kind,
    son.status,
    son.reason,
    son.created_at
  from public.organization_memberships as uyelik
  join public.profiles as profil on profil.id = uyelik.user_id
  left join lateral (
    select kayit.kind, kayit.status, kayit.reason, kayit.created_at
    from public.email_deliveries as kayit
    where kayit.user_id = uyelik.user_id
    order by kayit.created_at desc, kayit.id desc
    limit 1
  ) as son on true
  where not (select public.current_user_must_change_password())
    and (
      uyelik.organization_id = any((select public.current_user_full_admin_org_ids())::uuid[])
      or uyelik.branch_id = any((select public.current_user_admin_branch_ids())::uuid[])
    );
$$;

revoke all on function public.member_email_status() from public, anon;
grant execute on function public.member_email_status() to authenticated;
