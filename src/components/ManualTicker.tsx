import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Check, X, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { calculateTechnicalSignals, type TechnicalSignal } from "@/utils/technicalAnalysis";

interface ManualTickerProps {
  symbol: string;
  name: string;
  logo: string;
  coingeckoId?: string;
  pairAddress?: string;
}

export const ManualTicker = ({ symbol, name, logo, coingeckoId, pairAddress }: ManualTickerProps) => {
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [manualNote, setManualNote] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [technicalSignal1h, setTechnicalSignal1h] = useState<TechnicalSignal | null>(null);
  const [technicalSignal4h, setTechnicalSignal4h] = useState<TechnicalSignal | null>(null);
  const { toast } = useToast();

  // Load manual note from localStorage
  useEffect(() => {
    const savedNote = localStorage.getItem(`ticker_note_${symbol}`);
    if (savedNote) {
      setManualNote(savedNote);
    }
  }, [symbol]);

  // Fetch price data
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (coingeckoId) {
          // Fetch from CoinGecko
          const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`
          );
          const data = await response.json();
          const coinData = data[coingeckoId];
          
          if (coinData) {
            setPrice(coinData.usd);
            setChange24h(coinData.usd_24h_change);
          }
        } else if (pairAddress) {
          // Fetch from DexScreener
          const response = await fetch(
            `https://api.dexscreener.com/latest/dex/pairs/avalanche/${pairAddress}`
          );
          const data = await response.json();
          
          if (data.pair) {
            setPrice(parseFloat(data.pair.priceUsd));
            setChange24h(data.pair.priceChange?.h24 || null);
          }
        }
      } catch (error) {
        console.error(`Error fetching ${symbol} data:`, error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [symbol, coingeckoId, pairAddress]);

  // Fetch technical analysis signals
  useEffect(() => {
    const fetchTechnicalSignals = async () => {
      // Sadece CoinGecko ID'si olan tokenlar için teknik analiz yap
      if (!coingeckoId) {
        console.log(`${symbol}: No CoinGecko ID, skipping technical analysis`);
        return;
      }

      try {
        console.log(`${symbol}: Fetching technical signals...`);
        
        // 1 saatlik ve 4 saatlik sinyalleri paralel olarak çek
        const [signal1h, signal4h] = await Promise.all([
          calculateTechnicalSignals(coingeckoId, pairAddress, '1h'),
          calculateTechnicalSignals(coingeckoId, pairAddress, '4h'),
        ]);

        console.log(`${symbol} 1h:`, signal1h);
        console.log(`${symbol} 4h:`, signal4h);

        setTechnicalSignal1h(signal1h);
        setTechnicalSignal4h(signal4h);
      } catch (error) {
        console.error(`${symbol}: Error fetching technical signals:`, error);
      }
    };

    fetchTechnicalSignals();
    // Her 10 dakikada bir güncelle (API rate limit nedeniyle)
    const interval = setInterval(fetchTechnicalSignals, 600000);
    
    return () => clearInterval(interval);
  }, [symbol, coingeckoId, pairAddress]);

  const handleSaveNote = () => {
    const trimmedNote = editValue.trim().toUpperCase();
    setManualNote(trimmedNote);
    localStorage.setItem(`ticker_note_${symbol}`, trimmedNote);
    setIsEditing(false);
    setEditValue("");
    
    toast({
      title: "Not kaydedildi",
      description: `${symbol} için "${trimmedNote}" notu kaydedildi.`,
    });
  };

  const handleStartEdit = () => {
    setEditValue(manualNote);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const getNoteColor = (note: string) => {
    const upperNote = note.toUpperCase();
    if (upperNote.includes("AL") || upperNote.includes("BUY")) return "text-green-500";
    if (upperNote.includes("SAT") || upperNote.includes("SELL")) return "text-red-500";
    if (upperNote.includes("TUT") || upperNote.includes("HOLD")) return "text-blue-500";
    if (upperNote.includes("BEKLE") || upperNote.includes("WAIT")) return "text-yellow-500";
    return "text-primary";
  };

  // Otomatik teknik analiz sinyalini göster (manuel not yoksa)
  const getAutoSignal = () => {
    if (manualNote) return null; // Manuel not varsa otomatik sinyali gösterme
    
    // Öncelikle 4h sinyaline bak (daha önemli timeframe)
    if (technicalSignal4h?.signal) {
      return {
        signal: technicalSignal4h.signal,
        strength: technicalSignal4h.strength,
        timeframe: '4h' as const,
        rsi: technicalSignal4h.rsi,
        details: technicalSignal4h
      };
    }
    
    // 4h yoksa 1h'e bak
    if (technicalSignal1h?.signal) {
      return {
        signal: technicalSignal1h.signal,
        strength: technicalSignal1h.strength,
        timeframe: '1h' as const,
        rsi: technicalSignal1h.rsi,
        details: technicalSignal1h
      };
    }
    
    return null;
  };

  const autoSignal = getAutoSignal();

  // Tooltip metni oluştur
  const getTooltipText = () => {
    if (!autoSignal) return '';
    
    const { details, timeframe } = autoSignal;
    let text = `📊 Teknik Analiz (${timeframe})\n\n`;
    
    if (details.ma50 && details.ma200) {
      text += `MA50: $${details.ma50.toFixed(6)}\n`;
      text += `MA200: $${details.ma200.toFixed(6)}\n`;
      text += `Trend: ${details.ma50 > details.ma200 ? '📈 Yükseliş' : '📉 Düşüş'}\n\n`;
    }
    
    if (details.rsi !== null) {
      text += `RSI: ${details.rsi.toFixed(1)}\n`;
      text += `Durum: ${details.rsi < 30 ? '🔵 Aşırı Satım' : details.rsi > 70 ? '🔴 Aşırı Alım' : '⚪ Nötr'}\n\n`;
    }
    
    if (details.macd) {
      text += `MACD: ${details.macd.value.toFixed(6)}\n`;
      text += `Momentum: ${details.macd.histogram > 0 ? '📈 Pozitif' : '📉 Negatif'}\n\n`;
    }
    
    text += `Sinyal Gücü: ${details.strength === 'STRONG' ? '💪 Güçlü' : details.strength === 'WEAK' ? '⚡ Zayıf' : '➖ Belirsiz'}`;
    
    return text;
  };

  return (
    <div className="bg-secondary/50 px-4 py-2 rounded-lg border border-border/50 hover:border-primary/50 transition-all group">
      <div className="flex items-center gap-3">
        {/* Logo and Symbol */}
        <div className="flex items-center gap-2">
          <img src={logo} alt={symbol} className="w-6 h-6 rounded-full" />
          <div className="flex flex-col">
            <span className="text-xs font-bold">{symbol}</span>
            {price !== null && (
              <span className="text-[10px] text-muted-foreground">
                ${price < 1 ? price.toFixed(6) : price.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* 24h Change */}
        {change24h !== null && (
          <span className={`text-xs font-medium ${change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
          </span>
        )}

        {/* Manual Note or Edit Mode */}
        <div className="flex items-center gap-2 border-l border-border/50 pl-3 ml-auto">
          {isEditing ? (
            <>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="AL, SAT, TUT, BEKLE..."
                className="w-24 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNote();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <button
                onClick={handleSaveNote}
                className="p-1 hover:bg-green-500/20 rounded transition-colors"
              >
                <Check className="w-3 h-3 text-green-500" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 hover:bg-red-500/20 rounded transition-colors"
              >
                <X className="w-3 h-3 text-red-500" />
              </button>
            </>
          ) : (
            <>
              {manualNote ? (
                <span className={`text-xs font-bold ${getNoteColor(manualNote)}`}>
                  {manualNote}
                </span>
              ) : autoSignal ? (
                <div 
                  className="flex items-center gap-1.5"
                  title={getTooltipText()}
                >
                  <span 
                    className={`text-xs font-bold ${autoSignal.signal === 'BUY' ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {autoSignal.signal}
                  </span>
                  {autoSignal.signal === 'BUY' ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  {autoSignal.strength === 'STRONG' && (
                    <Activity className="w-3 h-3 text-primary animate-pulse" />
                  )}
                  <span className="text-[9px] text-muted-foreground opacity-60">
                    {autoSignal.timeframe}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Not ekle</span>
              )}
              <button
                onClick={handleStartEdit}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-primary/20 rounded transition-all"
              >
                <Edit2 className="w-3 h-3 text-primary" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
