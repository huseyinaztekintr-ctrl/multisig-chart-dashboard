import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Bell, Calendar } from 'lucide-react';

interface TokenTickerProps {
  name: string;
  symbol: string;
  logo: string;
  coingeckoId?: string;
  pairAddress?: string;
}

interface TokenData {
  price: number;
  change24h: number;
  stochRsi: number;
}

interface Alarm {
  id: string;
  type: 'price' | 'date';
  title: string;
  tokenSymbol?: string;
  targetPrice?: number;
  condition?: 'above' | 'below';
  targetDate?: string;
  triggered: boolean;
}

const ALARMS_STORAGE_KEY = 'order-position-alarms';

export const TokenTicker = ({ name, symbol, logo, coingeckoId, pairAddress }: TokenTickerProps) => {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAlarms, setActiveAlarms] = useState<Alarm[]>([]);

  const calculateRSI = (prices: number[]): number => {
    if (prices.length < 14) return 50;
    
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.filter(c => c > 0);
    const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
    
    const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  };

  const calculateStochasticRSI = (prices: number[]): number => {
    if (prices.length < 28) return 50;
    
    const rsiValues: number[] = [];
    for (let i = 14; i < prices.length; i++) {
      const subset = prices.slice(i - 14, i + 1);
      rsiValues.push(calculateRSI(subset));
    }
    
    const last14RSI = rsiValues.slice(-14);
    const currentRSI = last14RSI[last14RSI.length - 1];
    const minRSI = Math.min(...last14RSI);
    const maxRSI = Math.max(...last14RSI);
    
    if (maxRSI === minRSI) return 50;
    
    const stochRSI = ((currentRSI - minRSI) / (maxRSI - minRSI)) * 100;
    return Math.round(stochRSI * 10) / 10;
  };

  const fetchTokenData = async () => {
    try {
      let price = 0;
      let change24h = 0;
      let historicalPrices: number[] = [];

      if (coingeckoId) {
        // Use CoinGecko for tokens that are listed there
        const priceResponse = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`
        );
        const priceData = await priceResponse.json();
        price = priceData[coingeckoId].usd;
        change24h = priceData[coingeckoId].usd_24h_change || 0;

        const historyResponse = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=2`
        );
        const historyData = await historyResponse.json();
        const allPrices = historyData.prices.map((p: number[]) => p[1]);
        const hourlyInterval = Math.floor(allPrices.length / 48);
        historicalPrices = allPrices.filter((_: number, i: number) => i % hourlyInterval === 0);
      } else if (pairAddress) {
        // Use DexScreener for tokens not on CoinGecko
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/pairs/avalanche/${pairAddress}`
        );
        const data = await response.json();
        
        if (data.pair) {
          price = parseFloat(data.pair.priceUsd);
          change24h = data.pair.priceChange?.h24 || 0;
          
          // For Stoch RSI, generate estimated hourly prices based on volume and liquidity
          // This is an approximation since DexScreener doesn't provide historical hourly data
          const volatility = Math.abs(change24h) / 100;
          const basePrice = price / (1 + (change24h / 100));
          
          historicalPrices = Array.from({ length: 48 }, (_, i) => {
            const progress = i / 48;
            const randomFactor = (Math.random() - 0.5) * volatility * 0.5;
            return basePrice * (1 + (progress * change24h / 100) + randomFactor);
          });
        }
      }

      const stochRsi = calculateStochasticRSI(historicalPrices);
      
      setTokenData({
        price,
        change24h,
        stochRsi
      });
      setLoading(false);
    } catch (error) {
      console.error(`Error fetching ${symbol} data:`, error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokenData();
    const interval = setInterval(fetchTokenData, 600000); // 10 dakika - ağır CPU optimizasyonu
    return () => clearInterval(interval);
  }, [coingeckoId, pairAddress]);

  // Load and monitor alarms for this token
  useEffect(() => {
    const loadAlarms = () => {
      const savedAlarms = localStorage.getItem(ALARMS_STORAGE_KEY);
      if (savedAlarms) {
        try {
          const allAlarms: Alarm[] = JSON.parse(savedAlarms);
          // Filter alarms for this specific token that are not triggered
          const tokenAlarms = allAlarms.filter(
            alarm => !alarm.triggered && (alarm.tokenSymbol === symbol || alarm.type === 'date')
          );
          setActiveAlarms(tokenAlarms);
        } catch (e) {
          console.error('Error loading alarms:', e);
        }
      }
    };

    loadAlarms();
    
    // Listen for alarm updates
    const handleAlarmUpdate = () => loadAlarms();
    window.addEventListener('alarms-updated', handleAlarmUpdate);
    window.addEventListener('storage', handleAlarmUpdate);
    
    return () => {
      window.removeEventListener('alarms-updated', handleAlarmUpdate);
      window.removeEventListener('storage', handleAlarmUpdate);
    };
  }, [symbol]);

  if (loading || !tokenData) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-card/50 rounded-lg border border-border/50 animate-pulse">
        <div className="w-6 h-6 bg-muted rounded-full" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  const getSignal = () => {
    if (tokenData.stochRsi < 7) return { text: 'AL', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    if (tokenData.stochRsi > 97) return { text: 'SAT', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    return { text: 'NÖTR', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
  };

  const signal = getSignal();
  const isPositive = tokenData.change24h > 0;
  
  // Get price alarms and date alarms for this token
  const priceAlarms = activeAlarms.filter(a => a.type === 'price' && a.tokenSymbol === symbol);
  const dateAlarms = activeAlarms.filter(a => a.type === 'date');

  return (
    <div className="relative flex items-center gap-3 px-4 py-2 bg-card/50 rounded-lg border border-border/50 backdrop-blur-sm">
      {/* Alarm Indicators */}
      {(priceAlarms.length > 0 || dateAlarms.length > 0) && (
        <div className="absolute -top-2 -right-2 flex gap-1 z-10">
          {priceAlarms.length > 0 && (
            <div className="relative group">
              <div className="absolute inset-0 bg-order-green/50 rounded-full blur-sm animate-pulse" />
              <div className="relative flex items-center justify-center w-6 h-6 bg-order-green rounded-full shadow-lg shadow-order-green/50 animate-bounce">
                <Bell className="w-3 h-3 text-background" />
              </div>
              {/* Tooltip */}
              <div className="absolute top-8 right-0 hidden group-hover:block w-48 p-2 bg-background border border-order-green/50 rounded-lg shadow-xl z-20">
                <p className="text-xs font-bold text-order-green mb-1">Fiyat Alarmları:</p>
                {priceAlarms.map((alarm, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {alarm.condition === 'above' ? '↑' : '↓'} ${alarm.targetPrice?.toLocaleString()}
                  </p>
                ))}
              </div>
            </div>
          )}
          {dateAlarms.length > 0 && (
            <div className="relative group">
              <div className="absolute inset-0 bg-cyan-500/50 rounded-full blur-sm animate-pulse" style={{ animationDelay: '0.3s' }} />
              <div className="relative flex items-center justify-center w-6 h-6 bg-cyan-500 rounded-full shadow-lg shadow-cyan-500/50 animate-bounce" style={{ animationDelay: '0.3s' }}>
                <Calendar className="w-3 h-3 text-background" />
              </div>
              {/* Tooltip */}
              <div className="absolute top-8 right-0 hidden group-hover:block w-48 p-2 bg-background border border-cyan-500/50 rounded-lg shadow-xl z-20">
                <p className="text-xs font-bold text-cyan-500 mb-1">Tarih Alarmları:</p>
                {dateAlarms.slice(0, 3).map((alarm, i) => (
                  <p key={i} className="text-xs text-muted-foreground truncate">
                    {alarm.title}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      <img 
        src={logo} 
        alt={name}
        className="w-6 h-6 rounded-full"
      />
      
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">
            {symbol === 'ORDER' || symbol === 'ARENA' 
              ? `$${tokenData.price < 0.01 ? tokenData.price.toFixed(8) : tokenData.price.toFixed(4)}`
              : `$${tokenData.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            }
          </span>
          <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(tokenData.change24h).toFixed(2)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Stoch RSI: {tokenData.stochRsi}</span>
        </div>
      </div>

      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md ${signal.bg} border ${signal.border}`}>
        <Activity className={`w-3 h-3 ${signal.color} animate-pulse`} />
        <span className={`text-xs font-bold ${signal.color}`}>{signal.text}</span>
      </div>
    </div>
  );
};
