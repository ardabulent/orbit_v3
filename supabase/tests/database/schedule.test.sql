-- v1.2-07 — Ders programının sınırları.
--
-- İki test kararların kanıtı:
--
--   * **Hafta sonu dersi yazılabiliyor.** İstemcideki `WeekDay` tipi yalnızca
--     Pazartesi–Cuma taşıyor; veritabanı o sınırı miras almadı çünkü dershanede
--     hafta sonu kursu gerçek bir şey. Bu test, arayüz bir gün genişletildiğinde
--     şemanın hazır olduğunu sabitliyor.
--   * **Aynı öğretmen aynı saate iki sınıfa yazılamıyor.** Program kurarken en
--     sık yapılan hata bu ve veritabanı düzeyinde yakalanıyor.

begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('f1000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kurum-yoneticisi@example.test', '', now(), now()),
  ('f2000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sinif-ogretmeni@example.test', '', now(), now()),
  ('f3000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vekil-ogretmen@example.test', '', now(), now()),
  ('f4000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ogrenci@example.test', '', now(), now()),
  ('f5000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'veli@example.test', '', now(), now()),
  ('f6000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ilgisiz-ogretmen@example.test', '', now(), now()),
  ('09000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'platform-operatoru@example.test', '', now(), now());

insert into public.platform_operators (user_id, role, status)
values ('09000000-0000-0000-0000-000000000009', 'owner', 'active');

insert into public.organizations (id, name, slug, code)
values
  ('3a000000-0000-0000-0000-00000000003a', 'Kurum A', 'kurum-a-v1207', 7601),
  ('3b000000-0000-0000-0000-00000000003b', 'Kurum B', 'kurum-b-v1207', 7602);

insert into public.branches (id, organization_id, name, is_default)
values
  ('3aa00000-0000-0000-0000-0000000003aa', '3a000000-0000-0000-0000-00000000003a', 'A Merkez', true),
  ('3bb00000-0000-0000-0000-0000000003bb', '3b000000-0000-0000-0000-00000000003b', 'B Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('e1100000-0000-0000-0000-0000000011e1', '3a000000-0000-0000-0000-00000000003a', null,
   'f1000000-0000-0000-0000-0000000000f1', 'admin', 'active', 1000),
  ('e2200000-0000-0000-0000-0000000022e2', '3a000000-0000-0000-0000-00000000003a', '3aa00000-0000-0000-0000-0000000003aa',
   'f2000000-0000-0000-0000-0000000000f2', 'teacher', 'active', 1001),
  ('e3300000-0000-0000-0000-0000000033e3', '3a000000-0000-0000-0000-00000000003a', '3aa00000-0000-0000-0000-0000000003aa',
   'f3000000-0000-0000-0000-0000000000f3', 'teacher', 'active', 1002),
  ('e4400000-0000-0000-0000-0000000044e4', '3a000000-0000-0000-0000-00000000003a', '3aa00000-0000-0000-0000-0000000003aa',
   'f4000000-0000-0000-0000-0000000000f4', 'student', 'active', 1003),
  ('e5500000-0000-0000-0000-0000000055e5', '3a000000-0000-0000-0000-00000000003a', '3aa00000-0000-0000-0000-0000000003aa',
   'f5000000-0000-0000-0000-0000000000f5', 'parent', 'active', 1004),
  ('e6600000-0000-0000-0000-0000000066e6', '3a000000-0000-0000-0000-00000000003a', '3aa00000-0000-0000-0000-0000000003aa',
   'f6000000-0000-0000-0000-0000000000f6', 'teacher', 'active', 1005);

insert into public.subjects (id, organization_id, name)
values
  ('7a000000-0000-0000-0000-00000000007a', '3a000000-0000-0000-0000-00000000003a', 'Matematik'),
  ('7b000000-0000-0000-0000-00000000007b', '3b000000-0000-0000-0000-00000000003b', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name, program)
values
  ('a1000000-0000-0000-0000-0000000000a1', '3a000000-0000-0000-0000-00000000003a',
   '3aa00000-0000-0000-0000-0000000003aa', 'YKS 12-A', 'YKS'),
  ('a2000000-0000-0000-0000-0000000000a2', '3a000000-0000-0000-0000-00000000003a',
   '3aa00000-0000-0000-0000-0000000003aa', 'YKS 12-B', 'YKS'),
  ('a3000000-0000-0000-0000-0000000000a3', '3b000000-0000-0000-0000-00000000003b',
   '3bb00000-0000-0000-0000-0000000003bb', 'LGS 8-A', 'LGS');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
        'e2200000-0000-0000-0000-0000000022e2', '7a000000-0000-0000-0000-00000000007a');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name)
