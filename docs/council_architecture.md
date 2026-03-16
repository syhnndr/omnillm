# OmniLLM Council: Mimari ve İyileştirme Yol Haritası

Bu doküman, mevcut OmniLLM projesinin statik çoklu-LLM yapısından, Karpathy'nin "LLM Council" projesinden ilham alan ancak daha dinamik ve tartışma odaklı bir "Moderatörlü Konsey" yapısına geçişi için alınan kararları içerir.

## 1. Temel Vizyon

Uygulamanın statik "Soru -> 3 Cevap" yapısınından, uzmanların (farklı sistem promptlu LLM'lerin) birbirlerini görerek tartıştığı ve bir **Moderatör** eşliğinde fikir birliğine vardığı canlı bir "Akıl Oyunları" platformuna dönüşmesi.

## 2. Mimari Bileşenler

### A. Moderatör (Playmaker) Mantığı: Zorunlu ve Müstakil

- **Zorunluluk:** Her konsey oturumu için bir moderatör seçimi zorunludur. Bu, tartışmanın her zaman bir sonuca (konsensüs) bağlanmasını garanti eder.
- **Ayrı Kimlik (Senaryo A):** Moderatör, oturumdaki uzmanlardan (Analist, Tasarımcı vb.) tamamen bağımsız, ayrı bir LLM "koltuğu" olarak atanır. Bu sayede uzmanlar kendi rollerine odaklanırken, moderatör tarafsız bir şekilde tartışmayı yönetir ve sentezler.
- **İşleyiş:** Sistem, moderatör olarak seçilen modele otomatik olarak sabit bir **"Master Moderator Prompt"** enjekte eder.

### B. Paylaşılan ve Kimlikli Geçmiş (Identity-Aware Shared History)

- **Mevcut Sorun:** LLM'ler geçmişi sadece `assistant` olarak görüyor, kimin ne dediğini ayırt edemiyordu.
- **Karar:** Her mesajın başına bir kimlik etiketi (`[Rol: Analist]: "Cevap..."`) eklenerek, modellerin birbirlerine atıfta bulunabilmesi (inter-agent reference) sağlanacak.

### C. Dinamik Tur ve Yakınsama Kontrolü (Convergence)

- **Dinamik Tur:** Her uzman için sınırlı sayıda konuşma hakkı tanımlanacak (örn: 2 tur). Kullanıcı yeni bir girdi verirse sayaç o konu özelinde sıfırlanacak/güncellenecek.
- **Yakınsama:** Moderatör, her turun sonunda tarafların ortak bir noktada buluşup buluşmadığını denetleyecek. Eğer uzlaşma varsa tartışma erken bitirilecek.

## 3. Akış ve Süreç Kararları

### Kullanıcı Müdahalesi (Human-in-the-Loop)

- Kullanıcı istediği anda tartışmaya dahil olup yeni bir veri/fikir girdiğinde, uzmanlar doğrudan kullanıcıya cevap vermek yerine, bu yeni veriyi **kendi aralarındaki tartışmaya yeni bir girdi** olarak kabul edecekler.
- Kullanıcı, "Tamam, özetleyin" diyerek tartışmayı her an karara bağlatabilecek (Moderatör aracılığıyla).

### Canlı Tartışma Deneyimi (Debate UI)

- Gelen cevaplar topluca değil, her uzman konuştukça **sırayla ve canlı (streaming)** olarak ekrana yansıtılacak.
- UI, kart yapısından ziyade bir "Grup Sohbeti" (Timeline) akışına evrilecek.

## 4. Teknik/Backend Stratejisi

- **Paralellikten Sıralılığa:** Backend'deki paralel çağrı yapısı yerini bir "Konsey Döngüsü"ne (Sequential Orchestrator) bırakacak.
- **Modülerlik:** Her oturumda seçilen dinamik LLM listesi, Moderatör tarafından çalışma anında (runtime) bir tartışma ağacına dönüştürülecek.

---

_Not: Bu doküman, gelecekteki backend ve frontend geliştirmeleri için ana referans kaynağıdır._
