-- Kurum kapatma ve boşaltma (2026-10-25, ana plan 2.5).
--
--   1–2. Kapatmayı yalnız platform operatörü yapar.
--   3–4. Kapatma iz bırakır; ikinci kapatma saati yeniden başlatmaz.
--   5–8. Kapalı kurumun yöneticisi ve öğrencisi kilitlidir: içerik
--        tablolarının HİÇBİRİNDEN satır okuyamaz (liste katalogdan gelir,
--        yeni tablo kendiliğinden kapsanır), Edge kapısında da durur.
--   9.   Başka kurumun yöneticisi etkilenmez.
--   10.  Sayaç eksiksiz içerik ve boşaltılabileceği anı gösterir.
--   11–13. ⛔ Açık kurum, süresi dolmamış kurum ve yanlış kod reddedilir.
--   14.  Yeniden açma kilidi kaldırır.
--   15–19. Boşaltma: bütün içerik ve kurum denetim kaydı gider, yabancı
--        anahtarla birbirini tutan tablolar sırayla silinir, iz tablo
--        başına sayılarla platform kaydına düşer, ardından kurum silinebilir;
--        başka kurumun verisine dokunulmaz.
--   20–21. Gece işi kapı defterinin 7 günden eski satırlarını siler.

begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('f5100000-0000-0000-0000-0000000f5100', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kp-operator@example.test', '', now(), now()),
  ('f5200000-0000-0000-0000-0000000f5200', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kp-yonetici@example.test', '', now(), now()),
  ('f5300000-0000-0000-0000-0000000f5300', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kp-ogrenci@example.test', '', now(), now()),
  ('f5400000-0000-0000-0000-0000000f5400', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kp-baska-yonetici@example.test', '', now(), now());

update public.profiles set must_change_password = false, password_expires_at = null
 where id in (
   'f5100000-0000-0000-0000-0000000f5100', 'f5200000-0000-0000-0000-0000000f5200',
   'f5300000-0000-0000-0000-0000000f5300', 'f5400000-0000-0000-0000-0000000f5400'
 );

insert into public.platform_operators (user_id, role, status)
values ('f5100000-0000-0000-0000-0000000f5100', 'owner', 'active');

insert into public.organizations (id, name, slug, code)
values
  ('f6100000-0000-0000-0000-0000000f6100', 'Kapanan Kurum', 'kapanan-kurum', 8931),
  ('f6200000-0000-0000-0000-0000000f6200', 'Komşu Kurum', 'komsu-kurum', 8932);

insert into public.branches (organization_id, name, is_default)
values
  ('f6100000-0000-0000-0000-0000000f6100', 'Merkez', true),
  ('f6200000-0000-0000-0000-0000000f6200', 'Merkez', true);

insert into public.organization_memberships
  (organization_id, user_id, role, status, person_code)
values
  ('f6100000-0000-0000-0000-0000000f6100', 'f5200000-0000-0000-0000-0000000f5200', 'admin', 'active', 1000),
  ('f6100000-0000-0000-0000-0000000f6100', 'f5300000-0000-0000-0000-0000000f5300', 'student', 'active', 1001),
  ('f6200000-0000-0000-0000-0000000f6200', 'f5400000-0000-0000-0000-0000000f5400', 'admin', 'active', 1000);

insert into public.students (id, organization_id, full_name, auth_user_id)
values
  ('f7100000-0000-0000-0000-0000000f7100', 'f6100000-0000-0000-0000-0000000f6100', 'Kapanan Öğrenci', 'f5300000-0000-0000-0000-0000000f5300'),
  ('f7200000-0000-0000-0000-0000000f7200', 'f6200000-0000-0000-0000-0000000f6200', 'Komşu Öğrenci', null);

insert into public.guardians (id, organization_id, full_name)
values ('f7300000-0000-0000-0000-0000000f7300', 'f6100000-0000-0000-0000-0000000f6100', 'Kapanan Veli');

insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('f6100000-0000-0000-0000-0000000f6100', 'f7100000-0000-0000-0000-0000000f7100', 'f7300000-0000-0000-0000-0000000f7300');

insert into public.classes (id, organization_id, name)
values ('f7400000-0000-0000-0000-0000000f7400', 'f6100000-0000-0000-0000-0000000f6100', '12-K');

insert into public.class_enrollments (organization_id, class_id, student_id)
values ('f6100000-0000-0000-0000-0000000f6100', 'f7400000-0000-0000-0000-0000000f7400', 'f7100000-0000-0000-0000-0000000f7100');

-- Birbirini tutan iki taklit tablo. Üst tablo adı alfabede önce geliyor;
-- boşaltmanın ilk turunda üst tabloyu silmek yabancı anahtara takılır ve
-- ancak alt tablo boşalınca ikinci turda gider. Sabit bir sıra yazılsaydı
-- bu tablolar fonksiyon yazıldığında var olmadığı için kapsanmazdı.
create table public.aa_ust_taklit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id)
);
create table public.zz_alt_taklit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id),
  ust_id bigint not null references public.aa_ust_taklit (id) on delete restrict
);
-- Gerçek kurum tabloları gibi RLS açık: tenant tablosu RLS'siz olmaz.
alter table public.aa_ust_taklit enable row level security;
alter table public.zz_alt_taklit enable row level security;
with ust as (
  insert into public.aa_ust_taklit (organization_id)
  values ('f6100000-0000-0000-0000-0000000f6100')
  returning id
)
insert into public.zz_alt_taklit (organization_id, ust_id)
select 'f6100000-0000-0000-0000-0000000f6100', id from ust;

