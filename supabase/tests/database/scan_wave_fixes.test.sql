-- Tarama turunun veri ve yetki düzeltmeleri (2026-10-11, göç 20261026000000).
--
--   1–4  "Yalnız öğretmenler" duyurusu: öğretmen ve yönetici görür,
--        ⛔ öğrenci ve ⛔ veli görmez.
--   5    Ödevin verildiği gün kurum gününe göre (orbit_today).
--   6–8  Öğrenci arşivlenince sınıf kaydı kapanır, geri alınınca açılır;
--        arada aynı sınıfa yeniden kaydedildiyse eski kayıt açılmaz.
--   9    Hesap değiştirme 120, rol değiştirme ve üye çıkarma 60 / saat.
--   10   Üç yabancı anahtarın indeksi var.
--   11   Altı yeni tabloda canlı güncelleme tetikleyicisi var.

begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('f1100000-0000-0000-0000-0000000f1100', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'td-yonetici@example.test', '', now(), now()),
  ('f1200000-0000-0000-0000-0000000f1200', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'td-ogretmen@example.test', '', now(), now()),
  ('f1300000-0000-0000-0000-0000000f1300', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'td-ogrenci@example.test', '', now(), now()),
  ('f1400000-0000-0000-0000-0000000f1400', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'td-veli@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('f2100000-0000-0000-0000-0000000f2100', 'Tarama Dershanesi', 'tarama-dershanesi', 8930);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('f3100000-0000-0000-0000-0000000f3100', 'f2100000-0000-0000-0000-0000000f2100', 'f1100000-0000-0000-0000-0000000f1100', 'admin', 'active'),
  ('f3200000-0000-0000-0000-0000000f3200', 'f2100000-0000-0000-0000-0000000f2100', 'f1200000-0000-0000-0000-0000000f1200', 'teacher', 'active'),
  ('f3300000-0000-0000-0000-0000000f3300', 'f2100000-0000-0000-0000-0000000f2100', 'f1300000-0000-0000-0000-0000000f1300', 'student', 'active'),
  ('f3400000-0000-0000-0000-0000000f3400', 'f2100000-0000-0000-0000-0000000f2100', 'f1400000-0000-0000-0000-0000000f1400', 'parent', 'active');

insert into public.daily_feed_posts (id, organization_id, title, body, author_membership_id, audience)
values ('f4100000-0000-0000-0000-0000000f4100', 'f2100000-0000-0000-0000-0000000f2100',
        'Öğretmenler toplantısı', 'Cuma 16:00', 'f3100000-0000-0000-0000-0000000f3100', 'staff');

create function pg_temp.gorur(kisi uuid) returns boolean language plpgsql as $$
declare sonuc boolean;
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select exists (select 1 from public.daily_feed_posts
                  where id = 'f4100000-0000-0000-0000-0000000f4100') into sonuc;
  execute 'reset role';
  return sonuc;
end $$;

-- 1–4
select ok(pg_temp.gorur('f1100000-0000-0000-0000-0000000f1100'), 'the admin sees a staff-only post');
select ok(pg_temp.gorur('f1200000-0000-0000-0000-0000000f1200'), 'a teacher sees a staff-only post');
select ok(not pg_temp.gorur('f1300000-0000-0000-0000-0000000f1300'), 'a student does not see a staff-only post');
select ok(not pg_temp.gorur('f1400000-0000-0000-0000-0000000f1400'), 'a guardian does not see a staff-only post');

-- 5
select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'homework_assignments'
      and column_name = 'assigned_on'),
  'orbit_today()',
  'the homework assignment day defaults to the institution day, not UTC'
);

-- 6–8
insert into public.classes (id, organization_id, name)
values ('f5100000-0000-0000-0000-0000000f5100', 'f2100000-0000-0000-0000-0000000f2100', 'T-1');
insert into public.students (id, organization_id, full_name)
values ('f6100000-0000-0000-0000-0000000f6100', 'f2100000-0000-0000-0000-0000000f2100', 'Arşiv Deneme'),
       ('f6200000-0000-0000-0000-0000000f6200', 'f2100000-0000-0000-0000-0000000f2100', 'Yeniden Kayıt');
insert into public.class_enrollments (organization_id, class_id, student_id)
values ('f2100000-0000-0000-0000-0000000f2100', 'f5100000-0000-0000-0000-0000000f5100', 'f6100000-0000-0000-0000-0000000f6100'),
       ('f2100000-0000-0000-0000-0000000f2100', 'f5100000-0000-0000-0000-0000000f5100', 'f6200000-0000-0000-0000-0000000f6200');

update public.students set archived_at = now() - interval '1 minute'
 where id in ('f6100000-0000-0000-0000-0000000f6100', 'f6200000-0000-0000-0000-0000000f6200');
select is(
  (select count(*) from public.class_enrollments
    where student_id in ('f6100000-0000-0000-0000-0000000f6100', 'f6200000-0000-0000-0000-0000000f6200')
      and archived_at is null),
  0::bigint,
  'archiving a student closes their class enrollments'
);

-- İkinci öğrenci arşivdeyken aynı sınıfa yeniden kaydedildi.
insert into public.class_enrollments (organization_id, class_id, student_id)
values ('f2100000-0000-0000-0000-0000000f2100', 'f5100000-0000-0000-0000-0000000f5100', 'f6200000-0000-0000-0000-0000000f6200');

update public.students set archived_at = null
 where id in ('f6100000-0000-0000-0000-0000000f6100', 'f6200000-0000-0000-0000-0000000f6200');
select is(
  (select count(*) from public.class_enrollments
    where student_id = 'f6100000-0000-0000-0000-0000000f6100' and archived_at is null),
  1::bigint,
  'restoring the student reopens the enrollment closed with them'
);
select is(
  (select count(*) from public.class_enrollments
    where student_id = 'f6200000-0000-0000-0000-0000000f6200' and archived_at is null),
  1::bigint,
  'a student re-enrolled in the meantime keeps exactly one open enrollment'
);

-- 9
select ok(
  pg_get_functiondef('public.internal_begin_function_call'::regproc)
    ~ 'switch-account''\s+then 120'
  and pg_get_functiondef('public.internal_begin_function_call'::regproc)
    ~ 'change-member-role''\s+then 60'
  and pg_get_functiondef('public.internal_begin_function_call'::regproc)
    ~ 'remove-member''\s+then 60',
  'account switch, role change and member removal have their own hourly limits'
);

-- 10
select is(
  (select count(*) from pg_constraint as c
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index as i
                       where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])),
  0::bigint,
  'every single-column foreign key in public is indexed'
);

-- 11
select is(
  (select count(*) from pg_trigger
    where not tgisinternal and tgname like '%broadcast%'
      and tgrelid::regclass::text in (
        'exam_absences', 'exam_sections', 'exam_section_results',
        'substitute_assignments', 'schedule_templates', 'schedule_template_slots')),
  18::bigint,
  'the six newer tables broadcast insert, update and delete'
);

select * from finish();
rollback;
