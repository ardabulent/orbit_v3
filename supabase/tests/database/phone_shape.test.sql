-- Telefon tek biçim ve önekten bağımsız eşleşme (2026-10-23, ana plan 1.2, test turu B1).
--
--   1–4. phone_key: 0, 90, 0090 öneki ve ayraçlar aynı anahtara iner.
--   5–7. phone_display: TR numarası "+90 5XX XXX XX XX"; yabancı ve tanınmayan korunur.
--   8.   Veli kaydına hangi biçimle yazılırsa yazılsın tek biçimde saklanır.
--   9.   Profil telefonu da.
--  10.   B1: dosyada "0532 111 22 33" ve "+90 (532) 111-22-33" yazan kardeşler TEK veliye bağlanır.
--  11.   Kurumda kayıtlı veli, dosyadaki başka yazımla tanınır (yeni veli açılmaz).
--  12.   ⛔ Tetikleyici fonksiyonu kullanıcıya açık değil; biçim fonksiyonları açık (veri okumazlar).

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select is(public.phone_key('0532 111 22 33'), '5321112233', 'a leading 0 is dropped');
select is(public.phone_key('+90 (532) 111-22-33'), '5321112233', 'a +90 prefix and separators are dropped');
select is(public.phone_key('00905321112233'), '5321112233', 'a 0090 prefix is dropped');
select is(public.phone_key('+49 30 1234567'), '49301234567', 'a foreign number keeps its digits');

select is(public.phone_display('05321112233'), '+90 532 111 22 33', 'a TR mobile is stored in one shape');
select is(public.phone_display('0212 555 12 34'), '+90 212 555 12 34', 'a TR landline too');
select is(
  public.phone_display(' +49 30 1234567 ') || ' | ' || public.phone_display('+1 212 555 1234'),
  '+49 30 1234567 | +1 212 555 1234',
  'foreign numbers are kept as typed (trimmed)'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  ('f0110000-0000-0000-0000-0000000f0110', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tel-yonetici@example.test', '', now(), now());

insert into public.organizations (id, name, slug, code)
values ('f0210000-0000-0000-0000-0000000f0210', 'Telefon Dershanesi', 'telefon-dershanesi', 7997);

insert into public.organization_memberships (organization_id, user_id, role, status)
values ('f0210000-0000-0000-0000-0000000f0210', 'f0110000-0000-0000-0000-0000000f0110', 'admin', 'active');

insert into public.guardians (id, organization_id, full_name, phone)
values ('f0810000-0000-0000-0000-0000000f0810', 'f0210000-0000-0000-0000-0000000f0210',
        'Kayıtlı Veli', '0 (555) 444-33-22');

select is(
  (select phone from public.guardians where id = 'f0810000-0000-0000-0000-0000000f0810'),
  '+90 555 444 33 22',
  'a guardian phone is stored in one shape whatever way it was typed'
);

update public.profiles set phone = '905051112233' where id = 'f0110000-0000-0000-0000-0000000f0110';
select is(
  (select phone from public.profiles where id = 'f0110000-0000-0000-0000-0000000f0110'),
  '+90 505 111 22 33',
  'a profile phone too'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0110000-0000-0000-0000-0000000f0110', true);

select public.import_students('f0210000-0000-0000-0000-0000000f0210', '[
  {"full_name":"Deniz Kaya","student_number":"T1","guardian_name":"Hülya Kaya","guardian_phone":"0532 111 22 33"},
  {"full_name":"Ece Kaya","student_number":"T2","guardian_name":"Hülya Kaya","guardian_phone":"+90 (532) 111-22-33"},
  {"full_name":"Can Kayıtlı","student_number":"T3","guardian_name":"Kayıtlı Veli","guardian_phone":"05554443322"}
]'::jsonb, false);

reset role;

select is(
  (select count(*) || ' veli, ' || string_agg(distinct v.phone, ',')
     from public.guardians as v
    where v.organization_id = 'f0210000-0000-0000-0000-0000000f0210'
      and v.full_name = 'Hülya Kaya'),
  '1 veli, +90 532 111 22 33',
  'B1: siblings written with 0 and +90 prefixes get ONE guardian'
);

select is(
  (select count(*) from public.guardians
    where organization_id = 'f0210000-0000-0000-0000-0000000f0210'
      and full_name = 'Kayıtlı Veli'),
  1::bigint,
  'an existing guardian is recognised through another way of writing the number'
);

select ok(
  has_function_privilege('authenticated', 'public.phone_key(text)', 'execute')
  and has_function_privilege('authenticated', 'public.phone_display(text)', 'execute')
  and not has_function_privilege('anon', 'public.phone_key(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.normalize_phone_column()', 'execute'),
  'shape functions are open to members only; the trigger function is not callable'
);

select * from finish();
rollback;
