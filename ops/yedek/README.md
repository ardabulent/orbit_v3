# Gece yedeği

Üretim veritabanı her gece 03:17'de (Türkiye) yedeklenir, şifrelenir ve GitHub'da 90 gün saklanır. Ücretsizdir ve üçüncü bir firma kullanmaz.

**Karar:** kullanıcı, 2026-10-05. Supabase Pro yerine kendi yedeğimiz; ücretsiz planda otomatik yedek de PITR de yok.

**Görev:** `.github/workflows/gece-yedegi.yml`.

## Nasıl çalışır

1. `supabase db dump` üç dosya çıkarır: roller, şema ve veri. Veri, kullanıcı hesaplarını (şifre özetleri dahil) ve bütün uygulama tablolarını içerir.
2. Üç dosya tek arşive konur ve repodaki **açık anahtarla** şifrelenir.
3. Şifreli dosya, o gecenin GitHub Actions koşusuna ek (artifact) olarak konur ve 90 gün saklanır.

**Kasa benzetmesi:** Açık anahtar kasayı kilitler ama açamaz; repoda durması bu yüzden sorun değildir. Kasayı açan **gizli anahtar** yalnız kurum sahibindedir.

⚠️ Repo herkese açıktır. GitHub'a giriş yapmış herkes eki indirebilir. Bu yüzden şifresiz hiçbir şey yüklenmez; şifreli dosyanın içi okunamaz.

## Kurulum (bir kez)

### 1. Anahtar çiftini üret

Bu adımı kurum sahibi kendi bilgisayarında yapar; ajan yapmaz (AGENTS.md kısıt 4). Git Bash'te, repo klasöründe:

```bash
bash ops/yedek/anahtar-uret.sh
```

- `ops/yedek/yedek-acik-anahtar.asc` oluşur. Bu dosya repoya girer.
- Masaüstüne `ORBIT-yedek-GIZLI-anahtar.asc` düşer. Bunu **şifre yöneticisine ekle, sonra masaüstünden sil.**
  - **Kaybolursa:** hiçbir yedek açılamaz.
  - **Başkasına geçerse:** bütün yedekler okunabilir. Bu durumda anahtar yenilenir (aşağıda).

### 2. Veritabanı adresini GitHub'a sır olarak gir

1. Supabase paneli → proje → **Connect** düğmesi → **Session pooler** sekmesi. Bağlantı adresini kopyala.
   - ⚠️ "Direct connection" değil. O adres IPv6'dır ve GitHub'ın makineleri IPv6'ya çıkamaz.
2. Adresteki `[YOUR-PASSWORD]` yerine veritabanı şifresini yaz.
   - Şifre bilinmiyorsa: Supabase → Project Settings → Database → **Reset database password**. Uygulama bu şifreyi kullanmaz, sıfırlamak siteyi etkilemez.
3. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `SUPABASE_DB_URL`
   - Secret: kopyalanan adres

### 3. İlk yedeği elle tetikle

GitHub → **Actions → Gece Yedeği → Run workflow**. Koşu yeşil biterse sayfanın altında `orbit-yedek-…` adlı ek görünür.

## Felakette geri yükleme

Prova 2026-10-07'de yerelde yapıldı. Sayılar birebir tuttu, kurum kodu sayacı korundu ve giriş çalıştı.

**Yapı göçlerden, veri yedekten gelir.** Yedeğin `schema.sql` dosyası, kullanıcı hesabı tablolarına (`auth.users`, `auth.audit_log_entries`) eklediğimiz üç tetikleyiciyi **taşımaz**. Yalnız ondan kurulan sistem açılır, ama yeni kullanıcıya profil açmaz. Bu açığı prova buldu. `schema.sql` yalnız başvuru için saklanıyor.

1. **Yedeği indir:** GitHub → Actions → Gece Yedeği → istenen gecenin koşusu → ek. GitHub eki zip içinde verir; zip'ten `.tar.gz.gpg` dosyasını çıkar.
2. **Boş hedef hazırla:** yeni bir Supabase projesi ya da yerel `supabase start`.
3. **Göçleri uygula:** `supabase link --project-ref <yeni-ref>`, ardından `supabase db push`. Yerelde `supabase db reset` yeterli, ama tohum verisini (seed) de ekler; o durumda 4. adımda `GERI_YUKLE_UZERINE_YAZ=evet` gerekir.
4. **Veriyi yükle:**
   ```bash
   HEDEF_DB_URL='postgresql://…' bash ops/yedek/geri-yukle.sh \
     orbit-yedek-YYYYMMDD-HHMM.tar.gz.gpg  ORBIT-yedek-GIZLI-anahtar.asc
   ```
   - Betik önce bütünlüğü denetler.
   - Hedefte kurum varsa durur; dolu bir veritabanının üzerine yanlışlıkla yazılmaz.
   - Yükleme tek işlemdir: ya hepsi yüklenir ya hiçbiri.
   - Bilgisayarda `psql` yoksa Docker'daki `psql`'i kullanır.

### Geri yüklemeden sonra

- Yeni projeyse `PLATFORM_SETTINGS.md` §3'teki panel ayarları ve `ALLOWED_ORIGINS` sırrı yeniden kurulur. Vercel'deki `VITE_SUPABASE_URL` ve `vercel.json` CSP satırı yeni adrese çevrilir.
- Dört rolle giriş denenir.

## Anahtarı yenilemek

1. Eski gizli anahtarı şifre yöneticisinde **tut**. Eski yedekler hâlâ onunla açılır, 90 gün boyunca.
2. `ops/yedek/yedek-acik-anahtar.asc` dosyasını sil, `anahtar-uret.sh`'i yeniden çalıştır ve yeni açık anahtarı bir PR'la repoya koy.

## Bilinen sınırlar

- **Günde bir yedek.** Kötü günde en fazla bir günlük veri kaybolur. Saniyesi saniyesine dönüş (PITR) Supabase Pro ister.
- **Yedeğin tek kopyası GitHub'da.** GitHub hesabı kaybedilirse yedekler de gider. İkinci bir kopya (ör. ayda bir bilgisayara indirmek) elle yapılır.
- **Hata bildirimi:** gece görevi başarısız olursa GitHub, görevi son değiştirene e-posta atar.
