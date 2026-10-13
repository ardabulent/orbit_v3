-- Uygulama içi mesajlaşma ve bildirimler (2026-10-12, göç 20261031000000).
--
--   1–3   Kim kime: veli kendi çocuğunun öğretmenine yazar; ⛔ okutmadığı
--         sınıfın velisine öğretmen yazamaz; ⛔ veli başka veliye yazamaz.
--   4     Öğrenci yöneticiye yazabilir.
--   5–6   Mesaj gider; alıcıya "size yazdı" bildirimi düşer.
--   7     ⛔ Yönetici başkalarının yazışmasını OKUYAMAZ.
--   8     ⛔ Tablolara doğrudan yazılamaz (yalnız fonksiyonlar).
--   9     Okununca konuşmanın okunmamış işareti ve mesaj bildirimi kalkar.
--   10    Ödev verilince sınıfın öğrencisine ve velisine bildirim düşer;
--         ⛔ başka sınıfın velisine düşmez.
--   11    Devamsızlık yalnız veliye bildirilir, öğrenciye değil.
--   12    "Yalnız öğretmenler" duyurusu veliye bildirim üretmez.
--   13    Herkes yalnız kendi bildirimini görür.

begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
select ('a' || n || '000000-0000-0000-0000-00000000a' || n || '00')::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'msj-' || n || '@example.test', '', now(), now()
from generate_series(1, 7) as n;
-- 1 yönetici · 2 öğretmen (11-A) · 3 başka öğretmen · 4 öğrenci (11-A)
-- 5 veli (öğrenci 4'ün) · 6 başka veli (12-B) · 7 başka öğrenci (12-B)
update public.profiles set display_name = 'Kişi ' || right(id::text, 3);
update public.profiles set display_name = 'Ayşe Öğretmen' where id = 'a2000000-0000-0000-0000-00000000a200';

insert into public.organizations (id, name, slug, code)
values ('a9000000-0000-0000-0000-00000000a900', 'Mesaj Dershanesi', 'mesaj-dershanesi', 8935);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
select ('a' || n || '100000-0000-0000-0000-00000000a' || n || '10')::uuid,
       'a9000000-0000-0000-0000-00000000a900',
       ('a' || n || '000000-0000-0000-0000-00000000a' || n || '00')::uuid,
       (array['admin','teacher','teacher','student','parent','parent','student'])[n]::public.app_role,
       'active'
from generate_series(1, 7) as n;

insert into public.subjects (id, organization_id, name)
values ('a9100000-0000-0000-0000-00000000a910', 'a9000000-0000-0000-0000-00000000a900', 'Fizik');
insert into public.classes (id, organization_id, name)
values ('a9200000-0000-0000-0000-00000000a920', 'a9000000-0000-0000-0000-00000000a900', '11-A'),
       ('a9300000-0000-0000-0000-00000000a930', 'a9000000-0000-0000-0000-00000000a900', '12-B');
insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values ('a9000000-0000-0000-0000-00000000a900', 'a9200000-0000-0000-0000-00000000a920',
        'a2100000-0000-0000-0000-00000000a210', 'a9100000-0000-0000-0000-00000000a910');

insert into public.students (id, organization_id, full_name, auth_user_id)
values ('a9400000-0000-0000-0000-00000000a940', 'a9000000-0000-0000-0000-00000000a900', 'Can Öğrenci',
        'a4000000-0000-0000-0000-00000000a400'),
       ('a9500000-0000-0000-0000-00000000a950', 'a9000000-0000-0000-0000-00000000a900', 'Ece Öğrenci',
        'a7000000-0000-0000-0000-00000000a700');
insert into public.class_enrollments (organization_id, class_id, student_id)
values ('a9000000-0000-0000-0000-00000000a900', 'a9200000-0000-0000-0000-00000000a920', 'a9400000-0000-0000-0000-00000000a940'),
       ('a9000000-0000-0000-0000-00000000a900', 'a9300000-0000-0000-0000-00000000a930', 'a9500000-0000-0000-0000-00000000a950');
insert into public.guardians (id, organization_id, full_name, auth_user_id)
values ('a9600000-0000-0000-0000-00000000a960', 'a9000000-0000-0000-0000-00000000a900', 'Canın Velisi',
        'a5000000-0000-0000-0000-00000000a500'),
       ('a9700000-0000-0000-0000-00000000a970', 'a9000000-0000-0000-0000-00000000a900', 'Ece''nin Velisi',
        'a6000000-0000-0000-0000-00000000a600');
insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('a9000000-0000-0000-0000-00000000a900', 'a9400000-0000-0000-0000-00000000a940', 'a9600000-0000-0000-0000-00000000a960'),
       ('a9000000-0000-0000-0000-00000000a900', 'a9500000-0000-0000-0000-00000000a950', 'a9700000-0000-0000-0000-00000000a970');

create function pg_temp.olarak(kisi uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', kisi::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

-- Veli (5) öğretmene (2) yazar.
select pg_temp.olarak('a5000000-0000-0000-0000-00000000a500');
create temp table k on commit drop as
  select public.start_conversation('a2100000-0000-0000-0000-00000000a210') as id;

-- 1
select ok((select id from k) is not null, 'a guardian can start a conversation with their child''s teacher');

-- 5
select lives_ok(
  $$select public.send_message((select id from k), 'Merhaba hocam, Can''ın ödevi hakkında soracaktım.')$$,
  'the guardian sends a message');
reset role;

-- 2
select pg_temp.olarak('a2000000-0000-0000-0000-00000000a200');
select throws_ok(
  $$select public.start_conversation('a6100000-0000-0000-0000-00000000a610')$$,
  '42501', null, 'a teacher cannot message the guardian of a class they do not teach');
reset role;

-- 3
select pg_temp.olarak('a5000000-0000-0000-0000-00000000a500');
select throws_ok(
  $$select public.start_conversation('a6100000-0000-0000-0000-00000000a610')$$,
  '42501', null, 'a guardian cannot message another guardian');
reset role;

-- 4
select pg_temp.olarak('a7000000-0000-0000-0000-00000000a700');
select lives_ok(
  $$select public.start_conversation('a1100000-0000-0000-0000-00000000a110')$$,
  'a student can message the administration');
reset role;

-- 6
select is(
  (select title from public.notifications
    where user_id = 'a2000000-0000-0000-0000-00000000a200' and kind = 'message'),
  'Kişi 500 size yazdı', 'the teacher gets a message notification');

-- 6b
select pg_temp.olarak('a5000000-0000-0000-0000-00000000a500');
select public.send_message((select id from k), 'İkinci mesaj.');
reset role;
select is(
  (select array_agg(body) from public.notifications
    where user_id = 'a2000000-0000-0000-0000-00000000a200' and kind = 'message' and read_at is null),
  array['İkinci mesaj.'],
  'a second message refreshes the single unread message notification');

-- 7
select pg_temp.olarak('a1000000-0000-0000-0000-00000000a100');
select is((select count(*) from public.messages), 0::bigint,
  'the administration cannot read other people''s conversations');
reset role;

-- 8
select ok(
  not has_table_privilege('authenticated', 'public.messages', 'INSERT')
  and not has_table_privilege('authenticated', 'public.conversations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.notifications', 'UPDATE'),
  'the tables cannot be written directly');

-- 9
select pg_temp.olarak('a2000000-0000-0000-0000-00000000a200');
select public.mark_conversation_read((select id from k));
select ok(
  (select not unread from public.list_conversations() where conversation_id = (select id from k))
  and not exists (select 1 from public.notifications where kind = 'message' and read_at is null),
  'reading a conversation clears its unread mark and its message notification');
reset role;

-- 10
insert into public.homework_assignments (organization_id, class_id, title, due_date)
values ('a9000000-0000-0000-0000-00000000a900', 'a9200000-0000-0000-0000-00000000a920',
        'Kuvvet soruları', public.orbit_today() + 3);
select is(
  (select array_agg(user_id order by user_id) from public.notifications where kind = 'homework'),
  array['a4000000-0000-0000-0000-00000000a400', 'a5000000-0000-0000-0000-00000000a500']::uuid[],
  'homework notifies the class''s student and guardian only');

-- 11
insert into public.attendance_sessions (id, organization_id, class_id, session_date)
values ('a9800000-0000-0000-0000-00000000a980', 'a9000000-0000-0000-0000-00000000a900',
        'a9200000-0000-0000-0000-00000000a920', public.orbit_today());
insert into public.attendance_records (organization_id, session_id, student_id, status)
values ('a9000000-0000-0000-0000-00000000a900', 'a9800000-0000-0000-0000-00000000a980',
        'a9400000-0000-0000-0000-00000000a940', 'absent');
select is(
  (select array_agg(user_id) from public.notifications where kind = 'attendance'),
  array['a5000000-0000-0000-0000-00000000a500']::uuid[],
  'an absence is told to the guardian, not the student');

-- 12
insert into public.daily_feed_posts (organization_id, title, body, author_membership_id, audience)
values ('a9000000-0000-0000-0000-00000000a900', 'Öğretmenler toplantısı', 'Cuma',
        'a1100000-0000-0000-0000-00000000a110', 'staff');
select is(
  (select array_agg(user_id order by user_id) from public.notifications where kind = 'announcement'),
  array['a2000000-0000-0000-0000-00000000a200', 'a3000000-0000-0000-0000-00000000a300']::uuid[],
  'a staff-only announcement notifies teachers only, not its author or families');

-- 13
select pg_temp.olarak('a5000000-0000-0000-0000-00000000a500');
select is(
  (select count(*) from public.notifications where user_id <> 'a5000000-0000-0000-0000-00000000a500'),
  0::bigint, 'everyone sees only their own notifications');
reset role;

select * from finish();
rollback;
