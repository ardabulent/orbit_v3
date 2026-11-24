-- Takip, 2. dilim (2026-11-24): hedef net — `student_targets` ve
-- `tracking_student_metrics.targets`.
--
-- Kurum: A (şubesiz), C (Ş2). Bir A'da (öğrenci hesabı ve velisi bağlı),
-- Dört C'de. Öğretmen yalnız A'yı okutuyor; şube yöneticisi Ş1'in.
--
-- Okuma öğrenciyi görebilene, yazma yöneticiye ve okutan öğretmene.

begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('e0110000-0000-0000-0000-0000000e0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hd-yonetici@example.test', '', now(), now()),
  ('e0120000-0000-0000-0000-0000000e0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hd-ogretmen@example.test', '', now(), now()),
  ('e0130000-0000-0000-0000-0000000e0130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hd-ogrenci@example.test', '', now(), now()),
  ('e0140000-0000-0000-0000-0000000e0140', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hd-veli@example.test', '', now(), now()),
  ('e0150000-0000-0000-0000-0000000e0150', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hd-sube@example.test', '', now(), now()),
  ('e0160000-0000-0000-0000-0000000e0160', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hd-komsu@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values
  ('e0210000-0000-0000-0000-0000000e0210', 'Hedef Dershanesi', 'hedef-dershanesi', 7965),
  ('e0220000-0000-0000-0000-0000000e0220', 'Hedef Komşusu', 'hedef-komsusu', 7966);

insert into public.branches (id, organization_id, name, is_default)
values
  ('e0230000-0000-0000-0000-0000000e0230', 'e0210000-0000-0000-0000-0000000e0210', 'H Ş1', true),
  ('e0240000-0000-0000-0000-0000000e0240', 'e0210000-0000-0000-0000-0000000e0210', 'H Ş2', false);

insert into public.organization_memberships (id, organization_id, branch_id, user_id, role, status)
values
  ('e0310000-0000-0000-0000-0000000e0310', 'e0210000-0000-0000-0000-0000000e0210', null,
   'e0110000-0000-0000-0000-0000000e0110', 'admin', 'active'),
  ('e0320000-0000-0000-0000-0000000e0320', 'e0210000-0000-0000-0000-0000000e0210', null,
   'e0120000-0000-0000-0000-0000000e0120', 'teacher', 'active'),
  ('e0330000-0000-0000-0000-0000000e0330', 'e0210000-0000-0000-0000-0000000e0210', null,
   'e0130000-0000-0000-0000-0000000e0130', 'student', 'active'),
  ('e0340000-0000-0000-0000-0000000e0340', 'e0210000-0000-0000-0000-0000000e0210', null,
   'e0140000-0000-0000-0000-0000000e0140', 'parent', 'active'),
  ('e0350000-0000-0000-0000-0000000e0350', 'e0210000-0000-0000-0000-0000000e0210',
   'e0230000-0000-0000-0000-0000000e0230',
   'e0150000-0000-0000-0000-0000000e0150', 'admin', 'active'),
  ('e0360000-0000-0000-0000-0000000e0360', 'e0220000-0000-0000-0000-0000000e0220', null,
   'e0160000-0000-0000-0000-0000000e0160', 'admin', 'active');

insert into public.subjects (id, organization_id, name)
values ('e0410000-0000-0000-0000-0000000e0410', 'e0210000-0000-0000-0000-0000000e0210', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name)
values
  ('e0510000-0000-0000-0000-0000000e0510', 'e0210000-0000-0000-0000-0000000e0210', null, 'Hedef A'),
  ('e0530000-0000-0000-0000-0000000e0530', 'e0210000-0000-0000-0000-0000000e0210',
   'e0240000-0000-0000-0000-0000000e0240', 'Hedef C');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values ('e0210000-0000-0000-0000-0000000e0210', 'e0510000-0000-0000-0000-0000000e0510',
        'e0320000-0000-0000-0000-0000000e0320', 'e0410000-0000-0000-0000-0000000e0410');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name, student_number)
values
  ('e0710000-0000-0000-0000-0000000e0710', 'e0210000-0000-0000-0000-0000000e0210', null,
   'e0130000-0000-0000-0000-0000000e0130', 'Hedef Bir', '8001'),
  ('e0740000-0000-0000-0000-0000000e0740', 'e0210000-0000-0000-0000-0000000e0210',
   'e0240000-0000-0000-0000-0000000e0240', null, 'Hedef Dört', '8004');

insert into public.class_enrollments (organization_id, class_id, student_id)
values
  ('e0210000-0000-0000-0000-0000000e0210', 'e0510000-0000-0000-0000-0000000e0510', 'e0710000-0000-0000-0000-0000000e0710'),
  ('e0210000-0000-0000-0000-0000000e0210', 'e0530000-0000-0000-0000-0000000e0530', 'e0740000-0000-0000-0000-0000000e0740');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('e0800000-0000-0000-0000-0000000e0800', 'e0210000-0000-0000-0000-0000000e0210',
        'e0140000-0000-0000-0000-0000000e0140', 'Hedef Velisi');
insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('e0210000-0000-0000-0000-0000000e0210', 'e0710000-0000-0000-0000-0000000e0710',
        'e0800000-0000-0000-0000-0000000e0800');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1 · Okutan öğretmen toplam hedef yazar
select set_config('request.jwt.claim.sub', 'e0120000-0000-0000-0000-0000000e0120', true);
select lives_ok(
  $$insert into public.student_targets (organization_id, student_id, subject_id, target_net)
    values ('e0210000-0000-0000-0000-0000000e0210', 'e0710000-0000-0000-0000-0000000e0710', null, 80)$$,
  'a teacher sets the total target of a student they teach'
);

-- 2 · Yazanı veritabanı doldurur
select is(
  (select set_by_membership_id::text from public.student_targets where subject_id is null),
  'e0320000-0000-0000-0000-0000000e0320',
  'the setter is filled from the caller''s membership'
);

-- 3 · ⛔ Aynı öğrencinin ikinci toplam hedefi olamaz (nulls not distinct)
select throws_ok(
  $$insert into public.student_targets (organization_id, student_id, subject_id, target_net)
    values ('e0210000-0000-0000-0000-0000000e0210', 'e0710000-0000-0000-0000-0000000e0710', null, 70)$$,
  '23505',
  null,
  'a student has one total target'
);

-- 4 · İstemcinin yazma biçimi: upsert (çakışmada her sütun) — ders hedefi
select lives_ok(
  $$insert into public.student_targets (organization_id, student_id, subject_id, target_net)
    values ('e0210000-0000-0000-0000-0000000e0210', 'e0710000-0000-0000-0000-0000000e0710',
            'e0410000-0000-0000-0000-0000000e0410', 30),
           ('e0210000-0000-0000-0000-0000000e0210', 'e0710000-0000-0000-0000-0000000e0710', null, 85)
    on conflict (student_id, subject_id) do update set
      organization_id = excluded.organization_id, student_id = excluded.student_id,
      subject_id = excluded.subject_id, target_net = excluded.target_net$$,
  'targets are saved in one upsert, the total one updated in place'
);

-- 5 · ⛔ Okutmadığı öğrenciye yazamaz
select throws_ok(
  $$insert into public.student_targets (organization_id, student_id, subject_id, target_net)
    values ('e0210000-0000-0000-0000-0000000e0210', 'e0740000-0000-0000-0000-0000000e0740', null, 60)$$,
  '42501',
  null,
  'a teacher cannot set a target for a student they do not teach'
);

-- 6 · ⛔ Aralık dışı hedef
select throws_ok(
  $$update public.student_targets set target_net = 250 where subject_id is null$$,
  '23514',
  null,
  'a target above 200 net is refused'
);

-- 7 · Öğrenci kendi hedeflerini görür
select set_config('request.jwt.claim.sub', 'e0130000-0000-0000-0000-0000000e0130', true);
select is(
  (select string_agg(target_net::text, ',' order by target_net) from public.student_targets),
  '30.00,85.00',
  'a student sees their own targets'
);

-- 8 · ⛔ Öğrenci hedefini değiştiremez (satır güncellenmez)
update public.student_targets set target_net = 200 where subject_id is null;
select is(
  (select target_net::text from public.student_targets where subject_id is null),
  '85.00',
  'a student cannot change their target'
);

-- 9 · Veli çocuğunun hedefini görür
select set_config('request.jwt.claim.sub', 'e0140000-0000-0000-0000-0000000e0140', true);
select is(
  (select count(*) from public.student_targets),
  2::bigint,
  'a guardian sees their child''s targets'
);

-- 10 · ⛔ Veli yazamaz
select throws_ok(
  $$insert into public.student_targets (organization_id, student_id, subject_id, target_net)
    values ('e0210000-0000-0000-0000-0000000e0210', 'e0740000-0000-0000-0000-0000000e0740', null, 60)$$,
  '42501',
  null,
  'a guardian cannot set targets'
);

-- 11 · Şube yöneticisi (Ş1): şubesiz öğrenciyi görür, Ş2'deki öğrenciye yazamaz
select set_config('request.jwt.claim.sub', 'e0150000-0000-0000-0000-0000000e0150', true);
select is(
  (select count(*) from public.student_targets),
  2::bigint,
  'a branch admin sees targets of unbranched students'
);
select throws_ok(
  $$insert into public.student_targets (organization_id, student_id, subject_id, target_net)
    values ('e0210000-0000-0000-0000-0000000e0210', 'e0740000-0000-0000-0000-0000000e0740', null, 60)$$,
  '42501',
  null,
  'a branch admin cannot set targets in another branch'
);

-- 13 · Tam yönetici her öğrenciye yazar; hedef kaldırma = değeri boşaltmak
select set_config('request.jwt.claim.sub', 'e0110000-0000-0000-0000-0000000e0110', true);
insert into public.student_targets (organization_id, student_id, subject_id, target_net)
values ('e0210000-0000-0000-0000-0000000e0210', 'e0740000-0000-0000-0000-0000000e0740', null, 60);
update public.student_targets set target_net = null
 where student_id = 'e0740000-0000-0000-0000-0000000e0740';
select is(
  (select count(*) from public.audit_events
    where entity_type = 'student_target'
      and organization_id = 'e0210000-0000-0000-0000-0000000e0210'),
  5::bigint,
  'every target change leaves a trace, removal included'
);

-- 14 · Takip fonksiyonu hedefleri döndürür; kaldırılan hedef listeye girmez
select is(
  (select targets::text from public.tracking_student_metrics(4, null, 'e0710000-0000-0000-0000-0000000e0710')),
  '[{"subject_id": null, "target_net": 85.00}, {"subject_id": "e0410000-0000-0000-0000-0000000e0410", "target_net": 30.00}]',
  'tracking returns the total target first, then subject targets'
);
select is(
  (select targets::text from public.tracking_student_metrics(4, null, 'e0740000-0000-0000-0000-0000000e0740')),
  '[]',
  'a removed target is not returned'
);

-- 16 · ⛔ Komşu kurum görmez
select set_config('request.jwt.claim.sub', 'e0160000-0000-0000-0000-0000000e0160', true);
select is(
  (select count(*) from public.student_targets),
  0::bigint,
  'an admin of another institution sees none of these targets'
);

select * from finish();
rollback;
