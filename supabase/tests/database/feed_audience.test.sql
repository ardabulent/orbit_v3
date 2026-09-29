-- Duyuru hedef kitlesi ve sabitleme (`20261009000000`).
--
-- Kadro: A yönetici · T 12-A öğretmeni · S 12-A öğrencisi (hesaplı) ·
-- G S'nin velisi (hesaplı).
-- Duyurular: kurum geneli herkese (P_all), yalnız velilere (P_guard), yalnız
-- öğrencilere (P_stud); 12-A'ya yalnız velilere (P_class_guard).
--
-- Sınanan: kısıtlayıcı politika her okuma yolunun üstünde durur (kurum
-- geneli politikası dahil); personel hedef kitleden bağımsız görür;
-- geçersiz hedef reddedilir; hedef ve sabitleme iz bırakır.

begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('b1000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'duyuru-yonetici@example.test', '', now(), now()),
  ('b2000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'duyuru-ogretmen@example.test', '', now(), now()),
  ('b3000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'duyuru-ogrenci@example.test', '', now(), now()),
  ('b4000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'duyuru-veli@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('ba000000-0000-0000-0000-0000000000ba', 'Duyuru Kurumu', 'duyuru-kurumu', 8211);

insert into public.branches (id, organization_id, name, is_default)
values ('bc000000-0000-0000-0000-0000000000bc', 'ba000000-0000-0000-0000-0000000000ba', 'Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('bd000000-0000-0000-0000-0000000db000', 'ba000000-0000-0000-0000-0000000000ba',
   'bc000000-0000-0000-0000-0000000000bc', 'b1000000-0000-0000-0000-0000000000b1', 'admin', 'active', 9301),
  ('bd100000-0000-0000-0000-0000000db001', 'ba000000-0000-0000-0000-0000000000ba',
   'bc000000-0000-0000-0000-0000000000bc', 'b2000000-0000-0000-0000-0000000000b2', 'teacher', 'active', 9302),
  ('bd200000-0000-0000-0000-0000000db002', 'ba000000-0000-0000-0000-0000000000ba',
   'bc000000-0000-0000-0000-0000000000bc', 'b3000000-0000-0000-0000-0000000000b3', 'student', 'active', 9303),
  ('bd300000-0000-0000-0000-0000000db003', 'ba000000-0000-0000-0000-0000000000ba',
   'bc000000-0000-0000-0000-0000000000bc', 'b4000000-0000-0000-0000-0000000000b4', 'parent', 'active', 9304);

insert into public.subjects (id, organization_id, name)
values ('be000000-0000-0000-0000-0000000000be', 'ba000000-0000-0000-0000-0000000000ba', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values ('bf100000-0000-0000-0000-0000000fb001', 'ba000000-0000-0000-0000-0000000000ba',
        'bc000000-0000-0000-0000-0000000000bc', '12-A');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values ('ba000000-0000-0000-0000-0000000000ba', 'bf100000-0000-0000-0000-0000000fb001',
        'bd100000-0000-0000-0000-0000000db001', 'be000000-0000-0000-0000-0000000000be');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name)
values ('b6100000-0000-0000-0000-0000000006b1', 'ba000000-0000-0000-0000-0000000000ba',
        'bc000000-0000-0000-0000-0000000000bc', 'b3000000-0000-0000-0000-0000000000b3', 'S');

insert into public.class_enrollments (organization_id, class_id, student_id)
values ('ba000000-0000-0000-0000-0000000000ba', 'bf100000-0000-0000-0000-0000000fb001',
        'b6100000-0000-0000-0000-0000000006b1');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('b7100000-0000-0000-0000-0000000007b1', 'ba000000-0000-0000-0000-0000000000ba',
        'b4000000-0000-0000-0000-0000000000b4', 'G');

insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('ba000000-0000-0000-0000-0000000000ba', 'b6100000-0000-0000-0000-0000000006b1',
        'b7100000-0000-0000-0000-0000000007b1');

insert into public.daily_feed_posts (id, organization_id, class_id, title, audience, pinned)
values
  ('b8100000-0000-0000-0000-0000000008b1', 'ba000000-0000-0000-0000-0000000000ba', null,
   'Herkese', 'all', false),
  ('b8200000-0000-0000-0000-0000000008b2', 'ba000000-0000-0000-0000-0000000000ba', null,
   'Veli toplantısı', 'guardians', true),
  ('b8300000-0000-0000-0000-0000000008b3', 'ba000000-0000-0000-0000-0000000000ba', null,
   'Kalem getirin', 'students', false),
  ('b8400000-0000-0000-0000-0000000008b4', 'ba000000-0000-0000-0000-0000000000ba',
   'bf100000-0000-0000-0000-0000000fb001', '12-A veli notu', 'guardians', false);

select throws_ok(
  $$ insert into public.daily_feed_posts (organization_id, title, audience)
     values ('ba000000-0000-0000-0000-0000000000ba', 'x', 'teachers') $$,
  '23514', null,
  'an unknown audience is rejected'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000b3', true);

select results_eq(
  $$ select title from public.daily_feed_posts order by title $$,
  $$ values ('Herkese'::text), ('Kalem getirin'::text) $$,
  'the student sees posts for everyone and for students; guardian posts are filtered even when organization-wide or in their class'
);

select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-0000000000b4', true);

select results_eq(
  $$ select title from public.daily_feed_posts order by title $$,
  $$ values ('12-A veli notu'::text), ('Herkese'::text), ('Veli toplantısı'::text) $$,
  'the guardian sees posts for everyone and for guardians (organization-wide and their child''s class)'
);

select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-0000000000b2', true);

select is(
  (select count(*) from public.daily_feed_posts),
  4::bigint,
  'the teacher sees every audience (organization-wide and their class)'
);

select lives_ok(
  $$ insert into public.daily_feed_posts (organization_id, class_id, title, audience, pinned)
     values ('ba000000-0000-0000-0000-0000000000ba', 'bf100000-0000-0000-0000-0000000fb001',
             'Yarın deneme', 'students', true) $$,
  'the class teacher posts a pinned, students-only notice to their class'
);

select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-0000000000b1', true);

select is(
  (select count(*) from public.daily_feed_posts),
  5::bigint,
  'the admin sees every audience'
);

select lives_ok(
  $$ update public.daily_feed_posts set audience = 'all', pinned = false
     where id = 'b8200000-0000-0000-0000-0000000008b2' $$,
  'the admin can widen the audience and unpin'
);

select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000b3', true);

select is(
  (select count(*) from public.daily_feed_posts where id = 'b8200000-0000-0000-0000-0000000008b2'),
  1::bigint,
  'once widened to everyone the student sees it'
);

reset role;

select ok(
  exists (
    select 1 from public.audit_events
    where entity_id = 'b8200000-0000-0000-0000-0000000008b2'
      and action = 'feed_post.updated'
      and metadata::text like '%audience%'
  ),
  'changing the audience leaves a trace'
);

select * from finish();
rollback;
