-- v1.4-05 — Ödev de iz bırakır ve anlık yayılır (#273).
--
-- Bu dilim yeni bir kural getirmiyor; iki mevcut kuralın atladığı tek tabloyu
-- kapatıyor. Dolayısıyla testin işi de farklı: "yeni davranış doğru mu" değil,
-- **"ödev artık diğer dokuz tabloyla aynı mı"**.
--
-- Üç iddia kümesi:
--
--   1. Denetim izi düşüyor ve doğru alanları taşıyor.
--   2. `description` DE izleniyor — ilk yazımda dışarıdaydı ve dışarıdayken
--      yalnız ödev metninin değiştiği bir güncelleme HİÇ iz bırakmıyordu
--      (`audit_row_change` izlenen alan değişmediyse `return null` yapar).
--      Bu, testin kilitlediği asıl karar.
--   3. Realtime yayını gerçekten bir mesaj üretiyor — depoda broadcast
--      tetikleyicilerinin veritabanı düzeyinde sınandığı ilk yer burası.

begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'odev-yonetici@example.test', '', now(), now()),
  ('c2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'odev-ogretmeni@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('cc000000-0000-0000-0000-0000000000cc', 'Kurum Ö', 'kurum-o-v145', 7501);

insert into public.branches (id, organization_id, name, is_default)
values ('c1100000-0000-0000-0000-0000000011c1', 'cc000000-0000-0000-0000-0000000000cc', 'Ö Merkez', true);

insert into public.organization_memberships
  (id, organization_id, branch_id, user_id, role, status, person_code)
values
  ('35000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-0000000000cc', null,
   'c1000000-0000-0000-0000-000000000001', 'admin', 'active', 1100),
  ('35000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-0000000000cc',
   'c1100000-0000-0000-0000-0000000011c1', 'c2000000-0000-0000-0000-000000000002',
   'teacher', 'active', 1101);

insert into public.subjects (id, organization_id, name)
values ('c9000000-0000-0000-0000-000000000009', 'cc000000-0000-0000-0000-0000000000cc', 'Geometri');

insert into public.classes (id, organization_id, branch_id, name)
values ('cb000000-0000-0000-0000-0000000000b1', 'cc000000-0000-0000-0000-0000000000cc',
        'c1100000-0000-0000-0000-0000000011c1', 'Ödev Sınıfı');

insert into public.class_teachers (organization_id, class_id, membership_id, subject_id)
values ('cc000000-0000-0000-0000-0000000000cc', 'cb000000-0000-0000-0000-0000000000b1',
        '35000000-0000-0000-0000-000000000002', 'c9000000-0000-0000-0000-000000000009');

-- =========================================================================
-- Yapı — ödev artık diğer dokuz tabloyla aynı donanımda mı
-- =========================================================================

select is(
  (select count(*) from pg_trigger
   where tgrelid = 'public.homework_assignments'::regclass
     and not tgisinternal
     and tgname in ('homework_assignments_audit_insert', 'homework_assignments_audit_update')),
  2::bigint,
  'homework carries both audit triggers'
);

select is(
  (select count(*) from pg_trigger
   where tgrelid = 'public.homework_assignments'::regclass
     and not tgisinternal
     and tgname like '%_broadcast_%'),
  3::bigint,
  'homework carries all three broadcast triggers'
);

-- =========================================================================
-- Ödev vermek iz bırakır
-- =========================================================================

insert into public.homework_assignments
  (id, organization_id, class_id, subject_id, title, description, due_date)
values
  ('d0000000-0000-0000-0000-0000000000d1', 'cc000000-0000-0000-0000-0000000000cc',
   'cb000000-0000-0000-0000-0000000000b1', 'c9000000-0000-0000-0000-000000000009',
   'Üçgende açı soruları', 'Kitaptan 120-135 arası sorular çözülecek.',
   current_date + 7);

select is(
  (select count(*) from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.created'),
  1::bigint,
  'assigning homework leaves a trace'
);

select is(
  (select entity_type from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.created'),
  'homework',
  'the trace names the entity type'
);

select is(
  (select organization_id from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.created'),
  'cc000000-0000-0000-0000-0000000000cc'::uuid,
  'the trace carries the organization'
);

select is(
  (select metadata ->> 'title' from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.created'),
  'Üçgende açı soruları',
  'the trace carries the title'
);

select is(
  (select metadata ->> 'due_date' from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.created'),
  (current_date + 7)::text,
  'the trace carries the due date'
);

select is(
  (select metadata ->> 'class_id' from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.created'),
  'cb000000-0000-0000-0000-0000000000b1',
  'the trace carries the class'
);

select is(
  (select metadata ->> 'subject_id' from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.created'),
  'c9000000-0000-0000-0000-000000000009',
  'the trace carries the subject'
);

select is(
  (select metadata ->> 'description' from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.created'),
  'Kitaptan 120-135 arası sorular çözülecek.',
  'the trace carries the description — the homework text IS the homework'
);

-- =========================================================================
-- Değişiklikler — ve bu dilimin asıl kararı
-- =========================================================================

update public.homework_assignments
set due_date = current_date + 14
where id = 'd0000000-0000-0000-0000-0000000000d1';

select is(
  (select count(*) from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.updated'),
  1::bigint,
  'postponing the due date leaves a trace'
);

select ok(
  (select metadata -> 'changed' @> '["due_date"]'::jsonb
   from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.updated'),
  'the trace names due_date as the changed field'
);

select ok(
  not (select metadata -> 'changed' @> '["title"]'::jsonb
       from public.audit_events
       where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
         and action = 'homework.updated'),
  'an unchanged field is not listed as changed'
);

-- Aşağıdaki iki iddia `order by id desc` kullanıyor, `created_at` DEĞİL, ve
-- bu bir tercih değil zorunluluk: aynı işlemdeki iki denetim satırının
-- `created_at`'i `now()` olduğu için **birebir aynı** — ilk yazımda saate göre
-- sıraladım ve ikisi de kırmızıya döndü. Deponun zaten öğrendiği ders:
-- `20260909000000_the_audit_cursor_is_the_id_not_the_clock`.
--
-- Bu dilimin en önemli iddiası. `description` izlenen listede olmasaydı
-- `audit_row_change` `cardinality(degisen) = 0` görüp `return null` yapardı ve
-- ödev metninin sessizce yeniden yazılması HİÇ iz bırakmazdı.
update public.homework_assignments
set description = 'Kitaptan 1-5 arası sorular çözülecek.'
where id = 'd0000000-0000-0000-0000-0000000000d1';

select is(
  (select count(*) from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.updated'),
  2::bigint,
  'rewriting ONLY the homework text still leaves a trace'
);

select ok(
  (select metadata -> 'changed' @> '["description"]'::jsonb
   from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.updated'
   order by id desc limit 1),
  'the trace names description as the changed field'
);

select is(
  (select metadata ->> 'description' from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.updated'
   order by id desc limit 1),
  'Kitaptan 1-5 arası sorular çözülecek.',
  'the trace carries the NEW text, so the two versions can be compared'
);

-- İzlenen hiçbir alanın değişmediği bir UPDATE denetim satırı üretmemeli.
update public.homework_assignments
set assigned_on = assigned_on
where id = 'd0000000-0000-0000-0000-0000000000d1';

select is(
  (select count(*) from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.updated'),
  2::bigint,
  'an update that changes no tracked field leaves no trace'
);

-- Arşivleme, izlenen alan listesinden bağımsız olarak kendi eylemini üretir.
update public.homework_assignments
set archived_at = now()
where id = 'd0000000-0000-0000-0000-0000000000d1';

select is(
  (select count(*) from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.archived'),
  1::bigint,
  'archiving homework is its own action, not an update'
);

update public.homework_assignments
set archived_at = null
where id = 'd0000000-0000-0000-0000-0000000000d1';

select is(
  (select count(*) from public.audit_events
   where entity_id = 'd0000000-0000-0000-0000-0000000000d1'
     and action = 'homework.restored'),
  1::bigint,
  'restoring homework is its own action too'
);

-- =========================================================================
-- Realtime — "yayılıyor" da bir iddiadır ve sınanmalı
-- =========================================================================

select is(
  (select count(*) from realtime.messages
   where topic = 'org:cc000000-0000-0000-0000-0000000000cc'
     and payload ->> 'table' = 'homework_assignments'
     and payload ->> 'op' = 'INSERT'),
  1::bigint,
  'assigning homework broadcasts to the organization channel'
);

select is(
  (select count(*) from realtime.messages
   where topic = 'org:cc000000-0000-0000-0000-0000000000cc'
     and payload ->> 'table' = 'homework_assignments'
     and payload ->> 'op' = 'UPDATE'),
  5::bigint,
  'every update broadcasts, including the one that left no audit trace'
);

-- Kanal adı kurum kapsamıdır: başka bir kurumun kanalına hiçbir şey düşmemeli.
select is(
  (select count(*) from realtime.messages
   where topic <> 'org:cc000000-0000-0000-0000-0000000000cc'
     and payload ->> 'table' = 'homework_assignments'
     and inserted_at >= now()),
  0::bigint,
  'no homework message leaks to another organization channel'
);

select * from finish();
rollback;