values ('a0000000-0000-0000-0000-0000000000b1', '3a000000-0000-0000-0000-00000000003a',
        '3aa00000-0000-0000-0000-0000000003aa', 'f4000000-0000-0000-0000-0000000000f4', 'Birinci Öğrenci');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('a0000000-0000-0000-0000-0000000000c1', '3a000000-0000-0000-0000-00000000003a',
        'f5000000-0000-0000-0000-0000000000f5', 'Birinci Veli');

insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('3a000000-0000-0000-0000-00000000003a', 'a0000000-0000-0000-0000-0000000000b1',
        'a0000000-0000-0000-0000-0000000000c1');

insert into public.class_enrollments (organization_id, class_id, student_id)
values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
        'a0000000-0000-0000-0000-0000000000b1');

insert into public.schedule_entries
  (id, organization_id, class_id, subject_id, membership_id, day_of_week, starts_at, ends_at, room)
values
  ('b0000000-0000-0000-0000-0000000000d1', '3a000000-0000-0000-0000-00000000003a',
   'a1000000-0000-0000-0000-0000000000a1', '7a000000-0000-0000-0000-00000000007a',
   'e2200000-0000-0000-0000-0000000022e2', 1, time '09:00', time '10:00', 'A-101'),
  -- Vekil öğretmene yazılmış saat: `class_teachers`'ta ataması YOK.
  ('b0000000-0000-0000-0000-0000000000d2', '3a000000-0000-0000-0000-00000000003a',
   'a2000000-0000-0000-0000-0000000000a2', '7a000000-0000-0000-0000-00000000007a',
   'e3300000-0000-0000-0000-0000000033e3', 2, time '11:00', time '12:00', 'A-102');

-- Veri düzeyi -------------------------------------------------------------------

select throws_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            'Geçersiz Gün', 8, time '09:00')$sql$,
  '23514',
  null,
  'a day outside 1..7 is refused'
);

-- Rol korkuluğu (v1.2-15, K-18) ------------------------------------------------
--
-- Bu, üç rol korkuluğunun en dar etkilisi: `schedule_entries.membership_id`
-- `current_user_teaches_class`'ı BESLEMİYOR, dolayısıyla ders verme kapsamı
-- açmıyor. Açtığı tek şey `schedule_entries_select_teacher`'ın ikinci dalı —
-- satır kime yazılmışsa o kişi satırı okuyabiliyor (vekil öğretmen yolu) ve
-- o dal role bakmıyordu.
--
-- Yine de korunuyor: "Pazartesi 09:00 Matematik'i veli X veriyor" satırı,
-- kimse onu okuyamasa bile yanlış bir kayıttır.
select throws_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, membership_id, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            'Veli Dersi', 'e5500000-0000-0000-0000-0000000055e5', 3, time '15:00')$sql$,
  'ORB03',
  null,
  'a parent membership cannot be written as the person giving a lesson'
);

select lives_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, membership_id, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            'Vekil Ders', 'e6600000-0000-0000-0000-0000000066e6', 3, time '16:00')$sql$,
  'a teacher who is not assigned to the class can still stand in on the timetable'
);

-- Yukarıdaki satır fixture'a gerçek bir kayıt ekledi ve dosyanın geri kalanı
-- **iki** program satırı sayıyor (silme koruması dahil). Geri alınıyor — bir
-- iddia değil, düzen toplama.
delete from public.schedule_entries where title = 'Vekil Ders';

-- Hafta sonu: istemcinin bilmediği ama kurumun kullandığı gün.
select lives_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, day_of_week, starts_at, ends_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            'Hafta Sonu Kursu', 6, time '10:00', time '12:00')$sql$,
  'a Saturday lesson is storable — the schema does not inherit the five-day UI limit'
);

select throws_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, day_of_week, starts_at, ends_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            'Ters Saat', 3, time '11:00', time '10:00')$sql$,
  '23514',
  null,
  'a lesson cannot end before it starts'
);

select throws_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            4, time '09:00')$sql$,
  '23514',
  null,
  'an entry with neither a subject nor a title would render as an empty box'
);

select throws_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a3000000-0000-0000-0000-0000000000a3',
            'Sızdırılan Saat', 1, time '13:00')$sql$,
  '23503',
  null,
  'a schedule entry cannot point at another organization class'
);

select throws_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            'Çakışan Saat', 1, time '09:00')$sql$,
  -- 2026-10-12: aynı başlangıcı indeks de yakalar (23505), ama süre
  -- kesişmesi tetikleyicisi önce çalışıp sebebi söyler (göç 20261030000000).
  'ORB07',
  null,
  'a class cannot be in two places at the same time'
);

