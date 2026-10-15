-- v1.4-11 — Ders bir kayıttır: iz bırakır ve öğretilirken kaybolamaz (#287).
--
-- Üç iddia kümesi:
--
--   1. `subjects` artık denetim defterine yazıyor (ara denetimin atladığı boşluk).
--      ⚠️ Yalnız `name` izleniyor ve bu YETERLİ: `audit_row_change` arşive
--      geçişi ve arşivden dönüşü izlenen alanlardan **bağımsız** olarak
--      `.archived` / `.restored` diye yazıyor (ölçüldü). v1.4-05'te bunun
--      tersi bir tuzak vardı — orada izlenmeyen tek bir alanın değişmesi hiç
--      iz bırakmıyordu; burada arşiv o yola hiç girmiyor.
--   2. Canlı atama veya program satırı taşıyan ders arşivlenemiyor (`ORB03`).
--   3. 🔴 **Geçmiş kayıt arşivlemeyi engellemiyor.** Bu kümenin varlık sebebi
--      kuralın fazla geniş yazılmasını önlemek: beş yabancı anahtarın hepsi
--      sayılsaydı, bir kez yoklama alınmış ders bir daha asla arşivlenemezdi.

begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('d1000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ders-yonetici@example.test', '', now(), now()),
  ('d2000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ders-ogretmen@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('dd000000-0000-0000-0000-0000000000dd', 'Kurum Ders', 'kurum-ders-v1411', 7921);

insert into public.branches (id, organization_id, name, is_default)
values ('dd100000-0000-0000-0000-000000000011', 'dd000000-0000-0000-0000-0000000000dd', 'Ders Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('4a000000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-0000000000dd', null,
   'd1000000-0000-0000-0000-0000000000d1', 'admin', 'active', 1700),
  ('4a000000-0000-0000-0000-000000000002', 'dd000000-0000-0000-0000-0000000000dd',
   'dd100000-0000-0000-0000-000000000011', 'd2000000-0000-0000-0000-0000000000d2',
   'teacher', 'active', 1701);

insert into public.classes (id, organization_id, branch_id, name)
values ('dc000000-0000-0000-0000-0000000000dc', 'dd000000-0000-0000-0000-0000000000dd',
        'dd100000-0000-0000-0000-000000000011', '12-A');

-- =========================================================================
-- 1. Ders iz bırakıyor
-- =========================================================================

insert into public.subjects (id, organization_id, name)
values ('d5000000-0000-0000-0000-0000000000d5', 'dd000000-0000-0000-0000-0000000000dd', 'Astronomi');

select is(
  (select count(*) from public.audit_events
   where entity_type = 'subject'
     and entity_id = 'd5000000-0000-0000-0000-0000000000d5'),
  1::bigint,
  'creating a subject writes exactly one audit event'
);

update public.subjects set name = 'Gök Bilimi'
where id = 'd5000000-0000-0000-0000-0000000000d5';

-- `audit_row_change` izlenen alanların YENİ değerini `metadata`'ya doğrudan
-- koyar; değişenlerin listesi ayrıca `changed` anahtarında durur.
select is(
  (select metadata ->> 'name' from public.audit_events
   where entity_id = 'd5000000-0000-0000-0000-0000000000d5'
   order by id desc limit 1),
  'Gök Bilimi',
  'renaming a subject records the new name — five tables read this label'
);

-- =========================================================================
-- 2. Canlı atama arşivlemeyi engeller
-- =========================================================================

insert into public.class_teachers (id, organization_id, class_id, membership_id, subject_id)
values ('d7000000-0000-0000-0000-0000000000d7', 'dd000000-0000-0000-0000-0000000000dd',
        'dc000000-0000-0000-0000-0000000000dc', '4a000000-0000-0000-0000-000000000002',
        'd5000000-0000-0000-0000-0000000000d5');

select throws_ok(
  $sql$update public.subjects set archived_at = now()
       where id = 'd5000000-0000-0000-0000-0000000000d5'$sql$,
  'ORB03',
  null,
  'a subject with a live teacher assignment cannot be archived'
);

select is(
  (select archived_at from public.subjects where id = 'd5000000-0000-0000-0000-0000000000d5'),
  null::timestamptz,
  'and the refusal changed nothing'
);

-- Atama arşivlenince ders serbest kalıyor.
update public.class_teachers set archived_at = now()
where id = 'd7000000-0000-0000-0000-0000000000d7';

select lives_ok(
  $sql$update public.subjects set archived_at = now()
       where id = 'd5000000-0000-0000-0000-0000000000d5'$sql$,
  'once the assignment is archived the subject can be archived too'
);

-- Arşivden çıkarma bu kuralın konusu değil: kural yalnız arşive GEÇİŞİ sınar.
select lives_ok(
  $sql$update public.subjects set archived_at = null
       where id = 'd5000000-0000-0000-0000-0000000000d5'$sql$,
  'restoring an archived subject is not blocked by this rule'
);

-- =========================================================================
-- 3. Canlı program satırı da engeller
-- =========================================================================

insert into public.schedule_entries
  (id, organization_id, class_id, membership_id, subject_id, day_of_week, starts_at)
values ('d8000000-0000-0000-0000-0000000000d8', 'dd000000-0000-0000-0000-0000000000dd',
        'dc000000-0000-0000-0000-0000000000dc', '4a000000-0000-0000-0000-000000000002',
        'd5000000-0000-0000-0000-0000000000d5', 3, '10:00');

select throws_ok(
  $sql$update public.subjects set archived_at = now()
       where id = 'd5000000-0000-0000-0000-0000000000d5'$sql$,
  'ORB03',
  null,
  'a subject on a live schedule row cannot be archived either'
);

select ok(
  (select true from public.schedule_entries
   where id = 'd8000000-0000-0000-0000-0000000000d8' and archived_at is null),
  'the schedule row is the live one doing the blocking'
);

update public.schedule_entries set archived_at = now()
where id = 'd8000000-0000-0000-0000-0000000000d8';

-- =========================================================================
-- 4. 🔴 Geçmiş kayıt ENGELLEMEZ — kuralın fazla geniş olmadığının kanıtı
-- =========================================================================

insert into public.exams (id, organization_id, class_id, subject_id, name, exam_date, max_score)
values ('d9000000-0000-0000-0000-0000000000d9', 'dd000000-0000-0000-0000-0000000000dd',
        'dc000000-0000-0000-0000-0000000000dc', 'd5000000-0000-0000-0000-0000000000d5',
        'Astronomi Deneme 1', current_date - 30, 100);

-- `assigned_on` varsayılanı bugün ve `due_date >= assigned_on` kısıtı var;
-- geçmiş bir ödev kurmak için ikisi de birlikte geriye alınır.
insert into public.homework_assignments
  (id, organization_id, class_id, subject_id, title, assigned_on, due_date)
values ('da000000-0000-0000-0000-0000000000da', 'dd000000-0000-0000-0000-0000000000dd',
        'dc000000-0000-0000-0000-0000000000dc', 'd5000000-0000-0000-0000-0000000000d5',
        'Yıldız haritası', current_date - 25, current_date - 20);

select lives_ok(
  $sql$update public.subjects set archived_at = now()
       where id = 'd5000000-0000-0000-0000-0000000000d5'$sql$,
  'a past exam and a past homework do NOT block archiving — history is not a live use'
);

select is(
  (select count(*) from public.exams
   where subject_id = 'd5000000-0000-0000-0000-0000000000d5'),
  1::bigint,
  'the exam still points at the subject'
);

select is(
  (select name from public.subjects where id = 'd5000000-0000-0000-0000-0000000000d5'),
  'Gök Bilimi',
  'and the subject row still resolves its name — archiving is not deleting'
);

-- =========================================================================
-- 5. Sınır: kural yalnız arşiv geçişini sınar
-- =========================================================================

select lives_ok(
  $sql$update public.subjects set name = 'Gök Bilimi (kapandı)'
       where id = 'd5000000-0000-0000-0000-0000000000d5'$sql$,
  'renaming an already-archived subject is allowed — the rule guards the transition only'
);

select is(
  (select count(*) from public.audit_events
   where entity_type = 'subject'
     and entity_id = 'd5000000-0000-0000-0000-0000000000d5'),
  6::bigint,
  'every subject write left a trace: create, rename, archive, restore, archive, rename'
);

-- =========================================================================
-- 6. Arşivden çıkarma HER ZAMAN serbest — kuralın sınırı budur
-- =========================================================================
--
-- 🔴 Bu küme bir K-23 mutasyonundan doğdu. Fonksiyondaki
--
--     if new.archived_at is null or old.archived_at is not null then return new;
--
-- satırını etkisizleştirdiğimde **hiçbir iddia kırmızıya dönmedi** — yani sınır
-- korumasızdı. Gerekli olduğu da ölçüldü: `class_teachers`'ın yabancı anahtarı
-- dersin arşivli olup olmadığını **sormuyor**, dolayısıyla arşivli bir derse
-- canlı atama yazılabiliyor. O durumda sınır olmasaydı ders bir daha asla
-- arşivden çıkarılamazdı — kapatılmış bir dersi yeniden açmanın yolu kalmazdı.

insert into public.class_teachers (id, organization_id, class_id, membership_id, subject_id)
values ('db000000-0000-0000-0000-0000000000db', 'dd000000-0000-0000-0000-0000000000dd',
        'dc000000-0000-0000-0000-0000000000dc', '4a000000-0000-0000-0000-000000000002',
        'd5000000-0000-0000-0000-0000000000d5');

select lives_ok(
  $sql$update public.subjects set archived_at = null
       where id = 'd5000000-0000-0000-0000-0000000000d5'$sql$,
  'a subject can be restored even while a live assignment points at it — the rule guards only the transition INTO the archive'
);

select is(
  (select archived_at from public.subjects where id = 'd5000000-0000-0000-0000-0000000000d5'),
  null::timestamptz,
  'and the subject really came back'
);

select * from finish();
rollback;
