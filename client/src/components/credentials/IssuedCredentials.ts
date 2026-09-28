/**
 * Kullanıcıya veya kuruma üretilen giriş bilgisi (tarafsız tip).
 *
 * Geçici şifre hiçbir yere kaydedilmez; yalnızca bir kez üretilip ekranda
 * gösterilir. Bu tip hem platform operatörünün kurum kurma / şifre sıfırlama
 * akışında hem de kurum yöneticisinin üye şifresi sıfırlama akışında ortak
 * kullanılır.
 */
export type IssuedCredentials = {
  loginNumber: string;
  temporaryPassword: string;
  /** Sunucu alanı yoksa eski yanıtlarla uyumluluk için undefined kalır. */
  passwordLockSet?: boolean;
  /** Denetim servisi alanı eklenene kadar undefined kalabilir. */
  auditWritten?: boolean;
  /**
   * Açılan hesabın üyelik kimliği — hesabı öğrenci ya da veli kaydına bağlamak
   * için ("Yeni öğrenci" akışı). Eski sunucu yanıtında ve tekrarlanan istekte
   * yok; o durumda bağlama elle yapılır.
   */
  membershipId?: string;
};

/**
 * Demo modunda ekranda gösterilen sahte geçici şifre — **sabit, rastgele değil.**
 *
 * Önceden burada `"demo-" + Math.random().toString(36)...` yazıyordu ve CodeQL
 * bunu iki ayrı dosyada `js/insecure-randomness` (**high**) olarak işaretledi.
 * Uyarı teknik olarak doğruydu: `Math.random()` kriptografik değildir ve değer
 * `temporaryPassword` alanına akıyordu. Pratikte sömürülebilir değildi — demo
 * dalının koşulu üretim paketinde sabit `false` (`__ORBIT_DEMO_MODE__`, #144).
 *
 * Yine de rastgeleliği susturmak yerine **kaldırdık**, çünkü:
 *
 *   1. Uyarıyı "false positive" diye kapatmak, sonraki denetimde aynı yolun
 *      baştan yürünmesi demekti; kaynağı silmek o soruyu kalıcı olarak bitirir.
 *   2. Rastgeleliğin **hiçbir faydası yoktu.** Değer ekrana basılıp atılıyor,
 *      hiçbir yere kaydedilmiyor ve hiçbir şeyin kimliğini doğrulamıyor.
 *      Sabit olması satış sunumunu öngörülebilir de yapıyor.
 *
 * ⚠️ Bunu tekrar rastgele yapmayın. Gerçek şifre **sunucuda** üretiliyor —
 * `supabase/functions/_shared/temporaryPassword.ts`, `crypto.getRandomValues`
 * ve modulo sapmasına karşı reddetme yöntemiyle. İstemci hiçbir zaman şifre
 * üretmez.
 */
export const DEMO_TEMPORARY_PASSWORD = "demo-gecici-sifre";