-- Program kurarken en sık yapılan hata.
select throws_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, membership_id, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a2000000-0000-0000-0000-0000000000a2',
            'Aynı Anda İkinci Sınıf', 'e2200000-0000-0000-0000-0000000022e2', 1, time '09:00')$sql$,
  -- 2026-10-12: aynı başlangıcı indeks de yakalar (23505), ama süre
  -- kesişmesi tetikleyicisi önce çalışıp sebebi söyler (göç 20261030000000).
  'ORB07',
  null,
  'a teacher cannot be booked into two classes at the same hour'
);

create function pg_temp.silmeyi_dene(org uuid, actor uuid)
returns text
language plpgsql
as $fn$
declare
  gerekce text;
begin
  perform public.internal_delete_organization(org, actor);
  return null;
exception when sqlstate 'ORB01' then
  get stacked diagnostics gerekce = pg_exception_detail;
  return gerekce;
end;
$fn$;

select ok(
  pg_temp.silmeyi_dene(
    '3a000000-0000-0000-0000-00000000003a',
    '09000000-0000-0000-0000-000000000009'
  )::jsonb @> '[{"table": "schedule_entries", "rows": 3}]'::jsonb,
  'the deletion guard counts schedule entries without being told about them'
);

-- Kurum yöneticisi -----------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-0000000000f1', true);

select is(
  (select count(*) from public.schedule_entries),
  3::bigint,
  'an admin sees the whole timetable of their organization'
);

select lives_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            'Etüt', 5, time '15:00')$sql$,
  'an admin can add a block that is not a subject — an unsupervised study hour'
);

select throws_ok(
  $sql$update public.schedule_entries
      set class_id = 'a2000000-0000-0000-0000-0000000000a2'
      where id = 'b0000000-0000-0000-0000-0000000000d1'$sql$,
  '42501',
  null,
  'a schedule entry cannot be moved to another class'
);

select throws_ok(
  $sql$delete from public.schedule_entries$sql$,
  '42501',
  null,
  'nobody deletes a schedule entry through the API'
);

-- Sınıf öğretmeni ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'f2000000-0000-0000-0000-0000000000f2', true);

select is(
  (select count(*) from public.schedule_entries),
  3::bigint,
  'a teacher sees every hour of the class they teach'
);

select is(
  (select count(*) from public.schedule_entries
     where class_id = 'a2000000-0000-0000-0000-0000000000a2'),
  0::bigint,
  'a teacher does not see the timetable of a class they do not teach'
);

select throws_ok(
  $sql$insert into public.schedule_entries
      (organization_id, class_id, title, day_of_week, starts_at)
    values ('3a000000-0000-0000-0000-00000000003a', 'a1000000-0000-0000-0000-0000000000a1',
            'Öğretmenin Eklediği Saat', 3, time '14:00')$sql$,
  '42501',
  null,
  'a teacher cannot edit the timetable — planning belongs to the institution'
);

-- Vekil öğretmen: sınıfı okutmuyor ama saat ona yazılmış -------------------------------

select set_config('request.jwt.claim.sub', 'f3000000-0000-0000-0000-0000000000f3', true);

select is(
  (select count(*) from public.schedule_entries),
  1::bigint,
  'a substitute sees the hour written to them even without a class assignment'
);

select is(
  (select id from public.schedule_entries),
  'b0000000-0000-0000-0000-0000000000d2'::uuid,
  'and it is exactly that hour, not the rest of the timetable'
);

-- İlgisiz öğretmen -----------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'f6000000-0000-0000-0000-0000000000f6', true);

select is(
  (select count(*) from public.schedule_entries),
  0::bigint,
  'a teacher with no class and no hour sees nothing'
);

-- Öğrenci ve veli -------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-0000000000f4', true);

select is(
  (select count(*) from public.schedule_entries),
  3::bigint,
  'a student sees the timetable of the class they attend'
);

select set_config('request.jwt.claim.sub', 'f5000000-0000-0000-0000-0000000000f5', true);

select is(
  (select count(*) from public.schedule_entries),
  3::bigint,
  'a guardian sees the timetable of their child class'
);

select is(
  (select count(*) from public.schedule_entries
     where class_id = 'a2000000-0000-0000-0000-0000000000a2'),
  0::bigint,
  'and not the timetable of any other class'
);

-- Kilit ve anon ---------------------------------------------------------------------------------

reset role;
update public.profiles set must_change_password = true
where id = 'f1000000-0000-0000-0000-0000000000f1';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-0000000000f1', true);

select is(
  (select count(*) from public.schedule_entries),
  0::bigint,
  'an admin who must change their password reads no timetable'
);

reset role;
set local role anon;

select throws_ok(
  $sql$select * from public.schedule_entries$sql$,
  '42501',
  null,
  'anon cannot read the timetable'
);

select * from finish();
rollback;
