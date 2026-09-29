-- Toplu öğrenci aktarımı (2026-09-29): `import_students`.
--
--   1. Ön izleme hatasız dosyada hata döndürmez ve HİÇBİR ŞEY yazmaz.
--   2. Kayıt: 3 öğrenci; kardeşler (aynı telefon) TEK yeni veli; kurumdaki
--      aynı telefon + aynı adlı veli yeniden kullanılır.
--   3. Sınıf adla (harf büyüklüğü fark etmeden) eşleşir, kayıt açılır;
--      öğrencinin şubesi sınıfının şubesidir.
--   4. Kardeşler aynı veliye bağlanır.
--   5. ⛔ Kurumdaki telefon başka bir ada kayıtlıysa hata.
--   6. ⛔ Ya hepsi ya hiçbiri: bir satır hatalıysa hiçbir öğrenci yazılmaz.
--   7. ⛔ Kurumda var olan öğrenci numarası hata.
--   8. ⛔ Olmayan sınıf hata (sınıf açılmaz).
--   9. ⛔ Hata iletileri telefonu tekrar etmez.
--  10. ⛔ Öğretmen ön izleme bile yapamaz (42501).
--  11. ⛔ 500'den fazla satır 22023.
--  12. Denetim kaydı yazılır; yapan yönetici.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c0110000-0000-0000-0000-0000000c0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ta-yonetici@example.test', '', now(), now()),
  ('c0120000-0000-0000-0000-0000000c0120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ta-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('c0210000-0000-0000-0000-0000000c0210', 'Aktarım Dershanesi', 'aktarim-dershanesi', 7996);

insert into public.branches (id, organization_id, name)
values ('c0250000-0000-0000-0000-0000000c0250', 'c0210000-0000-0000-0000-0000000c0210', 'Merkez');

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('c0310000-0000-0000-0000-0000000c0310', 'c0210000-0000-0000-0000-0000000c0210',
   'c0110000-0000-0000-0000-0000000c0110', 'admin', 'active'),
  ('c0320000-0000-0000-0000-0000000c0320', 'c0210000-0000-0000-0000-0000000c0210',
   'c0120000-0000-0000-0000-0000000c0120', 'teacher', 'active');

insert into public.classes (id, organization_id, branch_id, name)
values ('c0510000-0000-0000-0000-0000000c0510', 'c0210000-0000-0000-0000-0000000c0210',
        'c0250000-0000-0000-0000-0000000c0250', '12-A Sayısal');

-- Kurumda zaten olan: bir öğrenci (numara 100) ve bir veli (telefon 0532 000 00 01)
insert into public.students (organization_id, full_name, student_number)
values ('c0210000-0000-0000-0000-0000000c0210', 'Eski Öğrenci', '100');
insert into public.guardians (id, organization_id, full_name, phone)
values ('c0810000-0000-0000-0000-0000000c0810', 'c0210000-0000-0000-0000-0000000c0210',
        'Mevcut Veli', '0532 000 00 01');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'c0110000-0000-0000-0000-0000000c0110', true);

create temp table dosya on commit drop as
select '[
  {"full_name":"Kardeş Bir","student_number":"201","class_name":"12-a sayısal","guardian_name":"Ortak Veli","guardian_phone":"0555 111 22 33"},
  {"full_name":"Kardeş İki","student_number":"202","class_name":"12-A SAYISAL","guardian_name":"ortak veli","guardian_phone":"05551112233"},
  {"full_name":"Mevcut Velinin Çocuğu","guardian_name":"Mevcut Veli","guardian_phone":"05320000001"}
]'::jsonb as satirlar;

-- 1 · Ön izleme: hata yok, hiçbir şey yazılmadı
select is(
  (select public.import_students('c0210000-0000-0000-0000-0000000c0210', satirlar, true)::text
     || ' ' || (select count(*) from public.students
                 where organization_id = 'c0210000-0000-0000-0000-0000000c0210')
   from dosya),
  '{"saved": false, "errors": [], "row_count": 3} 1',
  'a clean preview returns no errors and writes nothing'
);

