import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center gradient-card border-order-green/30">
          <CheckCircle className="w-16 h-16 text-order-green mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Uygulama Yüklendi! 🎉
          </h1>
          <p className="text-muted-foreground mb-6">
            ORDER Multisig uygulaması başarıyla cihazınıza yüklendi.
          </p>
          <Button
            onClick={() => navigate('/')}
            className="w-full"
          >
            Ana Sayfaya Dön
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img 
            src="https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw"
            alt="ORDER"
            className="w-20 h-20 mx-auto mb-4 animate-pulse-slow"
          />
          <h1 className="text-3xl font-bold text-order-green mb-2">
            ORDER Multisig'i Yükle
          </h1>
          <p className="text-muted-foreground">
            Ana ekranınıza ekleyin ve offline çalıştırın
          </p>
        </div>

        <Card className="p-6 gradient-card border-primary/30 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <Smartphone className="w-8 h-8 text-order-green flex-shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Neden Yüklemeliyim?
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-order-green flex-shrink-0 mt-0.5" />
                  <span>Ana ekranınızdan tek dokunuşla erişim</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-order-green flex-shrink-0 mt-0.5" />
                  <span>Offline çalışma - internet bağlantısı olmadan bile kullanılabilir</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-order-green flex-shrink-0 mt-0.5" />
                  <span>Daha hızlı yükleme ve daha iyi performans</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-order-green flex-shrink-0 mt-0.5" />
                  <span>Tam ekran deneyimi - tarayıcı çubuğu yok</span>
                </li>
              </ul>
            </div>
          </div>

          {deferredPrompt && !isIOS && (
            <Button
              onClick={handleInstallClick}
              className="w-full"
              size="lg"
            >
              <Download className="w-5 h-5 mr-2" />
              Şimdi Yükle
            </Button>
          )}

          {isIOS && (
            <div className="space-y-4">
              <div className="p-4 bg-corporate-blue/10 rounded-lg border border-corporate-blue/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-corporate-blue flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground mb-2">iOS Yükleme Talimatları:</p>
                    <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
                      <li>Safari'de bu sayfayı açın</li>
                      <li>Alttaki paylaş düğmesine (📤) dokunun</li>
                      <li>"Ana Ekrana Ekle" seçeneğini seçin</li>
                      <li>"Ekle" düğmesine dokunun</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!deferredPrompt && !isIOS && (
            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground">
                Uygulamayı yüklemek için tarayıcınızın menüsünden "Ana ekrana ekle" veya "Yükle" seçeneğini kullanabilirsiniz.
              </p>
            </div>
          )}
        </Card>

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
          >
            Şimdi Değil
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Install;
