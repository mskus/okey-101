# 🃏 101 Okey Pro - Gelişmiş Skor Takip Uygulaması

Bu proje, karmaşık 101 Okey kurallarını dijital ortamda hatasız ve pratik bir şekilde hesaplamak için tasarlanmış, tamamen tarayıcı üzerinde çalışan (Client-Side) modern bir web uygulamasıdır. 

Kağıt kaleme veya kafa karıştırıcı hesaplamalara gerek kalmadan, masadaki oyuna odaklanmanızı sağlar.

## ✨ Öne Çıkan Özellikler

* **Veri Kaybına Son (State Management):** Uygulama `localStorage` kullanarak her tuş vuruşunda kendini kaydeder. Sayfa yenilense veya tarayıcı kazara kapansa dahi oyun tam olarak kaldığı saniyeden devam eder.
* **Gelişmiş Kural Motoru:** * Normal bitiş, Elden bitiş (x2), Jokerle bitiş (x2) ve Elden+Joker bitiş (x4) çarpanları otomatik hesaplanır.
  * Kendi çifte giden veya biten kişinin çifte gitmesi durumundaki ceza katlamaları sisteme entegredir.
* **Mod Seçeneği:** Bireysel (4 Tekli) veya Eşli (Takım A vs Takım B) oyun modlarını destekler. Eşli modda kazananın takım arkadaşına ceza yazılmaz.
* **Akıllı Ceza Sistemi:** Yanlış açma, işler taş atma gibi durumlar için hızlı "+101" butonları ve manuel eklenebilen/çıkarılabilen özel puan sistemi.
* **Skor Gizleme Modu:** Oyunun heyecanını son ele kadar korumak için toplam skorları tek tuşla sansürleme özelliği.
* **Geçmiş Maç Arşivi:** Bitirilen maçlar sıfırlanmaz, tarih ve sonuç detaylarıyla birlikte "Arşiv" bölümünde listelenir.
* **Mobil Öncelikli (Mobile-First) Tasarım:** Masada telefon veya tablet üzerinden rahatça kullanılabilmesi için büyük dokunmatik alanlar ve akıcı bir UI/UX deneyimi.

## 🛠️ Kullanılan Teknolojiler

Bu proje herhangi bir sunucu (backend) veya veritabanı maliyeti gerektirmeyen "Serverless" bir yapıdadır:
* **HTML5** (Semantik yapı)
* **CSS3** (Responsive tasarım, CSS Variables)
* **Vanilla JavaScript** (DOM manipülasyonu, State yönetimi ve Kural algoritması)

## 🚀 Kurulum ve Çalıştırma

Proje tamamen statik dosyalardan oluştuğu için ekstra bir kuruluma ihtiyaç duymaz. 

1. Dosyaları indirin veya repoyu klonlayın.
2. `index.html` dosyasını herhangi bir modern web tarayıcısında (Chrome, Safari, Edge vb.) açın.
3. Veya projeyi **GitHub Pages**, **Vercel** veya **Netlify** gibi platformlarda saniyeler içinde ücretsiz olarak canlıya alabilirsiniz.

---

### 🤖 Geliştirici Notu (Credits)

Bu projenin mimarisi, matematiksel kural motoru ve tüm HTML, CSS, JavaScript kodlamaları **Şafak Kuş**'un detaylı yönlendirmeleri, oyun kuralı analizleri ve vizyonu doğrultusunda **Google Gemini AI** tarafından sıfırdan yazılmıştır.
