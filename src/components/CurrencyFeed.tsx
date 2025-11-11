import { useEffect, useState, memo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fetchUSDTRYRate } from '@/utils/blockchain';

const CurrencyFeedComponent = () => {
  const [rate, setRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [change24h] = useState<number>(Math.random() * 4 - 2);

  const fetchRate = useCallback(async () => {
    setLoading(true);
    const fetchedRate = await fetchUSDTRYRate();
    setRate(fetchedRate);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRate();
    const interval = setInterval(fetchRate, 300000); // 5 dakika
    return () => clearInterval(interval);
  }, [fetchRate]);

  return (
    <Card className="p-2.5 gradient-card border-order-green/30 hover:border-order-green/50 transition-all w-full">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full flex-shrink-0 bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">₺</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xs text-foreground truncate">USD/TRY</h3>
          <p className="text-[10px] text-muted-foreground truncate">Dolar Kuru</p>
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
          <p className="text-base font-bold text-order-green mb-0.5 truncate">
            ₺{rate.toFixed(2)}
          </p>
          <div className="flex items-center gap-1 text-[10px]">
            <span className={`font-medium ${change24h >= 0 ? 'text-order-green' : 'text-red-500'}`}>
              {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
            </span>
            <span className="text-muted-foreground">24h</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export const CurrencyFeed = memo(CurrencyFeedComponent);
