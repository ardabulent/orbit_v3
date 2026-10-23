-- Telefon tek biçim ve önekten bağımsız eşleşme (2026-10-23).
--
-- Ana plan 1.2, test turu B1: içe aktarma veliyi telefonun yalnız rakamlarıyla
-- tanıyordu. "0532 111 22 33" (05321112233) ile "+90 (532) 111-22-33"
-- (905321112233) farklı sayıldı; kardeşlerin velisi iki kayda bölündü ve
-- hesap bağlanınca veli çocuklardan birini görmedi.
--
--   phone_key(t)      karşılaştırma anahtarı: rakamlar; baştaki 0090, 90 (12
--                     hane) ya da 0 (11 hane) atılır → TR numarası 10 hane.
--   phone_display(t)  saklama biçimi: anahtar 10 haneli bir TR numarasıysa
--                     (2–5 ile başlar) "+90 5XX XXX XX XX"; değilse girildiği
--                     gibi (kırpılmış). Yurt dışı ve tanınmayan biçimler
--                     korunur — sütun yorumundaki "biçim doğrulanmaz" kararı
--                     geçerli; burada yalnız tanınan biçim tekleşiyor.
--
-- `guardians.phone` ve `profiles.phone` bir BEFORE tetikleyiciyle her yazmada
-- tek biçime çevrilir: içe aktarma, "Yeni öğrenci", veli düzenleme ve profil
-- hangi yoldan gelirse gelsin. Mevcut telefonlar da aynı göçte çevrilir.
-- İçe aktarma eşleşmeyi `phone_key` ile yapar.