-- 2 · Kayıt
select is(
  (select (public.import_students('c0210000-0000-0000-0000-0000000c0210', satirlar, false)
            - 'errors')::text
   from dosya),
  '{"saved": true, "students": 3, "row_count": 3, "enrollments": 2, "guardians_reused": 1, "guardians_created": 1}',
  'three students, siblings share one new guardian, the existing guardian is reused'
);

-- 3 · Sınıf kaydı ve şube
select is(
  (select count(*) from public.students as o
     join public.class_enrollments as k on k.student_id = o.id
    where o.student_number in ('201', '202')
      and k.class_id = 'c0510000-0000-0000-0000-0000000c0510'
      and o.branch_id = 'c0250000-0000-0000-0000-0000000c0250'),
  2::bigint,
  'the class matches by name regardless of case, and the student takes the class branch'
);

-- 4 · Kardeşler aynı veliye bağlı
select is(
  (select count(distinct b.guardian_id) from public.student_guardians as b
     join public.students as o on o.id = b.student_id
    where o.student_number in ('201', '202')),
  1::bigint,
  'siblings are linked to one guardian'
);

-- 5 · Telefon başka ada kayıtlı
select is(
  (select public.import_students('c0210000-0000-0000-0000-0000000c0210',
     '[{"full_name":"Yabancı","guardian_name":"Başka Biri","guardian_phone":"0532-000-00-01"}]', true)
     -> 'errors' -> 0 ->> 'message'),
  'Bu telefon kurumda "Mevcut Veli" adlı veliye kayıtlı',
  'a phone registered to a different guardian name is refused, not merged'
);

-- 6 · Ya hepsi ya hiçbiri
select is(
  (select (public.import_students('c0210000-0000-0000-0000-0000000c0210',
     '[{"full_name":"İyi Satır","student_number":"301"},{"full_name":""}]', false) ->> 'saved')
     || ' ' || (select count(*) from public.students where student_number = '301')),
  'false 0',
  'one bad row means no row is written'
);

-- 7 · Var olan numara
select is(
  (select public.import_students('c0210000-0000-0000-0000-0000000c0210',
     '[{"full_name":"Tekrar","student_number":"100"}]', true) -> 'errors' -> 0 ->> 'message'),
  'Bu öğrenci numarası kurumda zaten kayıtlı',
  'a student number already in the institution is refused'
);

-- 8 · Olmayan sınıf
select is(
  (select (public.import_students('c0210000-0000-0000-0000-0000000c0210',
     '[{"full_name":"Sınıfsız","class_name":"12-Z"}]', false) -> 'errors' -> 0 ->> 'message')
     || ' ' || (select count(*) from public.classes where name = '12-Z')),
  '"12-Z" adında bir sınıf yok 0',
  'an unknown class is an error and is never created'
);

-- 9 · Hata iletisi telefonu tekrar etmez
select is(
  (select public.import_students('c0210000-0000-0000-0000-0000000c0210',
     '[{"full_name":"A","guardian_phone":"05559876543"}]', true)::text ~ '9876543'),
  false,
  'error messages never repeat the phone number'
);

-- 12 · Denetim kaydı (öğretmene geçmeden önce yönetici olarak)
select is(
  (select count(*) from public.audit_events
    where organization_id = 'c0210000-0000-0000-0000-0000000c0210'
      and action = 'student.created'
      and actor_user_id = 'c0110000-0000-0000-0000-0000000c0110'),
  3::bigint,
  'every imported student leaves an audit record by the admin'
);

-- 11 · 500'den fazla satır
select throws_ok(
  $$select public.import_students('c0210000-0000-0000-0000-0000000c0210',
      (select jsonb_agg(jsonb_build_object('full_name', 'Ö' || n)) from generate_series(1, 501) as n), true)$$,
  '22023',
  null,
  'more than 500 rows is rejected'
);

-- 10 · Öğretmen ön izleme bile yapamaz
select set_config('request.jwt.claim.sub', 'c0120000-0000-0000-0000-0000000c0120', true);
select throws_ok(
  $$select public.import_students('c0210000-0000-0000-0000-0000000c0210',
      '[{"full_name":"X","student_number":"100"}]', true)$$,
  '42501',
  null,
  'a teacher cannot even preview — the preview would reveal existing numbers'
);

select * from finish();
rollback;
