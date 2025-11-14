import { useEffect, useState, memo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, StickyNote } from 'lucide-react';
import { fetchDexScreenerPrice, fetchDexScreenerPriceByToken } from '@/utils/blockchain';
import { TradingNoteDialog } from './TradingNoteDialog';
import { Badge } from '@/components/ui/badge';

interface PriceFeedProps {
  name: string;
  symbol: string;
  pairAddress: string;
  logo: string;
  isTokenAddress?: boolean;
}

const PriceFeedComponent = ({ name, symbol, pairAddress, logo, isTokenAddress = false }: PriceFeedProps) => {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [change24h, setChange24h] = useState<number>(0);
  const [showDialog, setShowDialog] = useState(false);
  const [hasNotes, setHasNotes] = useState(false);

  const fetchPrice = useCallback(async () => {
    setLoading(true);
    const data = isTokenAddress 
      ? await fetchDexScreenerPriceByToken(pairAddress)
      : await fetchDexScreenerPrice(pairAddress);
    setPrice(data.price);
    setChange24h(data.change24h);
    setLoading(false);
  }, [pairAddress, isTokenAddress]);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 180000); // 3 minutes (CPU optimizasyonu için)
    return () => clearInterval(interval);
  }, [fetchPrice]);

  const checkNotes = useCallback(() => {
    const notes = localStorage.getItem(`trading-notes-${symbol}`);
    const alarms = localStorage.getItem(`trading-alarms-${symbol}`);
    setHasNotes(!!(notes || alarms));
  }, [symbol]);

  useEffect(() => {
    checkNotes();
    
    const handleStorageChange = () => checkNotes();
    window.addEventListener('storage', handleStorageChange);
    
    const handleNotesUpdate = () => checkNotes();
    window.addEventListener(`notes-updated-${symbol}`, handleNotesUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(`notes-updated-${symbol}`, handleNotesUpdate);
    };
  }, [symbol, checkNotes]);

  // Get last note info with seasonal auto-suggestion
  const getLastNote = () => {
    // Force stablecoins to show SELL
    if (['GHO', 'USDC', 'DAI.e', 'USDT', 'EURC'].includes(symbol)) {
      return { type: 'SELL' as const, content: 'Stablecoin Satış', isManual: false };
    }

    const notes = localStorage.getItem(`trading-notes-${symbol}`);
    if (notes) {
      try {
        const parsed = JSON.parse(notes);
        if (parsed.length > 0) {
          return { ...parsed[parsed.length - 1], isManual: true };
        }
      } catch (e) {
        console.error('Error parsing notes:', e);
      }
    }
    
    // Show seasonal suggestion for non-USD/TRY pairs
    if (symbol !== 'USD/TRY') {
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const day = now.getDate();
      
      // 1 Mart (3/1) - 1 Eylül (9/1): SELL
      // 2 Eylül (9/2) - 14 Şubat (2/14): BUY
      if ((month === 3 && day >= 1) || (month > 3 && month < 9) || (month === 9 && day === 1)) {
        return { type: 'SELL' as const, content: 'Sezonsal Satış', isManual: false };
      } else if ((month === 9 && day >= 2) || month > 9 || month < 2 || (month === 2 && day <= 14)) {
        return { type: 'BUY' as const, content: 'Sezonsal Alış', isManual: false };
      }
    }
    
    return null;
  };

  const lastNote = getLastNote();

  const getCardGlowClass = () => {
    if (!lastNote) return 'border-order-green/60 hover:border-order-green shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)]';
    
    if (lastNote.type === 'BUY' || lastNote.type === 'AL') {
      return 'border-order-green/60 hover:border-order-green shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:shadow-[0_0_25px_rgba(34,197,94,0.6)]';
    } else if (lastNote.type === 'SELL' || lastNote.type === 'SAT') {
      return 'border-red-500/60 hover:border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)]';
    }
    
    return 'border-order-green/60 hover:border-order-green shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)]';
  };

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'BUY':
      case 'AL':
        return 'bg-order-green text-white';
      case 'SELL':
      case 'SAT':
        return 'bg-red-500 text-white';
      case 'HODL':
        return 'bg-blue-500 text-white';
      case 'TARİH':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-muted';
    }
  };

  return (
    <>
      <Card 
        className={`p-2.5 gradient-card ${getCardGlowClass()} transition-all w-full cursor-pointer`}
        onClick={() => setShowDialog(true)}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <img src={logo} alt={symbol} className="w-6 h-6 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-xs text-foreground truncate">{symbol}</h3>
            <p className="text-[10px] text-muted-foreground truncate">
              {lastNote && !lastNote.isManual ? lastNote.content : name}
            </p>
          </div>
          {change24h > 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-order-green flex-shrink-0" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
          )}
        </div>

        {loading ? (
          <div className="space-y-1">
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            <div className="h-2.5 w-12 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-base font-bold text-order-green truncate">
                ${symbol === 'ORDER' 
                  ? price.toFixed(8)
                  : symbol === 'BTC' || symbol === 'ETH'
                  ? price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </p>
              {lastNote && (
                <Badge className={`${getNoteTypeColor(lastNote.type)} text-[10px] px-1.5 py-0 h-auto leading-tight`}>
                  {lastNote.type}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-base">
              <span className={`font-medium ${change24h >= 0 ? 'text-order-green' : 'text-red-500'}`}>
                {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
              </span>
              <span className="text-muted-foreground">24h</span>
            </div>
          </div>
        )}
      </Card>

      <TradingNoteDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        symbol={symbol}
        currentPrice={price}
        pairAddress={pairAddress}
      />
    </>
  );
};

export const PriceFeed = memo(PriceFeedComponent);

