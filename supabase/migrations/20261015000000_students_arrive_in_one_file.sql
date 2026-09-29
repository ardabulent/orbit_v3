-- Öğrenciler tek bir dosyayla gelir.
--
-- Ayarlar → Veri içe aktarma (karar 2026-09-29, Arda Bülent): pilot kurum
-- ilk gün yüzlerce öğrenciyi tek tek girmesin. Yönetici bir CSV yükler
-- (Ad Soyad, Öğrenci No, Sınıf, Veli Ad Soyad, Veli Telefon); ekran önce
-- ÖN İZLEME ister, hatasızsa kaydeder.
--
-- Sözleşme:
--   * Ön izleme ve kayıt AYNI fonksiyon, aynı doğrulama (`p_dry_run`). İstemci
--     kendi kuralını yazmaz; ön izlemede "geçer" denen dosya kayıtta da geçer.
--   * YA HEPSİ YA HİÇBİRİ: tek satırda hata varsa hiçbir şey yazılmaz. Hata
--     yoksa her şey tek işlemde yazılır; beklenmeyen bir hata da hepsini geri
--     alır (fonksiyon tek bir işlemdir).
--   * Hesap ve şifre AÇILMAZ — yalnız kayıtlar (öğrenci, sınıf kaydı, veli,
--     öğrenci–veli bağı). Hesap açmak Supabase Auth'un işi ve ajana
--     bırakılmayan bir adım (AGENTS.md kısıt 4 ruhu); tek tek yapılır.
--   * Veli telefonla tanınır: dosyada aynı telefon birden çok satırda geçerse
--     (kardeşler) TEK veli açılır. Kurumda aynı telefonla kayıtlı bir veli
--     varsa ve adı da aynıysa o veli kullanılır; ad farklıysa satır hata
--     verir — iki farklı kişiyi sessizce birleştirmek yerine sormak doğru.
--     Karşılaştırmada telefonun yalnız rakamları sayılır.
--   * Sınıf ADıyla eşleşir (büyük/küçük harf farkı yok); kurumda yoksa ya da
--     aynı adla birden çok arşivsiz sınıf varsa hata. Sınıf açılmaz.
--   * Öğrencinin şubesi sınıfının şubesidir; sınıfsız öğrenci kurum
--     genelidir. Şube yöneticisi yalnız kendi şubesine ekleyebilir (RLS).
--   * En çok 500 satır.
--
-- Yetki: fonksiyon `security invoker`; yazmaları RLS süzer. AMA ön izleme
-- hiçbir şey yazmadığı için RLS onu korumaz — ön izleme "bu öğrenci
-- numarası var mı, bu telefon kimin" sorularını cevaplar. Bu yüzden baştaki
-- açık yönetici kontrolü güvenlik sınırıdır: yönetici değilse 42501.
--
-- Kişisel veri: hata iletileri telefonu TEKRAR ETMEZ; satır numarası ve alan
-- yeter. Fonksiyon hiçbir şeyi loglamaz.

-- Türkçe ad karşılaştırması. `lower('SAYISAL')` = 'sayisal' ama
-- `lower('Sayısal')` = 'sayısal': büyük harfle yazılmış bir sınıf adı hiç
-- eşleşmezdi (testte yakalandı). I/İ/ı/i dördü aynı sayılır, Türkçe büyük
-- harfler yerel ayardan bağımsız küçültülür.
create function public.turkish_name_key(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(translate(value, 'IİıŞĞÜÖÇ', 'iiişğüöç')));
$$;

revoke all on function public.turkish_name_key(text) from public, anon;
grant execute on function public.turkish_name_key(text) to authenticated;

create function public.import_students(
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
             'tel_rakam', nullif(regexp_replace(coalesce(eleman ->> 'guardian_phone', ''), '\D', '', 'g'), '')
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
           and regexp_replace(coalesce(v.phone, ''), '\D', '', 'g') = satir.tel_rakam
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
             and regexp_replace(coalesce(v.phone, ''), '\D', '', 'g') = satir.tel_rakam
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
  'Ayarlar → Veri içe aktarma: en çok 500 satırlık öğrenci listesini doğrular (p_dry_run = true, ön izleme) ya da hatasızsa tek işlemde yazar (öğrenci, sınıf kaydı, veli, bağ). Ya hepsi ya hiçbiri. Hesap/şifre açmaz. Veli telefon rakamlarıyla tanınır; kurumdaki aynı telefonlu velinin adı farklıysa hata. Sınıf adla eşleşir, açılmaz. `security invoker` + baştaki açık yönetici kontrolü (ön izleme yazmadığı için RLS onu korumaz). Hata iletileri telefonu tekrar etmez.';

revoke all on function public.import_students(uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_students(uuid, jsonb, boolean) to authenticated;