insert into public.audit_events (organization_id, actor_user_id, action, entity_type, entity_id)
values ('f6100000-0000-0000-0000-0000000f6100', 'f5200000-0000-0000-0000-0000000f5200',
        'test.event', 'test', 'f6100000-0000-0000-0000-0000000f6100');

-- Çağıranın gözünden bütün içerik tablolarındaki toplam satır. Liste
-- katalogdan, yetkili rolken alınıyor; okuma çağıranın rolüyle yapılıyor.
create temp table icerik_tablolari as
  select public.internal_organization_content_tables() as ad;
grant select on icerik_tablolari to authenticated;

create function pg_temp.gorunen_icerik()
returns bigint
language plpgsql
as $$
declare
  tablo text;
  adet bigint;
  toplam bigint := 0;
begin
  -- Rolün hiç okuma yetkisi olmayan tablo (ör. client_error_reports) zaten
  -- kapalıdır; sayılmaz.
  for tablo in
    select ad from icerik_tablolari
    where has_table_privilege(format('public.%I', ad), 'select')
  loop
    execute format('select count(*) from public.%I', tablo) into adet;
    toplam := toplam + adet;
  end loop;
  return toplam;
end;
$$;

create function pg_temp.kod(sql text)
returns text
language plpgsql
as $$
begin
  execute sql;
  return 'basarili';
exception when others then
  return sqlstate;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1 · Yönetici kapatamaz
select set_config('request.jwt.claim.sub', 'f5200000-0000-0000-0000-0000000f5200', true);
select is(
  pg_temp.kod($$select public.platform_close_organization('f6100000-0000-0000-0000-0000000f6100')$$),
  '42501',
  'a kurum admin cannot close an organization'
);

-- 2 · Kapanmadan önce yönetici öğrenciyi görüyor (aşağıdaki sıfırın anlamı olsun)
select is(
  (select count(*) from public.students),
  1::bigint,
  'before closing the admin reads their student'
);

-- 3 · Operatör kapatır; iz kalır
select set_config('request.jwt.claim.sub', 'f5100000-0000-0000-0000-0000000f5100', true);
select public.platform_close_organization('f6100000-0000-0000-0000-0000000f6100');
reset role;
select ok(
  (select archived_at is not null from public.organizations where id = 'f6100000-0000-0000-0000-0000000f6100')
  and exists (
    select 1 from public.platform_audit_events
    where action = 'platform.organization_closed'
      and entity_id = 'f6100000-0000-0000-0000-0000000f6100'
      and actor_user_id = 'f5100000-0000-0000-0000-0000000f5100'
  ),
  'the operator closes the organization and the closing is recorded'
);

-- 4 · İkinci kapatma saati yeniden başlatmaz, ikinci iz yazmaz
update public.organizations set archived_at = now() - interval '2 days'
 where id = 'f6100000-0000-0000-0000-0000000f6100';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f5100000-0000-0000-0000-0000000f5100', true);
select public.platform_close_organization('f6100000-0000-0000-0000-0000000f6100');
reset role;
select ok(
  (select archived_at < now() - interval '1 day' from public.organizations where id = 'f6100000-0000-0000-0000-0000000f6100')
  and (select count(*) from public.platform_audit_events
        where action = 'platform.organization_closed'
          and entity_id = 'f6100000-0000-0000-0000-0000000f6100') = 1,
  'closing again keeps the original clock and writes no second record'
);

-- 5–6 · Yönetici kilitli ve hiçbir içerik tablosundan satır okuyamıyor
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f5200000-0000-0000-0000-0000000f5200', true);
select ok(
  public.current_user_must_change_password(),
  'the admin of a closed organization is locked'
);
select is(
  pg_temp.gorunen_icerik(),
  0::bigint,
  'the admin of a closed organization reads no row from any content table'
);

-- 7 · Öğrenci hesabı da (üyelik ve auth_user_id bağı) hiçbir şey okuyamıyor
select set_config('request.jwt.claim.sub', 'f5300000-0000-0000-0000-0000000f5300', true);
select is(
  pg_temp.gorunen_icerik(),
  0::bigint,
  'the student account of a closed organization reads no row from any content table'
);
reset role;

-- 8 · Edge kapısı
select is(
  (public.internal_begin_function_call('create-member', 'f5200000-0000-0000-0000-0000000f5200') ->> 'reason'),
  'password_locked',
  'the admin of a closed organization is stopped at the function gate'
);

-- 9 · Komşu kurumun yöneticisi etkilenmiyor
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f5400000-0000-0000-0000-0000000f5400', true);
select ok(
  not public.current_user_must_change_password()
  and (select count(*) from public.students) = 1,
  'the admin of another organization is not affected'
);

