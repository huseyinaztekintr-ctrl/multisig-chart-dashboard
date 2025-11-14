# ORDER Multisig Dashboard - Desktop Uygulaması

Bu proje artık **PC'de kullanabileceğiniz bir desktop uygulaması** olarak çalışacak şekilde dönüştürülmüştür!

## 🚀 Desktop Uygulaması Nasıl Çalıştırılır?

### Hazır Uygulamayı Çalıştırma (Önerilen)

1. **Start-Desktop-App.bat** dosyasına çift tıklayın
2. Uygulama otomatik olarak açılacak
3. Web tarayıcısına ihtiyaç yok - tamamen native desktop uygulaması!

### Manuel Çalıştırma

1. `dist-electron/win-unpacked/` klasörüne gidin
2. `ORDER Multisig Dashboard.exe` dosyasına çift tıklayın

## 🔧 Geliştirme ve Build İşlemleri

### Geliştirme Modunda Çalıştırma

```bash
# Electron desktop uygulamasını geliştirme modunda başlat
npm run electron:dev
```

### Production Build Oluşturma

```bash
# Önce web uygulamasını build et
npm run build

# Sonra Electron uygulamasını build et
npm run electron:dist
```

### Yeni bir Executable Oluşturma

Eğer kod değişiklikleri yapıp yeni bir executable oluşturmak isterseniz:

```bash
npm run electron:dist
```

Bu komut çalıştırıldıktan sonra `dist-electron/win-unpacked/` klasöründe güncellenmiş uygulama hazır olacaktır.

## 📁 Dosya Yapısı

```
├── dist-electron/
│   └── win-unpacked/
│       └── ORDER Multisig Dashboard.exe  # Ana uygulama dosyası
├── Start-Desktop-App.bat                 # Kolay başlatma dosyası
├── electron.js                          # Electron ana process
└── src/                                 # React uygulaması kaynak kodları
```

## ✨ Özellikler

- ✅ **Tamamen Offline Çalışır**: İnternet bağlantısı sadece blockchain işlemleri için gerekli
- ✅ **Native Windows Uygulaması**: Web tarayıcısına ihtiyaç yok
- ✅ **Modern Arayüz**: React + Tailwind CSS ile geliştirilmiş
- ✅ **Güvenli**: Sandboxed Electron environment
- ✅ **Hızlı**: Native performans

## 🔗 Blockchain Bağlantıları

Uygulama aşağıdaki blockchain ağlarına bağlanabilir:
- Avalanche C-Chain
- Ethereum Mainnet
- Diğer EVM uyumlu ağlar

## 📋 Gereksinimler

- Windows 10/11
- İnternet bağlantısı (sadece blockchain işlemleri için)

## 🛠️ Sorun Giderme

### Uygulama Açılmıyor?

1. `Start-Desktop-App.bat` dosyasını administrator olarak çalıştırmayı deneyin
2. Windows Defender veya antivirüs yazılımınızın uygulamayı engellemediğinden emin olun
3. `dist-electron/win-unpacked/ORDER Multisig Dashboard.exe` dosyasının var olduğunu kontrol edin

### Yeni Build Oluşturma Hatası?

```bash
# Dependencies'leri tekrar yükleyin
npm install

# Build'i tekrar deneyin
npm run electron:dist
```

## 📞 Destek

Herhangi bir sorun yaşarsanız, GitHub Issues bölümünde konu açabilirsiniz.

---

**Not**: Bu artık tamamen standalone bir desktop uygulamasıdır. Web sitesine yüklemenize gerek yoktur!