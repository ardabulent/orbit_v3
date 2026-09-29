-- Denetim Kaydı ekranı (2026-09-29): `organization_audit_feed`.
--
--   1. Kaydın adı kurulur (öğrenci eklendi → öğrencinin adı).
--   2. Güncellemede değişen alanın ADI döner (veli telefonu → {phone}).
--   3. ⛔ Telefonun DEĞERİ çıktının hiçbir yerinde yok.
--   4–7. Süzgeçler: işlem türü (güncelleme, arşiv, "diğer"), kayıt türü.
--   8. Kim yaptı süzgeci.
--   9. Anahtar kümesiyle sayfalama: bir sonraki sayfa daha eski kayıt.
--  10. Tarih süzgeci İstanbul gününe göre (yarından itibaren → boş).
--  11. ⛔ Öğretmen hiçbir satır görmez (yalnız yönetici).
--  12. ⛔ Bilinmeyen işlem türü 22023.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('b0110000-0000-0000-0000-0000000b0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dn-yonetici@example.test', '', now(), now()),
  ('b0120000-0000-0000-0000-0000000b0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dn-yonetici2@example.test', '', now(), now()),
  ('b0130000-0000-0000-0000-0000000b0130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dn-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('b0210000-0000-0000-0000-0000000b0210', 'Denetim Dershanesi', 'denetim-dershanesi', 7995);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('b0310000-0000-0000-0000-0000000b0310', 'b0210000-0000-0000-0000-0000000b0210',
   'b0110000-0000-0000-0000-0000000b0110', 'admin', 'active'),
  ('b0320000-0000-0000-0000-0000000b0320', 'b0210000-0000-0000-0000-0000000b0210',
   'b0120000-0000-0000-0000-0000000b0120', 'admin', 'active'),
  ('b0330000-0000-0000-0000-0000000b0330', 'b0210000-0000-0000-0000-0000000b0210',
   'b0130000-0000-0000-0000-0000000b0130', 'teacher', 'active');

-- Birinci yönetici öğrenciyi ve veliyi ekliyor
select set_config('request.jwt.claim.sub', 'b0110000-0000-0000-0000-0000000b0110', true);

insert into public.students (id, organization_id, full_name, student_number)
values ('b0710000-0000-0000-0000-0000000b0710', 'b0210000-0000-0000-0000-0000000b0210',
        'Denetim Öğrencisi', '7001');

insert into public.guardians (id, organization_id, full_name, phone)
values ('b0810000-0000-0000-0000-0000000b0810', 'b0210000-0000-0000-0000-0000000b0210',
        'Denetim Velisi', '05551112233');

-- İkinci yönetici velinin telefonunu değiştiriyor ve öğrenciyi arşivliyor
select set_config('request.jwt.claim.sub', 'b0120000-0000-0000-0000-0000000b0120', true);

update public.guardians set phone = '05559998877'
 where id = 'b0810000-0000-0000-0000-0000000b0810';
update public.students set archived_at = now()
 where id = 'b0710000-0000-0000-0000-0000000b0710';

-- Tetikleyici dışı bir eylem ("diğer")
insert into public.audit_events (organization_id, actor_user_id, action, entity_type, entity_id)
values ('b0210000-0000-0000-0000-0000000b0210', 'b0110000-0000-0000-0000-0000000b0110',
        'membership.password_reset', 'organization_membership',
        'b0330000-0000-0000-0000-0000000b0330');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b0110000-0000-0000-0000-0000000b0110', true);

-- 1 · Öğrenci eklendi → adı
select is(
  (select label from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210') where action = 'student.created'),
  'Denetim Öğrencisi',
  'a created student is named in the log'
);

-- 2 · Telefon değişti → alan adı
select is(
  (select label || ' ' || changed::text
     from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210') where action = 'guardian.updated'),
  'Denetim Velisi {phone}',
  'an update names the guardian and the field that changed'
);

-- 3 · Telefonun değeri hiçbir yerde yok
select is(
  (select count(*) from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210') as satir
    where row_to_json(satir)::text ~ '0555(1112233|9998877)'),
  0::bigint,
  'no phone number ever leaves the function — neither the old nor the new one'
);

-- 4 · Yalnız güncellemeler
select is(
  (select string_agg(distinct action, ',')
     from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210', p_action_kind => 'updated')),
  'guardian.updated',
  'the updated filter returns only updates'
);

-- 5 · Yalnız arşivlemeler
select is(
  (select string_agg(action, ',')
     from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210', p_action_kind => 'archived')),
  'student.archived',
  'the archived filter returns only archivals'
);

-- 6 · "Diğer": dört temel eylemden hiçbiri olmayan
select is(
  (select string_agg(action, ',')
     from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210', p_action_kind => 'other')),
  'membership.password_reset',
  'the other filter returns actions outside create/update/archive/restore'
);

-- 7 · Kayıt türü
select is(
  (select string_agg(action, ',' order by action)
     from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210', p_entity_type => 'guardian')),
  'guardian.created,guardian.updated',
  'the entity filter returns only that kind of record'
);

-- 8 · Kim yaptı: ikinci yönetici yalnız değiştirdi ve arşivledi
select is(
  (select string_agg(action, ',' order by action)
     from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210', p_actor_user_id => 'b0120000-0000-0000-0000-0000000b0120')),
  'guardian.updated,student.archived',
  'the actor filter returns only that person''s actions'
);

-- 9 · Sayfalama: ilk sayfanın son kaydından eski olan gelir
select ok(
  (select id from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210', 1,
     (select id from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210', 1))))
  < (select id from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210', 1)),
  'the next page starts strictly before the last seen record'
);

-- 10 · Yarından itibaren → boş
select is(
  (select count(*) from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210',
     p_from => public.orbit_today() + 1)),
  0::bigint,
  'the date filter follows the Istanbul day'
);

-- 11 · Öğretmen
select set_config('request.jwt.claim.sub', 'b0130000-0000-0000-0000-0000000b0130', true);
select is(
  (select count(*) from public.organization_audit_feed('b0210000-0000-0000-0000-0000000b0210')),
  0::bigint,
  'a teacher sees no audit log'
);

-- 12 · Bilinmeyen işlem türü
select throws_ok(
  'select * from public.organization_audit_feed(''b0210000-0000-0000-0000-0000000b0210'', p_action_kind => ''deleted'')',
  '22023',
  null,
  'an unknown action kind is rejected'
);

select * from finish();
rollback;
