-- Ders programı şablonu (2026-10-01): kaydet, ön izle, ata, doldur, temizle.
--
-- Senaryo: A ve B sınıfları; Matematik öğretmeni İKİSİNE de giriyor, Fizik
-- öğretmeni yalnız A'ya. Şablon: Pazartesi 09:00 Matematik, 10:00 Fizik.
--
--   1. Şablon iki kutuyla kaydedilir.
--   2. ⛔ Aynı gün ve saatte iki kutu 22023.
--   3. Ön izleme: A ve B'ye 2'şer ders; açıkta 2 (B Matematik çakışma,
--      B Fizik öğretmensiz) — ve HİÇBİR ŞEY yazılmaz.
--   4. Kayıt: 4 ders; A Matematik öğretmenli, B Matematik öğretmensiz.
--   5. "fill": dolu saatler atlanır, eklenen yok.
--   6. "replace": eskiler arşivlenir, yeniden yazılır.
--   7. Programı temizle: sınıfın etkin dersleri arşivlenir.
--   8. ⛔ Öğretmen şablonları göremez.
--   9. ⛔ Öğretmen ön izleme bile yapamaz (şablonu göremez: P0002).
--  10. ⛔ Bilinmeyen atama biçimi 22023.

begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('b1110000-0000-0000-0000-0000000b1110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ps-yonetici@example.test', '', now(), now()),
  ('b1120000-0000-0000-0000-0000000b1120', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ps-mat@example.test', '', now(), now()),
  ('b1130000-0000-0000-0000-0000000b1130', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ps-fiz@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('b1210000-0000-0000-0000-0000000b1210', 'Program Şablonu', 'program-sablonu', 8905);

insert into public.organization_memberships (id, organization_id, user_id, role, status)
values
  ('b1310000-0000-0000-0000-0000000b1310', 'b1210000-0000-0000-0000-0000000b1210',
   'b1110000-0000-0000-0000-0000000b1110', 'admin', 'active'),
  ('b1320000-0000-0000-0000-0000000b1320', 'b1210000-0000-0000-0000-0000000b1210',
   'b1120000-0000-0000-0000-0000000b1120', 'teacher', 'active'),
  ('b1330000-0000-0000-0000-0000000b1330', 'b1210000-0000-0000-0000-0000000b1210',
   'b1130000-0000-0000-0000-0000000b1130', 'teacher', 'active');

insert into public.subjects (id, organization_id, name)
values
  ('b1410000-0000-0000-0000-0000000b1410', 'b1210000-0000-0000-0000-0000000b1210', 'Matematik'),
  ('b1420000-0000-0000-0000-0000000b1420', 'b1210000-0000-0000-0000-0000000b1210', 'Fizik');

insert into public.classes (id, organization_id, name)
values
  ('b1510000-0000-0000-0000-0000000b1510', 'b1210000-0000-0000-0000-0000000b1210', 'Şablon A'),
  ('b1520000-0000-0000-0000-0000000b1520', 'b1210000-0000-0000-0000-0000000b1210', 'Şablon B');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values
  ('b1210000-0000-0000-0000-0000000b1210', 'b1510000-0000-0000-0000-0000000b1510',
   'b1320000-0000-0000-0000-0000000b1320', 'b1410000-0000-0000-0000-0000000b1410'),
  ('b1210000-0000-0000-0000-0000000b1210', 'b1520000-0000-0000-0000-0000000b1520',
   'b1320000-0000-0000-0000-0000000b1320', 'b1410000-0000-0000-0000-0000000b1410'),
  ('b1210000-0000-0000-0000-0000000b1210', 'b1510000-0000-0000-0000-0000000b1510',
   'b1330000-0000-0000-0000-0000000b1330', 'b1420000-0000-0000-0000-0000000b1420');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b1110000-0000-0000-0000-0000000b1110', true);

create temp table sablon on commit drop as
select public.save_schedule_template(
  'b1210000-0000-0000-0000-0000000b1210', null, '12. sınıf sayısal',
  '[{"day_of_week":1,"starts_at":"09:00","ends_at":"09:40","subject_id":"b1410000-0000-0000-0000-0000000b1410"},
    {"day_of_week":1,"starts_at":"10:00","ends_at":"10:40","subject_id":"b1420000-0000-0000-0000-0000000b1420"}]'
) as id;

-- 1 · İki kutu
select is(
  (select count(*) from public.schedule_template_slots
    where template_id = (select id from sablon) and archived_at is null),
  2::bigint,
  'a template is saved with its slots in one go'
);

-- 2 · Aynı saatte iki kutu
select throws_ok(
  $$select public.save_schedule_template('b1210000-0000-0000-0000-0000000b1210', null, 'Çakışan',
      '[{"day_of_week":1,"starts_at":"09:00","subject_id":"b1410000-0000-0000-0000-0000000b1410"},
        {"day_of_week":1,"starts_at":"09:00","subject_id":"b1420000-0000-0000-0000-0000000b1420"}]')$$,
  '22023',
  null,
  'two subjects on the same day and hour are refused'
);

-- 3 · Ön izleme
create temp table onizleme on commit drop as
select public.apply_schedule_template(
  (select id from sablon),
  array['b1510000-0000-0000-0000-0000000b1510', 'b1520000-0000-0000-0000-0000000b1520']::uuid[],
  'replace', true) as r;

select is(
  (select (r ->> 'saved') || ' ' ||
          (select string_agg((c ->> 'class_name') || ':' || (c ->> 'added'), ',' order by c ->> 'class_name')
             from jsonb_array_elements(r -> 'classes') as x(c)) || ' ' ||
          (select string_agg((u ->> 'subject_name') || '/' || (u ->> 'reason'), ',' order by u ->> 'subject_name')
             from jsonb_array_elements(r -> 'unassigned') as y(u)) || ' ' ||
          (select count(*) from public.schedule_entries
            where class_id in ('b1510000-0000-0000-0000-0000000b1510', 'b1520000-0000-0000-0000-0000000b1520')
              and archived_at is null)
     from onizleme),
  'false Şablon A:2,Şablon B:2 Fizik/no_teacher,Matematik/teacher_busy 0',
  'the preview counts lessons and open slots, and writes nothing'
);

-- 4 · Kayıt
select public.apply_schedule_template(
  (select id from sablon),
  array['b1510000-0000-0000-0000-0000000b1510', 'b1520000-0000-0000-0000-0000000b1520']::uuid[],
  'replace', false);

select is(
  (select string_agg(s.name || ':' || d.name || ':' || coalesce(e.membership_id::text, 'açıkta'), ', '
                     order by s.name, d.name)
     from public.schedule_entries e
     join public.classes s on s.id = e.class_id
     join public.subjects d on d.id = e.subject_id
    where e.class_id in ('b1510000-0000-0000-0000-0000000b1510', 'b1520000-0000-0000-0000-0000000b1520')
      and e.archived_at is null),
  'Şablon A:Fizik:b1330000-0000-0000-0000-0000000b1330, Şablon A:Matematik:b1320000-0000-0000-0000-0000000b1320, Şablon B:Fizik:açıkta, Şablon B:Matematik:açıkta',
  'teachers come from the class pairing; a busy or missing teacher leaves the lesson open'
);

-- 5 · fill: dolu saatler atlanır
select is(
  (select r -> 'classes' -> 0 ->> 'added' || '/' || (r -> 'classes' -> 0 ->> 'skipped')
     from (select public.apply_schedule_template((select id from sablon),
             array['b1510000-0000-0000-0000-0000000b1510']::uuid[], 'fill', false) as r) as x),
  '0/2',
  'fill mode skips hours that already have a lesson'
);

-- 6 · replace: eskiler arşivlenir, yeniden yazılır
select is(
  (select r -> 'classes' -> 0 ->> 'archived' || '/' || (r -> 'classes' -> 0 ->> 'added')
     from (select public.apply_schedule_template((select id from sablon),
             array['b1510000-0000-0000-0000-0000000b1510']::uuid[], 'replace', false) as r) as x),
  '2/2',
  'replace mode archives the old program and writes the template again'
);

-- 7 · Temizle
-- (İki ayrı komut: aynı komuttaki alt sorgu fonksiyonun yazmasını görmez.)
create temp table temizlenen on commit drop as
select public.clear_class_schedule('b1510000-0000-0000-0000-0000000b1510') as adet;

select is(
  (select adet from temizlenen)::text || ' ' ||
  (select count(*) from public.schedule_entries
    where class_id = 'b1510000-0000-0000-0000-0000000b1510' and archived_at is null),
  '2 0',
  'clearing a class archives its whole program'
);

-- 8 · Öğretmen şablonları göremez
select set_config('request.jwt.claim.sub', 'b1120000-0000-0000-0000-0000000b1120', true);
select is(
  (select count(*) from public.schedule_templates),
  0::bigint,
  'a teacher cannot see schedule templates'
);

-- 9 · Öğretmen ön izleme yapamaz — şablonu RLS yüzünden hiç görmediği için
-- "bulunamadı" alır; şablonun var olduğu bile sızmaz.
select throws_ok(
  $$select public.apply_schedule_template(
      (select id from sablon), array['b1510000-0000-0000-0000-0000000b1510']::uuid[], 'replace', true)$$,
  'P0002',
  null,
  'a teacher cannot even preview an assignment'
);

-- 10 · Bilinmeyen biçim
select set_config('request.jwt.claim.sub', 'b1110000-0000-0000-0000-0000000b1110', true);
select throws_ok(
  $$select public.apply_schedule_template(
      (select id from sablon), array['b1510000-0000-0000-0000-0000000b1510']::uuid[], 'merge', true)$$,
  '22023',
  null,
  'an unknown assignment mode is refused'
);

select * from finish();
rollback;