-- 10 · Sayaç
select set_config('request.jwt.claim.sub', 'f5100000-0000-0000-0000-0000000f5100', true);
select ok(
  (public.platform_organization_stats('f6100000-0000-0000-0000-0000000f6100') -> 'content')
    @> '{"students": 1, "guardians": 1, "student_guardians": 1, "classes": 1, "class_enrollments": 1, "aa_ust_taklit": 1, "zz_alt_taklit": 1}'::jsonb
  and (public.platform_organization_stats('f6100000-0000-0000-0000-0000000f6100') ->> 'purge_available_at')::timestamptz
    = (select archived_at + interval '30 days' from public.organizations where id = 'f6100000-0000-0000-0000-0000000f6100'),
  'the stats list every content table and when the purge becomes possible'
);

-- 11 · Süre dolmadan boşaltma yok
select is(
  pg_temp.kod($$select public.platform_purge_organization('f6100000-0000-0000-0000-0000000f6100', 8931)$$),
  'ORB03',
  'an organization closed for less than 30 days cannot be purged'
);

-- 12 · Yanlış kod
reset role;
update public.organizations set archived_at = now() - interval '31 days'
 where id = 'f6100000-0000-0000-0000-0000000f6100';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f5100000-0000-0000-0000-0000000f5100', true);
select is(
  pg_temp.kod($$select public.platform_purge_organization('f6100000-0000-0000-0000-0000000f6100', 8932)$$),
  '22023',
  'a purge with the wrong confirmation code is refused'
);

-- 13–14 · Yeniden açma kilidi kaldırır; açık kurum boşaltılamaz
select public.platform_reopen_organization('f6100000-0000-0000-0000-0000000f6100');
select is(
  pg_temp.kod($$select public.platform_purge_organization('f6100000-0000-0000-0000-0000000f6100', 8931)$$),
  'ORB02',
  'an open organization cannot be purged'
);
select set_config('request.jwt.claim.sub', 'f5200000-0000-0000-0000-0000000f5200', true);
select ok(
  not public.current_user_must_change_password()
  and (select count(*) from public.students) = 1,
  'reopening lifts the lock'
);

-- 15 · Boşaltma
reset role;
update public.organizations set archived_at = now() - interval '31 days'
 where id = 'f6100000-0000-0000-0000-0000000f6100';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f5100000-0000-0000-0000-0000000f5100', true);
select is(
  (public.platform_purge_organization('f6100000-0000-0000-0000-0000000f6100', 8931) ->> 'deleted_total')::int,
  7,
  'the purge reports how many content rows it deleted'
);
reset role;

-- 16 · Hiçbir içerik ve kurum denetim kaydı kalmadı (birbirini tutan tablolar dahil)
select ok(
  public.internal_organization_content_counts('f6100000-0000-0000-0000-0000000f6100') = '{}'::jsonb
  and not exists (select 1 from public.audit_events where organization_id = 'f6100000-0000-0000-0000-0000000f6100'),
  'no content and no organization audit trail is left, including tables that hold each other'
);

-- 17 · İz: tablo başına sayılar, içerik yok
select ok(
  exists (
    select 1 from public.platform_audit_events
    where action = 'platform.organization_purged'
      and entity_id = 'f6100000-0000-0000-0000-0000000f6100'
      and actor_user_id = 'f5100000-0000-0000-0000-0000000f5100'
      and metadata -> 'deleted' @> '{"students": 1, "zz_alt_taklit": 1}'::jsonb
      and (metadata ->> 'deleted_audit_events')::int >= 1
  ),
  'the purge leaves a platform record with per-table counts'
);

-- 18 · Ardından kurum silinebiliyor (içerik koruması artık engel değil)
select is(
  (public.internal_delete_organization(
     'f6100000-0000-0000-0000-0000000f6100', 'f5100000-0000-0000-0000-0000000f5100'
   ) ->> 'deleted_memberships')::int,
  2,
  'after the purge the organization can be deleted'
);

-- 19 · Komşu kurumun verisi yerinde
select ok(
  exists (select 1 from public.students where id = 'f7200000-0000-0000-0000-0000000f7200'),
  'the purge does not touch another organization'
);

-- 20–21 · Gece işi: kapı defteri
insert into public.internal_function_calls (function_slug, caller_user_id, idempotency_key, created_at)
values
  ('create-member', 'f5400000-0000-0000-0000-0000000f5400', 'kp-eski', now() - interval '8 days'),
  ('create-member', 'f5400000-0000-0000-0000-0000000f5400', 'kp-taze', now() - interval '1 day');

select ok(
  (public.internal_purge_expired_records() ->> 'function_calls')::int >= 1,
  'the nightly purge reports the old function-call rows it removed'
);
select is(
  (select array_agg(idempotency_key order by idempotency_key)
     from public.internal_function_calls
    where caller_user_id = 'f5400000-0000-0000-0000-0000000f5400'),
  array['kp-taze'],
  'rows older than 7 days are gone, newer ones stay'
);

select * from finish();
rollback;
