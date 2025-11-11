import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';

const STRATEGIES = [
  {
    name: 'BOĞA STRATEJİSİ',
    condition: '4h mAcrss buy ise %75 BTC.b %25 AVAX',
    budget: '100K $',
  },
  {
    name: 'BEAR Stratejisi',
    condition: '4h mAcrss Sel ise USDC,GHO,DAI.e,PYUSD',
    budget: '100K $',
  },
  {
    name: 'Boğa Long Pozisyon',
    condition: "4h mAcrss buy ise 1h mAcrss'da Long Position AVAX",
    budget: '10x ile 10K pozisyon alınır GMX Custom app ile. // Stop Market Sistemi ile yapılacak.',
  },
  {
    name: 'Boğa Short Pozisyon',
    condition: "4h mAcrss Sel ise 1h mAcrss'da Short Position AVAX",
    budget: '10x ile 10k pozisyon alınır GMX Custom app ile. // Stop Market Sistemi ile yapılacak.',
  },
];

const SYSTEM_RULES = [
  {
    title: 'Sistem Çalışma Mantığı',
    description:
      "ORDER'IN AÇIK ARZI MARKET DEĞERİDİR , MULTİSİG'DE O DEĞER KADAR STABİL COİN BULUNUR , 4hMacrss'a göre WAVAX-USDC Trade edilerek MarketCap değişir.",
  },
  {
    title: 'AVAX-USDC veya BTC.b Trade',
    description:
      "Multisig'deki AVAX-USDC veya BTC.b Order'in açık arzının Market değerinin üzerindeyse farklarla satın alım yapılır.",
  },
  {
    title: 'Order Satışı',
    description:
      "100k USDC var ve Piyasa AVAX yukan diyor ; USDC > AVAX'a çevrilir ve beklenir ta ki 4hmacrss Sell derse. veya 4h sell'der 15'uk'lıkda usdc'de durursun veya 4hbuy der 15'uk'lıkda yukan pozisyon arasın. Sell sonrası Order GERÇEK market değeri kaç ise Multisig'deki FARK'lar takas edilir PEYDER PEY çünkü fiyat değişir vs.",
  },
];

const STRATEGY_OUTCOME = [
  'EĞER MULTİSİG DEĞERİ MARKET CAP\'E YETİŞEMİYORSA - SATIŞ YAPILARAK MULTİSİG\'IN VARLIKLARINI YAKINLAŞTIRILIR.',
  'SATIŞ YAPILARAK GELEN DEĞER İSE YİNE MULTİSİG VARLIĞINDA KALIR ANCAK MARKETCAP\'E YAKIN OLACAK ŞEKİLDE MAKS SATILIR.',
];

export const StrategyTable = () => {
  const [currentSection, setCurrentSection] = useState<'strategies' | 'rules' | 'outcome'>('strategies');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSection((prev) => {
        if (prev === 'strategies') {
          setCurrentIndex((prevIndex) => {
            if (prevIndex < STRATEGIES.length - 1) {
              return prevIndex + 1;
            } else {
              return 0;
            }
          });
          if (currentIndex === STRATEGIES.length - 1) {
            setCurrentIndex(0);
            return 'rules';
          }
          return prev;
        } else if (prev === 'rules') {
          setCurrentIndex((prevIndex) => {
            if (prevIndex < SYSTEM_RULES.length - 1) {
              return prevIndex + 1;
            } else {
              return 0;
            }
          });
          if (currentIndex === SYSTEM_RULES.length - 1) {
            setCurrentIndex(0);
            return 'outcome';
          }
          return prev;
        } else {
          setCurrentIndex((prevIndex) => {
            if (prevIndex < STRATEGY_OUTCOME.length - 1) {
              return prevIndex + 1;
            } else {
              return 0;
            }
          });
          if (currentIndex === STRATEGY_OUTCOME.length - 1) {
            setCurrentIndex(0);
            return 'strategies';
          }
          return prev;
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex]);

  return (
    <Card className="p-4 gradient-card border-primary/30">
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-5 h-5 text-order-green animate-pulse-slow" />
        <h2 className="text-sm font-bold text-foreground">Stratejiler</h2>
      </div>

      <div className="space-y-2">
        {/* Strategies */}
        {currentSection === 'strategies' && (
          <div className="animate-slide-in-right">
            <div className="p-2 bg-muted/20 rounded border border-border/30 hover:border-primary/50 transition-all">
              <div className="flex items-center gap-1 mb-1">
                {STRATEGIES[currentIndex].name.includes('BOĞA') || STRATEGIES[currentIndex].name.includes('Boğa') ? (
                  <TrendingUp className="w-3 h-3 text-order-green" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive" />
                )}
                <h4 className="font-bold text-xs text-foreground">{STRATEGIES[currentIndex].name}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{STRATEGIES[currentIndex].condition}</p>
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-xs text-muted-foreground">Bütçe</span>
                <span className="text-xs font-bold text-order-green">{STRATEGIES[currentIndex].budget}</span>
              </div>
            </div>
            <div className="text-center mt-2 text-xs text-muted-foreground">
              Strateji {currentIndex + 1}/{STRATEGIES.length}
            </div>
          </div>
        )}

        {/* System Rules */}
        {currentSection === 'rules' && (
          <div className="animate-slide-in-right">
            <h3 className="text-xs font-bold text-corporate-blue mb-1">Nasıl Çalışır?</h3>
            <div className="p-1.5 bg-corporate-blue/10 rounded border border-corporate-blue/30">
              <h4 className="font-semibold text-xs text-corporate-blue mb-0.5">{SYSTEM_RULES[currentIndex].title}</h4>
              <p className="text-xs text-muted-foreground">{SYSTEM_RULES[currentIndex].description}</p>
            </div>
            <div className="text-center mt-2 text-xs text-muted-foreground">
              Kural {currentIndex + 1}/{SYSTEM_RULES.length}
            </div>
          </div>
        )}

        {/* Strategy Outcome */}
        {currentSection === 'outcome' && (
          <div className="animate-slide-in-right">
            <h3 className="text-xs font-bold text-order-green mb-1">Alınan Arzın Akıbeti</h3>
            <div className="p-1.5 bg-order-green/10 rounded border border-order-green/30 flex items-start gap-1.5">
              <div className="w-4 h-4 rounded-full bg-order-green/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-order-green">{currentIndex + 1}</span>
              </div>
              <p className="text-xs text-foreground">{STRATEGY_OUTCOME[currentIndex]}</p>
            </div>
            <div className="text-center mt-2 text-xs text-muted-foreground">
              Sonuç {currentIndex + 1}/{STRATEGY_OUTCOME.length}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
