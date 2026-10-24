-- v1.2-05 — Sınav sonuçları ve görünürlüğü.
--
-- Bu dosyanın merkezi önceden `exam_ranking()` idi: öğrenciye tüm sıralamayı
-- maskeli isimlerle veren fonksiyon. İstemci onu hiç çağırmadı ve az katılımlı
-- bir sınavda maskeli satırlar kimin kaç aldığını ele veriyordu (iki kişilik
-- sınavda öbür satır, öbür kişidir). Ana plan 5.5'te (2026-10-25) kaldırıldı.
--
-- Görünürlük artık uygulamanın gerçekten okuduğu yoldan sınanıyor: sonuç
-- tablosunun kendisi. Sorular aynı: yönetici her sonucu, öğretmen yalnız
-- okuttuğu öğrencilerinkini, öğrenci yalnız kendisininkini, veli yalnız
-- çocuğununkini görür; sınava girmeyen hiçbir şey görmez.

begin;

create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('11000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kurum-yoneticisi@example.test', '', now(), now()),
  ('22000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'matematik-ogretmeni@example.test', '', now(), now()),
  ('33000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'birinci-ogrenci@example.test', '', now(), now()),
  ('44000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ikinci-ogrenci@example.test', '', now(), now()),
  ('55000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'veli@example.test', '', now(), now()),
  ('66000000-0000-0000-0000-000000000066', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sinava-girmeyen-ogrenci@example.test', '', now(), now()),
  ('77000000-0000-0000-0000-000000000077', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'diger-kurum-yoneticisi@example.test', '', now(), now()),
  ('0b000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'platform-operatoru@example.test', '', now(), now());

insert into public.platform_operators (user_id, role, status)
values ('0b000000-0000-0000-0000-00000000000b', 'owner', 'active');

insert into public.organizations (id, name, slug, code)
values
  ('1a000000-0000-0000-0000-00000000001a', 'Kurum A', 'kurum-a-v1205', 7401),
  ('1b000000-0000-0000-0000-00000000001b', 'Kurum B', 'kurum-b-v1205', 7402);

insert into public.branches (id, organization_id, name, is_default)
values
  ('1aa00000-0000-0000-0000-0000000001aa', '1a000000-0000-0000-0000-00000000001a', 'A Merkez', true),
  ('1bb00000-0000-0000-0000-0000000001bb', '1b000000-0000-0000-0000-00000000001b', 'B Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('a1100000-0000-0000-0000-0000000011a1', '1a000000-0000-0000-0000-00000000001a', null,
   '11000000-0000-0000-0000-000000000011', 'admin', 'active', 1000),
  ('a2200000-0000-0000-0000-0000000022a2', '1a000000-0000-0000-0000-00000000001a', '1aa00000-0000-0000-0000-0000000001aa',
   '22000000-0000-0000-0000-000000000022', 'teacher', 'active', 1001),
  ('a3300000-0000-0000-0000-0000000033a3', '1a000000-0000-0000-0000-00000000001a', '1aa00000-0000-0000-0000-0000000001aa',
   '33000000-0000-0000-0000-000000000033', 'student', 'active', 1002),
  ('a4400000-0000-0000-0000-0000000044a4', '1a000000-0000-0000-0000-00000000001a', '1aa00000-0000-0000-0000-0000000001aa',
   '44000000-0000-0000-0000-000000000044', 'student', 'active', 1003),
  ('a5500000-0000-0000-0000-0000000055a5', '1a000000-0000-0000-0000-00000000001a', '1aa00000-0000-0000-0000-0000000001aa',
   '55000000-0000-0000-0000-000000000055', 'parent', 'active', 1004),
  ('a6600000-0000-0000-0000-0000000066a6', '1a000000-0000-0000-0000-00000000001a', '1aa00000-0000-0000-0000-0000000001aa',
   '66000000-0000-0000-0000-000000000066', 'student', 'active', 1005),
  ('a7700000-0000-0000-0000-0000000077a7', '1b000000-0000-0000-0000-00000000001b', '1bb00000-0000-0000-0000-0000000001bb',
   '77000000-0000-0000-0000-000000000077', 'admin', 'active', 1000);

insert into public.subjects (id, organization_id, name)
values ('5a000000-0000-0000-0000-00000000005a', '1a000000-0000-0000-0000-00000000001a', 'Matematik');

insert into public.classes (id, organization_id, branch_id, name, program)
values
  ('c1000000-0000-0000-0000-0000000000c1', '1a000000-0000-0000-0000-00000000001a',
   '1aa00000-0000-0000-0000-0000000001aa', 'YKS 12-A', 'YKS'),
  ('c2000000-0000-0000-0000-0000000000c2', '1a000000-0000-0000-0000-00000000001a',
   '1aa00000-0000-0000-0000-0000000001aa', 'YKS 12-B', 'YKS'),
  ('c3000000-0000-0000-0000-0000000000c3', '1b000000-0000-0000-0000-00000000001b',
   '1bb00000-0000-0000-0000-0000000001bb', 'LGS 8-A', 'LGS');

-- Öğretmen yalnızca 12-A'ya atanmış. 12-B'nin öğrencisi onun kapsamı dışında.
insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values ('1a000000-0000-0000-0000-00000000001a', 'c1000000-0000-0000-0000-0000000000c1',
        'a2200000-0000-0000-0000-0000000022a2', '5a000000-0000-0000-0000-00000000005a');

insert into public.students (id, organization_id, branch_id, auth_user_id, full_name)
values
  ('50000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-00000000001a',
   '1aa00000-0000-0000-0000-0000000001aa', '33000000-0000-0000-0000-000000000033', 'Birinci Öğrenci'),
  ('50000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-00000000001a',
   '1aa00000-0000-0000-0000-0000000001aa', '44000000-0000-0000-0000-000000000044', 'İkinci Öğrenci'),
  ('50000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-00000000001a',
   '1aa00000-0000-0000-0000-0000000001aa', null, 'Diğer Sınıfın Öğrencisi'),
  ('50000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-00000000001a',
   '1aa00000-0000-0000-0000-0000000001aa', '66000000-0000-0000-0000-000000000066', 'Sınava Girmeyen'),
  ('50000000-0000-0000-0000-000000000005', '1a000000-0000-0000-0000-00000000001a',
   '1aa00000-0000-0000-0000-0000000001aa', null, 'Sonucu Sonra Girilecek'),
  ('50000000-0000-0000-0000-000000000009', '1b000000-0000-0000-0000-00000000001b',
   '1bb00000-0000-0000-0000-0000000001bb', null, 'Diğer Kurumun Öğrencisi');

insert into public.guardians (id, organization_id, auth_user_id, full_name)
values ('60000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-00000000001a',
        '55000000-0000-0000-0000-000000000055', 'Birinci Veli');

insert into public.student_guardians (organization_id, student_id, guardian_id)
values ('1a000000-0000-0000-0000-00000000001a', '50000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000001');

insert into public.class_enrollments (organization_id, class_id, student_id)
values
  ('1a000000-0000-0000-0000-00000000001a', 'c1000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-000000000001'),
  ('1a000000-0000-0000-0000-00000000001a', 'c1000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-000000000002'),
  ('1a000000-0000-0000-0000-00000000001a', 'c2000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-000000000003'),
  ('1a000000-0000-0000-0000-00000000001a', 'c2000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-000000000004'),
  ('1a000000-0000-0000-0000-00000000001a', 'c1000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-000000000005');

-- Kurum geneli deneme: `class_id` boş. Sıralamanın anlamı buradan geliyor.
insert into public.exams (id, organization_id, class_id, subject_id, name, exam_date, max_score)
values ('e0000000-0000-0000-0000-0000000000e1', '1a000000-0000-0000-0000-00000000001a',
        null, null, 'Eylül Denemesi', date '2026-09-12', 120.00);

insert into public.exam_results (organization_id, exam_id, student_id, score)
values
  ('1a000000-0000-0000-0000-00000000001a', 'e0000000-0000-0000-0000-0000000000e1',
   '50000000-0000-0000-0000-000000000001', 80.00),
  ('1a000000-0000-0000-0000-00000000001a', 'e0000000-0000-0000-0000-0000000000e1',
   '50000000-0000-0000-0000-000000000002', 95.00),
  ('1a000000-0000-0000-0000-00000000001a', 'e0000000-0000-0000-0000-0000000000e1',
   '50000000-0000-0000-0000-000000000003', 60.00);

-- Veri düzeyi ------------------------------------------------------------------

select throws_ok(
  $sql$insert into public.exam_results (organization_id, exam_id, student_id, score)
    values (
      '1a000000-0000-0000-0000-00000000001a',
      'e0000000-0000-0000-0000-0000000000e1',
      '50000000-0000-0000-0000-000000000009',
      70.00
    )$sql$,
  '23503',
  null,
  'a result cannot attach a student from another organization'
);

select throws_ok(
  $sql$insert into public.exam_results (organization_id, exam_id, student_id, score)
    values (
      '1a000000-0000-0000-0000-00000000001a',
      'e0000000-0000-0000-0000-0000000000e1',
      '50000000-0000-0000-0000-000000000001',
      90.00
    )$sql$,
  '23505',
  null,
  'a student cannot hold two results in one exam'
);

-- Alt sınır bilinçli olarak yok: net puan negatif olabilir.
select lives_ok(
  $sql$insert into public.exam_results (organization_id, exam_id, student_id, score)
    values (
      '1a000000-0000-0000-0000-00000000001a',
      'e0000000-0000-0000-0000-0000000000e1',
      '50000000-0000-0000-0000-000000000004',
      -5.25
    )$sql$,
  'a negative net score is storable — wrong answers can outweigh right ones'
);

-- Yukarıdaki satır sıralamayı bozmasın diye geri alınıyor; sonraki testler üç
-- sonuçlu bir sınav varsayıyor.
delete from public.exam_results where student_id = '50000000-0000-0000-0000-000000000004';

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
    '1a000000-0000-0000-0000-00000000001a',
    '0b000000-0000-0000-0000-00000000000b'
  )::jsonb @> '[{"table": "exams", "rows": 1}, {"table": "exam_results", "rows": 3}]'::jsonb,
  'the deletion guard counts exams and results without being told about them'
);

-- Yönetici ------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000011', true);

select is(
  (select count(*) from public.exam_results where exam_id = 'e0000000-0000-0000-0000-0000000000e1'),
  3::bigint,
  'an admin reads every result of the exam'
);

select is(
  (select count(*) from public.exam_results as sonuc
     join public.students as ogrenci on ogrenci.id = sonuc.student_id
    where sonuc.exam_id = 'e0000000-0000-0000-0000-0000000000e1'),
  3::bigint,
  'an admin reads the student behind every result'
);

select is(
  (select ogrenci.full_name from public.exam_results as sonuc
     join public.students as ogrenci on ogrenci.id = sonuc.student_id
    where sonuc.exam_id = 'e0000000-0000-0000-0000-0000000000e1'
    order by sonuc.score desc limit 1),
  'İkinci Öğrenci',
  'the highest score belongs to the expected student'
);

-- Öğretmen — 12-A'yı okutuyor, 12-B'yi okutmuyor -----------------------------------

select set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-000000000022', true);

select is(
  (select count(*) from public.exam_results
    where student_id = '50000000-0000-0000-0000-000000000003'),
  0::bigint,
  'a teacher does not see the result of a student they do not teach'
);

select is(
  (select count(*) from public.exam_results as sonuc
     join public.students as ogrenci on ogrenci.id = sonuc.student_id),
  2::bigint,
  'a teacher sees the names behind their own students results only'
);

select is(
  (select count(*) from public.exam_results),
  2::bigint,
  'reading the results table directly gives a teacher only their own students'
);

-- Öğrenci — yalnız kendi sonucu --------------------------------------------------------

select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-000000000033', true);

select is(
  (select count(*) from public.exam_results
    where student_id <> '50000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a student sees no other student result'
);

select is(
  (select count(*) from public.exam_results as sonuc
     join public.students as ogrenci on ogrenci.id = sonuc.student_id),
  1::bigint,
  'a student sees exactly one name behind the results'
);

select is(
  (select ogrenci.full_name from public.exam_results as sonuc
     join public.students as ogrenci on ogrenci.id = sonuc.student_id),
  'Birinci Öğrenci',
  'the one name a student sees is their own'
);

select is(
  (select score from public.exam_results),
  80.00::numeric,
  'a student reads their own score'
);

select is(
  (select count(*) from public.exams where id = 'e0000000-0000-0000-0000-0000000000e1'),
  1::bigint,
  'the exam itself is visible to a student who sat it'
);

select is(
  (select count(*) from public.exam_results),
  1::bigint,
  'the results table itself still gives a student only their own row'
);

-- Veli -------------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '55000000-0000-0000-0000-000000000055', true);

select is(
  (select count(*) from public.exam_results),
  1::bigint,
  'a guardian sees one result, their own child'
);

select is(
  (select ogrenci.full_name from public.exam_results as sonuc
     join public.students as ogrenci on ogrenci.id = sonuc.student_id),
  'Birinci Öğrenci',
  'the child a guardian sees is theirs'
);

-- Sınava girmemiş öğrenci -- hiçbir şey görmemeli ---------------------------------------

select set_config('request.jwt.claim.sub', '66000000-0000-0000-0000-000000000066', true);

select is(
  (select count(*) from public.exam_results),
  0::bigint,
  'a student who did not sit the exam sees no result at all'
);

-- Yazma yetkileri -------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-000000000022', true);

select lives_ok(
  $sql$insert into public.exams (organization_id, class_id, name, exam_date)
    values (
      '1a000000-0000-0000-0000-00000000001a',
      'c1000000-0000-0000-0000-0000000000c1',
      'Sınıf İçi Quiz',
      date '2026-09-15'
    )$sql$,
  'a teacher can open an exam for the class they teach'
);

select throws_ok(
  $sql$insert into public.exams (organization_id, name, exam_date)
    values (
      '1a000000-0000-0000-0000-00000000001a',
      'Kurum Geneli Deneme',
      date '2026-09-16'
    )$sql$,
  '42501',
  null,
  'a teacher cannot open an organization-wide exam'
);

select throws_ok(
  $sql$insert into public.exams (organization_id, class_id, name, exam_date)
    values (
      '1a000000-0000-0000-0000-00000000001a',
      'c2000000-0000-0000-0000-0000000000c2',
      'Başka Sınıfın Quizi',
      date '2026-09-17'
    )$sql$,
  '42501',
  null,
  'a teacher cannot open an exam for a class they do not teach'
);

select lives_ok(
  $sql$insert into public.exam_results (organization_id, exam_id, student_id, score)
    values (
      '1a000000-0000-0000-0000-00000000001a',
      'e0000000-0000-0000-0000-0000000000e1',
      '50000000-0000-0000-0000-000000000005',
      70.00
    )$sql$,
  'a teacher can enter a result for a student they teach'
);

select throws_ok(
  $sql$insert into public.exam_results (organization_id, exam_id, student_id, score)
    values (
      '1a000000-0000-0000-0000-00000000001a',
      'e0000000-0000-0000-0000-0000000000e1',
      '50000000-0000-0000-0000-000000000004',
      55.00
    )$sql$,
  '42501',
  null,
  'a teacher cannot enter a result for a student outside their scope'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000011', true);

select throws_ok(
  $sql$delete from public.exam_results$sql$,
  '42501',
  null,
  'nobody deletes an exam result through the API'
);

-- Sonuç sınavın sınıfına aittir (v1.2-14, K-17) --------------------------------------------
--
-- Bu açık 2026-09-05'e kadar **hiç sınanmamıştı** ve sebebi fixture'ın kendisiydi:
-- buradaki asıl sınav (`e1`) kurum geneli, yani `class_id` boş ve kısıt zaten
-- işlemiyor. Sınıf bağlı durum hiç koşmuyordu.
--
-- Yola YALNIZCA yönetici üzerinden gidilebiliyor ve bu tesadüf değil: öğretmenin
-- yazma kapsamı `teaches_student`'tan geliyor, o da okuttuğu sınıftan — yani tek
-- sınıf okutan bir öğretmen için "yazabildiğim öğrenci" ile "sınavın sınıfındaki
-- öğrenci" kümeleri çakışıyor. Yöneticinin kapsamı ise kurumun tamamı, dolayısıyla
-- **yönetici yolu tamamen korumasızdı.**

select throws_ok(
  $sql$insert into public.exam_results (organization_id, exam_id, student_id, score)
    select
      '1a000000-0000-0000-0000-00000000001a',
      sinav.id,
      '50000000-0000-0000-0000-000000000003',
      42.00
    from public.exams as sinav
    where sinav.name = 'Sınıf İçi Quiz'$sql$,
  'ORB02',
  null,
  'an admin cannot enter a result for a student outside the exam class'
);

select is(
  (select count(*) from public.exam_results as sonuc
     join public.exams as sinav on sinav.id = sonuc.exam_id
   where sinav.name = 'Sınıf İçi Quiz'
     and sonuc.student_id = '50000000-0000-0000-0000-000000000003'),
  0::bigint,
  'the rejected result was really not written'
);

select lives_ok(
  $sql$insert into public.exam_results (organization_id, exam_id, student_id, score)
    select
      '1a000000-0000-0000-0000-00000000001a',
      sinav.id,
      '50000000-0000-0000-0000-000000000002',
      88.00
    from public.exams as sinav
    where sinav.name = 'Sınıf İçi Quiz'$sql$,
  'a result for a student enrolled in the exam class is accepted'
);

-- INSERT'i korumak yetmiyor: `exams.class_id` güncellenebilir, yani kurum geneli
-- bir sınav herkese sonuç girildikten SONRA sınıfa bağlanabilirdi ve kural
-- geriye dönük bozulurdu. `e1`'in sonuçları arasında 12-B'den bir öğrenci (003)
-- var; sınav 12-A'ya taşınamamalı.
select throws_ok(
  $sql$update public.exams
      set class_id = 'c1000000-0000-0000-0000-0000000000c1'
      where id = 'e0000000-0000-0000-0000-0000000000e1'$sql$,
  'ORB02',
  null,
  'an exam cannot move to a class that would orphan its existing results'
);

-- Ve koruma her taşımayı reddetmiyor: sınıfın kaldırılması kuralı gevşetir,
-- dolayısıyla serbest. Her zaman reddeden bir koruma, hiç reddetmeyen kadar
-- yanlıştır.
select lives_ok(
  $sql$update public.exams set class_id = null where name = 'Sınıf İçi Quiz'$sql$,
  'an exam can always be widened to organization scope'
);

-- Kilit ve anon ----------------------------------------------------------------------------

reset role;
update public.profiles set must_change_password = true
where id = '11000000-0000-0000-0000-000000000011';

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000011', true);

select is(
  (select count(*) from public.exam_results),
  0::bigint,
  'results are closed to an admin who must change their password'
);

reset role;
set local role anon;

select throws_ok(
  $sql$select * from public.exam_results$sql$,
  '42501',
  null,
  'anon cannot read exam results'
);

reset role;
select hasnt_function(
  'public', 'exam_ranking', array['uuid'],
  'the unused ranking function is gone (ana plan 5.5)'
);

select * from finish();
rollback;
