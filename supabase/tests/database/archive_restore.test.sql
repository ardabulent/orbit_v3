-- Ayarlar → Arşiv (2026-10-12, B20): arşivlenen kayıt listelenir ve geri
-- alınır. Ekran yeni yetki açmıyor; bu dosya dayandığı kuralları kilitler.
--
--   1    ⛔ Öğretmen arşivdeki öğrenciyi geri alamaz (0 satır).
--   2–4  Yönetici arşivdeki öğrenciyi, veliyi ve sınavı geri alır.
--   5    Arşivdeki sınıf arşivde görünmeye devam eder.
--   6    Arşivdeyken aynı adla yeni sınıf açıldıysa geri alma 23505 ile durur
--        (ekran bunu Türkçe söyler).
--   7    Öğrenci geri alınınca arşivle kapanan sınıf kaydı yeniden açılır.

begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('d1100000-0000-0000-0000-0000000d1100', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ar-yonetici@example.test', '', now(), now()),
  ('d1200000-0000-0000-0000-0000000d1200', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ar-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('d2100000-0000-0000-0000-0000000d2100', 'Arşiv Dershanesi', 'arsiv-dershanesi', 8932);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('d3100000-0000-0000-0000-0000000d3100', 'd2100000-0000-0000-0000-0000000d2100',
   'd1100000-0000-0000-0000-0000000d1100', 'admin', 'active'),
  ('d3200000-0000-0000-0000-0000000d3200', 'd2100000-0000-0000-0000-0000000d2100',
   'd1200000-0000-0000-0000-0000000d1200', 'teacher', 'active');

insert into public.classes (id, organization_id, name)
values ('d4100000-0000-0000-0000-0000000d4100', 'd2100000-0000-0000-0000-0000000d2100', 'A-1'),
       ('d4200000-0000-0000-0000-0000000d4200', 'd2100000-0000-0000-0000-0000000d2100', 'Eski');
insert into public.students (id, organization_id, full_name)
values ('d5100000-0000-0000-0000-0000000d5100', 'd2100000-0000-0000-0000-0000000d2100', 'Arşivli Öğrenci');
insert into public.class_enrollments (organization_id, class_id, student_id)
values ('d2100000-0000-0000-0000-0000000d2100', 'd4100000-0000-0000-0000-0000000d4100',
        'd5100000-0000-0000-0000-0000000d5100');
insert into public.guardians (id, organization_id, full_name)
values ('d6100000-0000-0000-0000-0000000d6100', 'd2100000-0000-0000-0000-0000000d2100', 'Arşivli Veli');
insert into public.exams (id, organization_id, name, exam_date, class_id)
values ('d7100000-0000-0000-0000-0000000d7100', 'd2100000-0000-0000-0000-0000000d2100',
        'Deneme 1', date '2026-10-01', 'd4100000-0000-0000-0000-0000000d4100');

-- Arşivle (öğrenci arşivi sınıf kaydını kapatır).
update public.students set archived_at = now() - interval '1 minute'
 where id = 'd5100000-0000-0000-0000-0000000d5100';
update public.guardians set archived_at = now() where id = 'd6100000-0000-0000-0000-0000000d6100';
update public.exams set archived_at = now() where id = 'd7100000-0000-0000-0000-0000000d7100';
update public.classes set archived_at = now() where id = 'd4200000-0000-0000-0000-0000000d4200';
-- Arşivdeyken aynı adla yeni sınıf açıldı.
insert into public.classes (organization_id, name)
values ('d2100000-0000-0000-0000-0000000d2100', 'Eski');

-- Kişinin gözüyle: tablodaki kaydı görüp geri alabildiği satır sayısı.
create function pg_temp.geri_al(kisi uuid, tablo text, kayit uuid) returns bigint
language plpgsql as $$
declare adet bigint;
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  execute format(
    'with x as (update public.%I set archived_at = null where id = %L and archived_at is not null returning 1) select count(*) from x',
    tablo, kayit) into adet;
  execute 'reset role';
  return adet;
end $$;

-- 1 (yöneticiden önce: başarılı geri almadan sonra satır zaten açık olurdu)
select is(pg_temp.geri_al('d1200000-0000-0000-0000-0000000d1200', 'students',
                          'd5100000-0000-0000-0000-0000000d5100'),
  0::bigint, 'a teacher cannot restore an archived student');

-- 2–5
select is(pg_temp.geri_al('d1100000-0000-0000-0000-0000000d1100', 'students',
                          'd5100000-0000-0000-0000-0000000d5100'),
  1::bigint, 'the admin restores an archived student');
select is(pg_temp.geri_al('d1100000-0000-0000-0000-0000000d1100', 'guardians',
                          'd6100000-0000-0000-0000-0000000d6100'),
  1::bigint, 'the admin restores an archived guardian');
select is(pg_temp.geri_al('d1100000-0000-0000-0000-0000000d1100', 'exams',
                          'd7100000-0000-0000-0000-0000000d7100'),
  1::bigint, 'the admin restores an archived exam');
select is(
  (select count(*) from public.classes
    where organization_id = 'd2100000-0000-0000-0000-0000000d2100'
      and archived_at is not null),
  1::bigint, 'the archived class is still listed as archived');

-- 6
select throws_ok(
  $$select pg_temp.geri_al('d1100000-0000-0000-0000-0000000d1100', 'classes',
                           'd4200000-0000-0000-0000-0000000d4200')$$,
  '23505', null,
  'restoring a class stops when an active class took its name');

-- 7
select is(
  (select count(*) from public.class_enrollments
    where student_id = 'd5100000-0000-0000-0000-0000000d5100' and archived_at is null),
  1::bigint, 'restoring the student reopens the enrollment the archive closed');

select * from finish();
rollback;