create function public.phone_key(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    case
      when rakam ~ '^0090[0-9]{10}$' then substr(rakam, 5)
      when rakam ~ '^90[0-9]{10}$' then substr(rakam, 3)
      when rakam ~ '^0[0-9]{10}$' then substr(rakam, 2)
      else rakam
    end,
    ''
  )
  from (select regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') as rakam) as r;
$$;

comment on function public.phone_key(text) is
  'Telefon karşılaştırma anahtarı: rakamlar, baştaki 0090 / 90 (12 hane) / 0 (11 hane) atılmış. 0532 111 22 33, +90 (532) 111-22-33 ve 00905321112233 aynı anahtarı verir. 2026-10-23.';

create function public.phone_display(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when raw is null or btrim(raw) = '' then null
    when public.phone_key(raw) ~ '^[2-5][0-9]{9}$'
      and (btrim(raw) !~ '^\+' or btrim(raw) ~ '^\+ *90')
      then '+90 ' || substr(public.phone_key(raw), 1, 3)
        || ' ' || substr(public.phone_key(raw), 4, 3)
        || ' ' || substr(public.phone_key(raw), 7, 2)
        || ' ' || substr(public.phone_key(raw), 9, 2)
    else btrim(raw)
  end;
$$;

comment on function public.phone_display(text) is
  'Saklama biçimi: tanınan TR numarası "+90 5XX XXX XX XX"; başka ülke kodu ya da tanınmayan biçim girildiği gibi (kırpılmış). 2026-10-23.';

-- İçe aktarma (security invoker) ve tetikleyici çağıranın yetkisiyle çalışır;
-- iki fonksiyon da veri okumaz.
revoke all on function public.phone_key(text) from public, anon;
grant execute on function public.phone_key(text) to authenticated;
revoke all on function public.phone_display(text) from public, anon;
grant execute on function public.phone_display(text) to authenticated;

create function public.normalize_phone_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phone := public.phone_display(new.phone);
  return new;
end;
$$;

revoke all on function public.normalize_phone_column() from public, anon, authenticated;

create trigger guardians_normalize_phone
  before insert or update of phone on public.guardians
  for each row execute function public.normalize_phone_column();

create trigger profiles_normalize_phone
  before insert or update of phone on public.profiles
  for each row execute function public.normalize_phone_column();

update public.guardians
set phone = public.phone_display(phone)
where phone is distinct from public.phone_display(phone);

update public.profiles
set phone = public.phone_display(phone)
where phone is distinct from public.phone_display(phone);

create or replace function public.import_students(
  p_organization_id uuid,
  p_rows jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  satir record;
  hatalar jsonb := '[]'::jsonb;
  sinif record;
  sinif_sayisi integer;
  mevcut_veli record;
  ogrenci_id uuid;
  veli_id uuid;
  veli_haritasi jsonb := '{}'::jsonb;
  yeni_ogrenci integer := 0;
  yeni_veli integer := 0;
  mevcut_veli_kullanildi integer := 0;
  sinif_kaydi integer := 0;
  -- Satırlar bellekte bir jsonb dizisi olarak tutulur. Geçici tablo
  -- kullanılmadı: aynı işlemde iki kez çağrılınca onu temizlemek `drop` ya da
  -- `truncate` ister ve yıkıcı göç denetimi (haklı olarak) ikisini de engeller.
  veri jsonb;
  sinif_haritasi jsonb := '{}'::jsonb;
  sinif_id uuid;
  sube_id uuid;
begin
  if not (
    public.current_user_has_membership(p_organization_id, null, array['admin']::public.app_role[])
    and not public.current_user_must_change_password()
  ) then
    raise exception 'Toplu öğrenci aktarımını yalnız kurum yöneticisi yapabilir'
      using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Satırlar bir dizi olmalı' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 500 then
    raise exception 'Dosyada 1 ile 500 arasında öğrenci olmalı'
      using errcode = '22023';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'no', sira,
             'ad', nullif(btrim(eleman ->> 'full_name'), ''),
             'numara', nullif(btrim(eleman ->> 'student_number'), ''),
             'sinif_adi', nullif(btrim(eleman ->> 'class_name'), ''),
             'veli_adi', nullif(btrim(eleman ->> 'guardian_name'), ''),
             'veli_tel', nullif(btrim(eleman ->> 'guardian_phone'), ''),
             'tel_rakam', public.phone_key(eleman ->> 'guardian_phone')
           )
           order by sira
         )
    into veri
    from jsonb_array_elements(p_rows) with ordinality as e(eleman, sira);

  -- Satır satır doğrulama ------------------------------------------------
  for satir in select * from jsonb_to_recordset(veri) as x(no integer, ad text, numara text, sinif_adi text, veli_adi text, veli_tel text, tel_rakam text) order by x.no loop
    if satir.ad is null then
      hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'full_name',
        'message', 'Ad soyad boş');
    elsif char_length(satir.ad) > 120 then
      hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'full_name',
        'message', 'Ad soyad 120 karakteri geçemez');
    end if;

    if satir.numara is not null then
      if char_length(satir.numara) > 32 then
        hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'student_number',
          'message', 'Öğrenci numarası 32 karakteri geçemez');
      elsif exists (
        select 1 from jsonb_to_recordset(veri) as diger(no integer, ad text, numara text, sinif_adi text, veli_adi text, veli_tel text, tel_rakam text)
         where diger.numara = satir.numara and diger.no < satir.no
      ) then
        hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'student_number',
          'message', 'Bu öğrenci numarası dosyada daha önce geçiyor');
      elsif exists (
        select 1 from public.students as o
         where o.organization_id = p_organization_id and o.student_number = satir.numara
      ) then
        hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'student_number',
          'message', 'Bu öğrenci numarası kurumda zaten kayıtlı');
      end if;
    end if;

    if satir.sinif_adi is not null then
      select count(*) into sinif_sayisi
        from public.classes as s
       where s.organization_id = p_organization_id
         and s.archived_at is null
         and public.turkish_name_key(s.name) = public.turkish_name_key(satir.sinif_adi);
      if sinif_sayisi = 0 then
        hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'class_name',
          'message', format('"%s" adında bir sınıf yok', satir.sinif_adi));
      elsif sinif_sayisi > 1 then
        hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'class_name',
          'message', format('"%s" adında birden çok sınıf var', satir.sinif_adi));
      else
        select s.id, s.branch_id into sinif
          from public.classes as s
         where s.organization_id = p_organization_id
           and s.archived_at is null
           and public.turkish_name_key(s.name) = public.turkish_name_key(satir.sinif_adi);
        sinif_haritasi := sinif_haritasi || jsonb_build_object(
          satir.no::text, jsonb_build_object('id', sinif.id, 'sube', sinif.branch_id));
      end if;
    end if;

    if satir.veli_tel is not null and satir.veli_adi is null then
      hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'guardian_name',
        'message', 'Veli telefonu var ama veli adı boş');
    end if;
    if satir.veli_adi is not null and char_length(satir.veli_adi) > 120 then
      hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'guardian_name',
        'message', 'Veli adı 120 karakteri geçemez');
    end if;
    if satir.veli_tel is not null then
      if char_length(satir.veli_tel) > 30 or coalesce(char_length(satir.tel_rakam), 0) < 7 then
        hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'guardian_phone',
          'message', 'Veli telefonu geçersiz (en az 7 rakam, en çok 30 karakter)');
      elsif satir.veli_adi is not null then
        if exists (
          select 1 from jsonb_to_recordset(veri) as diger(no integer, ad text, numara text, sinif_adi text, veli_adi text, veli_tel text, tel_rakam text)
           where diger.tel_rakam = satir.tel_rakam
             and diger.no < satir.no
             and public.turkish_name_key(diger.veli_adi) <> public.turkish_name_key(satir.veli_adi)
        ) then
          hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'guardian_phone',
            'message', 'Bu telefon dosyada başka bir veli adıyla geçiyor');
        end if;
        select v.id, v.full_name into mevcut_veli
          from public.guardians as v
         where v.organization_id = p_organization_id
           and v.archived_at is null
           and public.phone_key(v.phone) = satir.tel_rakam
         order by v.created_at
         limit 1;
        if found and public.turkish_name_key(mevcut_veli.full_name) <> public.turkish_name_key(satir.veli_adi) then
          hatalar := hatalar || jsonb_build_object('row', satir.no, 'field', 'guardian_phone',
            'message', format('Bu telefon kurumda "%s" adlı veliye kayıtlı', mevcut_veli.full_name));
        end if;
      end if;
    end if;
  end loop;

  if jsonb_array_length(hatalar) > 0 or p_dry_run then
    return jsonb_build_object(
      'saved', false,
      'row_count', jsonb_array_length(veri),
      'errors', hatalar
    );
  end if;

  -- Yazma: hata yok, tek işlem -----------------------------------------------
  for satir in select * from jsonb_to_recordset(veri) as x(no integer, ad text, numara text, sinif_adi text, veli_adi text, veli_tel text, tel_rakam text) order by x.no loop
    sinif_id := (sinif_haritasi -> satir.no::text ->> 'id')::uuid;
    sube_id := (sinif_haritasi -> satir.no::text ->> 'sube')::uuid;

    insert into public.students (organization_id, branch_id, full_name, student_number)
    values (p_organization_id, sube_id, satir.ad, satir.numara)
    returning id into ogrenci_id;
    yeni_ogrenci := yeni_ogrenci + 1;

    if sinif_id is not null then
      insert into public.class_enrollments (organization_id, class_id, student_id)
      values (p_organization_id, sinif_id, ogrenci_id);
      sinif_kaydi := sinif_kaydi + 1;
    end if;

    if satir.veli_adi is not null then
      veli_id := null;
      if satir.tel_rakam is not null then
        veli_id := (veli_haritasi ->> satir.tel_rakam)::uuid;
        if veli_id is null then
          select v.id into veli_id
            from public.guardians as v
           where v.organization_id = p_organization_id
             and v.archived_at is null
             and public.phone_key(v.phone) = satir.tel_rakam
           order by v.created_at
           limit 1;
          if veli_id is not null then
            mevcut_veli_kullanildi := mevcut_veli_kullanildi + 1;
          end if;
        end if;
      end if;

      if veli_id is null then
        insert into public.guardians (organization_id, full_name, phone)
        values (p_organization_id, satir.veli_adi, satir.veli_tel)
        returning id into veli_id;
        yeni_veli := yeni_veli + 1;
      end if;

      if satir.tel_rakam is not null then
        veli_haritasi := veli_haritasi || jsonb_build_object(satir.tel_rakam, veli_id);
      end if;

      insert into public.student_guardians (organization_id, student_id, guardian_id)
      values (p_organization_id, ogrenci_id, veli_id);
    end if;
  end loop;

  return jsonb_build_object(
    'saved', true,
    'row_count', yeni_ogrenci,
    'errors', '[]'::jsonb,
    'students', yeni_ogrenci,
    'enrollments', sinif_kaydi,
    'guardians_created', yeni_veli,
    'guardians_reused', mevcut_veli_kullanildi
  );
end;
$$;

comment on function public.import_students(uuid, jsonb, boolean) is
  'Ayarlar → Veri içe aktarma: en çok 500 satırlık öğrenci listesini doğrular (p_dry_run = true, ön izleme) ya da hatasızsa tek işlemde yazar (öğrenci, sınıf kaydı, veli, bağ). Ya hepsi ya hiçbiri. Hesap/şifre açmaz. Veli telefonu `phone_key` ile tanınır (0, 90, 0090 öneki eşitlenir; 2026-10-23); kurumdaki aynı telefonlu velinin adı farklıysa hata. Sınıf adla eşleşir, açılmaz. `security invoker` + baştaki açık yönetici kontrolü (ön izleme yazmadığı için RLS onu korumaz). Hata iletileri telefonu tekrar etmez.';

revoke all on function public.import_students(uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_students(uuid, jsonb, boolean) to authenticated;
