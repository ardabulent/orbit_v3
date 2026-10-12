-- Öğretmen ve sınıf aynı anda iki derste olamaz (2026-10-12, göç
-- 20261030000000).
--
--   1   Aynı sınıfa saati kesişen ders yazılamaz (ORB07) ve sebep söylenir.
--   2   Aynı öğretmene, başka sınıfta, saati kesişen ders yazılamaz ve
--       öğretmenin adı söylenir.
--   3   Biri bitince başlayan ders yazılır.
--   4   Öğretmensiz ders öğretmen kuralına girmez; başka sınıfta engel yok.
--   5   Arşivlenmiş ders engel değildir.
--   6   Bir dersi kendi saatinde güncellemek kendisiyle çakışmaz.
--   7   Var olan dersi kesişen saate TAŞIMAK da engellenir.

begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
  raw_user_meta_data
)
values ('b1100000-0000-0000-0000-0000000b1100', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ck-ogretmen@example.test', '', now(), now(),
        '{"display_name": "Ayşe Yılmaz"}');
update public.profiles set display_name = 'Ayşe Yılmaz'
 where id = 'b1100000-0000-0000-0000-0000000b1100';

insert into public.organizations (id, name, slug, code)
values ('b2100000-0000-0000-0000-0000000b2100', 'Çakışma Dershanesi', 'cakisma-dershanesi', 8934);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values ('b3100000-0000-0000-0000-0000000b3100', 'b2100000-0000-0000-0000-0000000b2100',
        'b1100000-0000-0000-0000-0000000b1100', 'teacher', 'active');

insert into public.classes (id, organization_id, name)
values ('b4100000-0000-0000-0000-0000000b4100', 'b2100000-0000-0000-0000-0000000b2100', '11-A'),
       ('b4200000-0000-0000-0000-0000000b4200', 'b2100000-0000-0000-0000-0000000b2100', '12-B');

insert into public.schedule_entries (id, organization_id, class_id, title, day_of_week, starts_at, ends_at, membership_id)
values ('b5100000-0000-0000-0000-0000000b5100', 'b2100000-0000-0000-0000-0000000b2100',
        'b4100000-0000-0000-0000-0000000b4100', 'Fizik', 1, '09:00', '09:40',
        'b3100000-0000-0000-0000-0000000b3100');

-- 1
select throws_like(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at)
    values ('b2100000-0000-0000-0000-0000000b2100', 'b4100000-0000-0000-0000-0000000b4100',
            'Kimya', 1, '09:20', '10:00')$$,
  '11-A bu saatte başka bir derste: Pazartesi günü 09:00–09:40 arası Fizik.',
  'a class cannot have two overlapping lessons, and the reason is named');

-- 2
select throws_like(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at, membership_id)
    values ('b2100000-0000-0000-0000-0000000b2100', 'b4200000-0000-0000-0000-0000000b4200',
            'Fizik', 1, '09:30', '10:10', 'b3100000-0000-0000-0000-0000000b3100')$$,
  'Ayşe Yılmaz bu saatte başka bir derste: Pazartesi günü 09:00–09:40 arası 11-A · Fizik.',
  'a teacher cannot teach two overlapping lessons, and the teacher is named');

-- 3
select lives_ok(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at, membership_id)
    values ('b2100000-0000-0000-0000-0000000b2100', 'b4200000-0000-0000-0000-0000000b4200',
            'Fizik', 1, '09:40', '10:20', 'b3100000-0000-0000-0000-0000000b3100')$$,
  'a lesson starting when the previous one ends is allowed');

-- 4
select lives_ok(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at)
    values ('b2100000-0000-0000-0000-0000000b2100', 'b4200000-0000-0000-0000-0000000b4200',
            'Etüt', 1, '08:30', '09:20')$$,
  'a lesson without a teacher in another class is not blocked');

-- 5
insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at, archived_at)
values ('b2100000-0000-0000-0000-0000000b2100', 'b4100000-0000-0000-0000-0000000b4100',
        'Eski', 2, '09:00', '09:40', now());
select lives_ok(
  $$insert into public.schedule_entries (organization_id, class_id, title, day_of_week, starts_at, ends_at)
    values ('b2100000-0000-0000-0000-0000000b2100', 'b4100000-0000-0000-0000-0000000b4100',
            'Yeni', 2, '09:10', '09:50')$$,
  'an archived lesson does not block');

-- 6
select lives_ok(
  $$update public.schedule_entries set ends_at = '09:35'
     where id = 'b5100000-0000-0000-0000-0000000b5100'$$,
  'updating a lesson in place does not conflict with itself');

-- 7
select throws_ok(
  $$update public.schedule_entries set starts_at = '10:00', ends_at = '10:40'
     where id = 'b5100000-0000-0000-0000-0000000b5100'$$,
  'ORB07', null,
  'moving a lesson onto the teacher''s other lesson is blocked');

select * from finish();
rollback;
