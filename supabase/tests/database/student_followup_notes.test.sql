-- Takip, 3. dilim (2026-11-24): öğretmen notu ve görüşme kaydı.
--
-- Kurum: A (şubesiz) ve C (Ş2). Bir A'da (öğrenci hesabı ve velisi bağlı),
-- Dört C'de. Öğretmen 1 ve Öğretmen 2 A'yı okutuyor; şube yöneticisi Ş1'in.
--
-- Görür: yönetici ve okutan öğretmen (yazanı fark etmeksizin).
-- Görmez: öğrenci, veli, başka şube, komşu kurum.
-- Düzeltir: yalnız yazan ya da yönetici. Denetim kaydında metin yok.
-- Liste fonksiyonu tablonun kuralıyla aynı satırları verir.

begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('f0110000-0000-0000-0000-0000000f0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nt-yonetici@example.test', '', now(), now()),
  ('f0120000-0000-0000-0000-0000000f0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nt-ogretmen1@example.test', '', now(), now()),
  ('f0170000-0000-0000-0000-0000000f0170', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nt-ogretmen2@example.test', '', now(), now()),
  ('f0130000-0000-0000-0000-0000000f0130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nt-ogrenci@example.test', '', now(), now()),
  ('f0140000-0000-0000-0000-0000000f0140', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nt-veli@example.test', '', now(), now()),
  ('f0150000-0000-0000-0000-0000000f0150', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nt-sube@example.test', '', now(), now()),
  ('f0160000-0000-0000-0000-0000000f0160', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nt-komsu@example.test', '', now(), now());

update public.profiles set display_name = 'Not Öğretmeni Bir' where id = 'f0120000-0000-0000-0000-0000000f0120';

insert into public.organizations (id, name, slug, code)
values
  ('f0210000-0000-0000-0000-0000000f0210', 'Not Dershanesi', 'not-dershanesi', 7967),
  ('f0220000-0000-0000-0000-0000000f0220', 'Not Komşusu', 'not-komsusu', 7968);

insert into public.branches (id, organization_id, name, is_default)
values
  ('f0230000-0000-0000-0000-0000000f0230', 'f0210000-0000-0000-0000-0000000f0210', 'N Ş1', true),
  ('f0240000-0000-0000-0000-0000000f0240', 'f0210000-0000-0000-0000-0000000f0210', 'N Ş2', false);

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status)
values
  ('f0310000-0000-0000-0000-0000000f0310', 'f0210000-0000-0000-0000-0000000f0210', null,
   'f0110000-0000-0000-0000-0000000f0110', 'admin', 'active'),
  ('f0320000-0000-0000-0000-0000000f0320', 'f0210000-0000-0000-0000-0000000f0210', null,
   'f0120000-0000-0000-0000-0000000f0120', 'teacher', 'active'),
  ('f0370000-0000-0000-0000-0000000f0370', 'f0210000-0000-0000-0000-0000000f0210', null,
   'f0170000-0000-0000-0000-0000000f0170', 'teacher', 'active'),
  ('f0330000-0000-0000-0000-0000000f0330', 'f0210000-0000-0000-0000-0000000f0210', null,
   'f0130000-0000-0000-0000-0000000f0130', 'student', 'active'),
  ('f0340000-0000-0000-0000-0000000f0340', 'f0210000-0000-0000-0000-0000000f0210', null,
   'f0140000-0000-0000-0000-0000000f0140', 'parent', 'active'),
  ('f0350000-0000-0000-0000-0000000f0350', 'f0210000-0000-0000-0000-0000000f0210',
   'f0230000-0000-0000-0000-0000000f0230',
   'f0150000-0000-0000-0000-0000000f0150', 'admin', 'active'),
  ('f0360000-0000-0000-0000-0000000f0360', 'f0220000-0000-0000-0000-0000000f0220', null,
   'f0160000-0000-0000-0000-0000000f0160', 'admin', 'active');

insert into public.subjects (id, organization_id, name)
values ('f0410000-0000-0000-0000-0000000f0410', 'f0210000-0000-0000-0000-0000000f0210', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('f0510000-0000-0000-0000-0000000f0510', 'f0210000-0000-0000-0000-0000000f0210', null, 'Not A'),
  ('f0530000-0000-0000-0000-0000000f0530', 'f0210000-0000-0000-0000-0000000f0210',
   'f0240000-0000-0000-0000-0000000f0240', 'Not C');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('f0210000-0000-0000-0000-0000000f0210', 'f0510000-0000-0000-0000-0000000f0510',
   'f0320000-0000-0000-0000-0000000f0320', 'f0410000-0000-0000-0000-0000000f0410'),
  ('f0210000-0000-0000-0000-0000000f0210', 'f0510000-0000-0000-0000-0000000f0510',
   'f0370000-0000-0000-0000-0000000f0370', 'f0410000-0000-0000-0000-0000000f0410');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name, student_number)
values
  ('f0710000-0000-0000-0000-0000000f0710', 'f0210000-0000-0000-0000-0000000f0210', null,
   'f0130000-0000-0000-0000-0000000f0130', 'Not Bir', '9101'),
  ('f0740000-0000-0000-0000-0000000f0740', 'f0210000-0000-0000-0000-0000000f0210',
   'f0240000-0000-0000-0000-0000000f0240', null, 'Not Dört', '9104');

insert into public.class_enrollments (organization_id, class_id, student_id)
values
  ('f0210000-0000-0000-0000-0000000f0210', 'f0510000-0000-0000-0000-0000000f0510', 'f0710000-0000-0000-0000-0000000f0710'),
  ('f0210000-0000-0000-0000-0000000f0210', 'f0530000-0000-0000-0000-0000000f0530', 'f0740000-0000-0000-0000-0000000f0740');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('f0800000-0000-0000-0000-0000000f0800', 'f0210000-0000-0000-0000-0000000f0210',
        'f0140000-0000-0000-0000-0000000f0140', 'Not Velisi');
insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('f0210000-0000-0000-0000-0000000f0210', 'f0710000-0000-0000-0000-0000000f0710',
        'f0800000-0000-0000-0000-0000000f0800');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1 · Öğretmen 1 okuttuğu öğrenciye not yazar
select set_config('request.jwt.claim.sub', 'f0120000-0000-0000-0000-0000000f0120', true);
select lives_ok(
  $$insert into public.student_followup_notes (organization_id, student_id, kind, occurred_on, body)
    values ('f0210000-0000-0000-0000-0000000f0210', 'f0710000-0000-0000-0000-0000000f0710',
            'guardian_meeting', public.orbit_today(), 'Veliyle devamsızlık konuşuldu.')$$,
  'a teacher writes a note for a student they teach'
);

-- 2 · Yazar çağırandan
select is(
  (select author_membership_id::text from public.student_followup_notes),
  'f0320000-0000-0000-0000-0000000f0320',
  'the author is filled from the caller''s membership'
);

-- 3 · ⛔ Yazar istemciden verilemez (sütun yetkisi yok)
select throws_ok(
  $$insert into public.student_followup_notes
      (organization_id, student_id, kind, occurred_on, body, author_membership_id)
    values ('f0210000-0000-0000-0000-0000000f0210', 'f0710000-0000-0000-0000-0000000f0710',
            'observation', public.orbit_today(), 'x', 'f0370000-0000-0000-0000-0000000f0370')$$,
  '42501',
  null,
  'the client cannot claim who wrote a note'
);

-- 4 · ⛔ Gelecek tarih
select throws_ok(
  $$insert into public.student_followup_notes (organization_id, student_id, kind, occurred_on, body)
    values ('f0210000-0000-0000-0000-0000000f0210', 'f0710000-0000-0000-0000-0000000f0710',
            'observation', public.orbit_today() + 1, 'Yarın konuşulacak.')$$,
  '23514',
  'Görüşme tarihi bugünden ileri olamaz.',
  'a note cannot be dated in the future'
);

-- 5 · ⛔ Boş metin
select throws_ok(
  $$insert into public.student_followup_notes (organization_id, student_id, kind, occurred_on, body)
    values ('f0210000-0000-0000-0000-0000000f0210', 'f0710000-0000-0000-0000-0000000f0710',
            'observation', public.orbit_today(), '   ')$$,
  '23514',
  null,
  'an empty note is refused'
);

-- 6 · ⛔ Okutmadığı öğrenciye yazamaz
select throws_ok(
  $$insert into public.student_followup_notes (organization_id, student_id, kind, occurred_on, body)
    values ('f0210000-0000-0000-0000-0000000f0210', 'f0740000-0000-0000-0000-0000000f0740',
            'observation', public.orbit_today(), 'Gözlem.')$$,
  '42501',
  null,
  'a teacher cannot write about a student they do not teach'
);

-- 7 · Yazan kendi notunu düzeltir
update public.student_followup_notes set body = 'Veliyle devamsızlık ve ödev konuşuldu.';
select is(
  (select body from public.student_followup_notes),
  'Veliyle devamsızlık ve ödev konuşuldu.',
  'the author corrects their own note'
);

-- 8 · Aynı sınıfın öbür öğretmeni notu görür, yazar adıyla
select set_config('request.jwt.claim.sub', 'f0170000-0000-0000-0000-0000000f0170', true);
select is(
  (select author_name || ' · ' || is_mine || ' · ' || can_edit
     from public.student_followup_notes_list('f0710000-0000-0000-0000-0000000f0710')),
  'Not Öğretmeni Bir · false · false',
  'another teacher of the class sees the note with its author, but cannot edit it'
);

-- 9 · ⛔ …ve düzeltemez
update public.student_followup_notes set body = 'Değiştirildi';
select is(
  (select body from public.student_followup_notes),
  'Veliyle devamsızlık ve ödev konuşuldu.',
  'a teacher who did not write the note cannot change it'
);

-- 10 · Öbür öğretmen kendi notunu ekler
select lives_ok(
  $$insert into public.student_followup_notes (organization_id, student_id, kind, occurred_on, body)
    values ('f0210000-0000-0000-0000-0000000f0210', 'f0710000-0000-0000-0000-0000000f0710',
            'observation', public.orbit_today() - 3, 'Derste dalgın.')$$,
  'a second teacher adds their own note'
);

-- 11 · ⛔ Öğrenci görmez — ne tablodan ne listeden
select set_config('request.jwt.claim.sub', 'f0130000-0000-0000-0000-0000000f0130', true);
select is(
  (select count(*) from public.student_followup_notes)
    + (select count(*) from public.student_followup_notes_list('f0710000-0000-0000-0000-0000000f0710')),
  0::bigint,
  'a student sees no notes about themselves'
);

-- 12 · ⛔ Veli görmez
select set_config('request.jwt.claim.sub', 'f0140000-0000-0000-0000-0000000f0140', true);
select is(
  (select count(*) from public.student_followup_notes)
    + (select count(*) from public.student_followup_notes_list('f0710000-0000-0000-0000-0000000f0710')),
  0::bigint,
  'a guardian sees no notes about their child'
);

-- 13 · ⛔ Veli yazamaz
select throws_ok(
  $$insert into public.student_followup_notes (organization_id, student_id, kind, occurred_on, body)
    values ('f0210000-0000-0000-0000-0000000f0210', 'f0710000-0000-0000-0000-0000000f0710',
            'observation', public.orbit_today(), 'Veli notu')$$,
  '42501',
  null,
  'a guardian cannot write notes'
);

-- 14 · Şube yöneticisi (Ş1) şubesiz öğrencinin notlarını görür
select set_config('request.jwt.claim.sub', 'f0150000-0000-0000-0000-0000000f0150', true);
select is(
  (select count(*) from public.student_followup_notes),
  2::bigint,
  'a branch admin sees notes of unbranched students'
);

-- 15 · ⛔ …ama Ş2'deki öğrenciye yazamaz
select throws_ok(
  $$insert into public.student_followup_notes (organization_id, student_id, kind, occurred_on, body)
    values ('f0210000-0000-0000-0000-0000000f0210', 'f0740000-0000-0000-0000-0000000f0740',
            'observation', public.orbit_today(), 'Gözlem.')$$,
  '42501',
  null,
  'a branch admin cannot write about a student in another branch'
);

-- 16 · Tam yönetici başkasının notunu arşivler; arşivli not listeden düşer
select set_config('request.jwt.claim.sub', 'f0110000-0000-0000-0000-0000000f0110', true);
update public.student_followup_notes set archived_at = now() where body = 'Derste dalgın.';
select is(
  (select count(*) from public.student_followup_notes_list('f0710000-0000-0000-0000-0000000f0710')),
  1::bigint,
  'an admin archives any note and it leaves the list'
);

-- 17 · Yönetici her notu düzeltebilir (can_edit)
select is(
  (select bool_and(can_edit) from public.student_followup_notes_list('f0710000-0000-0000-0000-0000000f0710')),
  true,
  'an admin can edit every note'
);

-- 18 · ⛔ Denetim kaydında metin yok — ne değer ne alan adının değeri
select is(
  (select count(*) from public.audit_events
    where entity_type = 'followup_note'
      and (metadata::text like '%devamsızlık%' or metadata::text like '%dalgın%')),
  0::bigint,
  'the audit log never carries the note text'
);

-- 19 · …ama değişiklik iz bırakır (ekleme, düzeltme, ekleme, arşiv)
select is(
  (select string_agg(action, ',' order by id) from public.audit_events
    where entity_type = 'followup_note'),
  'followup_note.created,followup_note.updated,followup_note.created,followup_note.archived',
  'every note change leaves a trace'
);

-- 20 · ⛔ Kapsam dışı öğrenci: liste boş, hata değil
select set_config('request.jwt.claim.sub', 'f0120000-0000-0000-0000-0000000f0120', true);
select is(
  (select count(*) from public.student_followup_notes_list('f0740000-0000-0000-0000-0000000f0740')),
  0::bigint,
  'asking for a student out of reach returns nothing rather than an error'
);

-- 21 · ⛔ Komşu kurum görmez
select set_config('request.jwt.claim.sub', 'f0160000-0000-0000-0000-0000000f0160', true);
select is(
  (select count(*) from public.student_followup_notes)
    + (select count(*) from public.student_followup_notes_list('f0710000-0000-0000-0000-0000000f0710')),
  0::bigint,
  'an admin of another institution sees no notes'
);

-- 22 · Eşdeğerlik: her rol için liste = tablo (arşivsiz satırlar)
reset role;
create temp table esdeger (kisi uuid, fark bigint) on commit drop;
grant all on esdeger to authenticated;
set local role authenticated;
do $$
declare
  kisi uuid;
begin
  foreach kisi in array array[
    'f0110000-0000-0000-0000-0000000f0110', 'f0120000-0000-0000-0000-0000000f0120',
    'f0170000-0000-0000-0000-0000000f0170', 'f0130000-0000-0000-0000-0000000f0130',
    'f0140000-0000-0000-0000-0000000f0140', 'f0150000-0000-0000-0000-0000000f0150',
    'f0160000-0000-0000-0000-0000000f0160'
  ]::uuid[] loop
    perform set_config('request.jwt.claim.sub', kisi::text, true);
    insert into esdeger
    select kisi, count(*) from (
      (select id from public.student_followup_notes
        where student_id = 'f0710000-0000-0000-0000-0000000f0710' and archived_at is null
       except
       select id from public.student_followup_notes_list('f0710000-0000-0000-0000-0000000f0710'))
      union all
      (select id from public.student_followup_notes_list('f0710000-0000-0000-0000-0000000f0710')
       except
       select id from public.student_followup_notes
        where student_id = 'f0710000-0000-0000-0000-0000000f0710' and archived_at is null)
    ) as fark;
  end loop;
end;
$$;
select is(
  (select sum(fark) from esdeger),
  0::numeric,
  'for every role the list function returns exactly the rows the table rule allows'
);

select * from finish();
rollback;
