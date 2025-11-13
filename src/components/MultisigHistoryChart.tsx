import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Area } from 'recharts';
import { TrendingUp, Database, BarChart3, Maximize2, Minimize2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getTokenBalance } from '@/utils/blockchain';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getEnabledTokens, MultisigToken } from './TokenManager';
import { useIsMobile } from '@/hooks/use-mobile';

const MULTISIG_ADDRESS = '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634';

const STORAGE_KEY = 'multisig_price_history';
const UPDATE_INTERVAL = 60 * 1000; // 1 dakika

interface TokenPriceData {
  price: number;
  balance: number;
  volume24h: number;
  liquidity: number;
  txns24h: number;
  priceChange24h: number;
}

interface PriceSnapshot {
  timestamp: number;
  tryRate: number;
  tokens: { [symbol: string]: TokenPriceData };
}

interface ChartData {
  date: string;
  timestamp: number;
  valueUsd: number;
  valueTry: number;
  [key: string]: number | string; // Dynamic token values
  volumeTotal?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

// Token color mapping with extended colors
const TOKEN_COLORS: { [key: string]: string } = {
  'WAVAX': '#e84142',
  'BTC.B': '#f7931a',
  'ORDER': '#3b82f6',
  'ARENA': '#7c3aed',
  'USDC': '#2775ca',
  'USDT': '#26a17b',
  'USDT.E': '#26a17b',
  'DAI.E': '#f4b731',
  'GHO': '#9063CD',
  'EURC': '#2b6def',
  'WETH': '#627eea',
  'LINK': '#375bd2',
  'UNI': '#ff007a',
  'AAVE': '#b6509e',
  'COMP': '#00d395',
  'MKR': '#1aab9b',
  'SNX': '#5fcfe4',
  'YFI': '#006ae3',
  'SUSHI': '#0e2d52',
  'CRV': '#40649c',
  'BAL': '#1e1e1e',
  'FRAX': '#000000',
  'FXS': '#f7931a',
  'CVX': '#ff6900',
  'SPELL': '#7c4dff',
  'MIM': '#9c27b0',
  'AVAX': '#e84142',
  'PNG': '#ff6b35',
  'JOE': '#4285f4',
  'QI': '#7b1fa2',
  'XAVA': '#ff5722',
  'COL': '#2196f3',
  'TIME': '#9c27b0',
  'KET': '#ff9800',
  'WBTC': '#f2a900',
  'ETH': '#627eea',
};

// Color palette for dynamic assignment
const DYNAMIC_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd',
  '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9', '#f8c471', '#82e0aa',
  '#f1948a', '#85929e', '#a569bd', '#5dade2', '#58d68d', '#f4d03f',
  '#ec7063', '#af7ac5', '#5499c7', '#52be80', '#f39c12', '#e74c3c',
  '#9b59b6', '#3498db', '#1abc9c', '#f1c40f', '#e67e22', '#95a5a6'
];

// Function to get color for token
const getTokenColor = (symbol: string, index: number = 0): string => {
  return TOKEN_COLORS[symbol.toUpperCase()] || DYNAMIC_COLORS[index % DYNAMIC_COLORS.length];
};

export const MultisigHistoryChart = () => {
  const isMobile = useIsMobile();
  const [rawHistory, setRawHistory] = useState<PriceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTokens, setActiveTokens] = useState<MultisigToken[]>([]);
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(new Set());
  const [dominantAsset, setDominantAsset] = useState<string>('usd');
  const [performanceComparison, setPerformanceComparison] = useState<{[key: string]: number}>({});
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [showVolume, setShowVolume] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load active tokens from TokenManager
  useEffect(() => {
    const loadTokens = () => {
      const enabledTokens = getEnabledTokens().filter(token => token.pairAddress);
      setActiveTokens(enabledTokens);
      
      // Set initial visible metrics to first 4 tokens
      const initialVisible = new Set(enabledTokens.slice(0, 4).map(t => t.symbol.toUpperCase()));
      setVisibleMetrics(initialVisible);
    };

    loadTokens();

    // Listen for token updates
    const handleTokenUpdate = () => loadTokens();
    window.addEventListener('tokens-updated', handleTokenUpdate);

    return () => {
      window.removeEventListener('tokens-updated', handleTokenUpdate);
    };
  }, []);

  // LocalStorage'dan geçmiş verileri oku
  const loadHistory = (): PriceSnapshot[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const data = JSON.parse(stored);
      // Filter out old format data - only keep new format with tokens object
      return Array.isArray(data) ? data.filter(snapshot => snapshot && snapshot.tokens) : [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  };

  // LocalStorage'a yeni snapshot kaydet
  const saveSnapshot = (snapshot: PriceSnapshot) => {
    try {
      const history = loadHistory();
      history.push(snapshot);
      // Son 1 yıllık veriyi tut
      const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
      const filtered = history.filter(s => s.timestamp > oneYearAgo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error saving snapshot:', error);
    }
  };

  // Yeni snapshot al ve kaydet
  const captureSnapshot = async () => {
    try {
      if (activeTokens.length === 0) return null;

      const tokens: { [symbol: string]: TokenPriceData } = {};
      
      // Fetch all token data in parallel
      await Promise.all(activeTokens.map(async (token) => {
        try {
          const balance = await getTokenBalance(token.address, MULTISIG_ADDRESS);
          
          // Fetch price data from DexScreener
          const priceResponse = await fetch(`https://api.dexscreener.com/latest/dex/pairs/avalanche/${token.pairAddress}`);
          const priceData = await priceResponse.json();
          
          const price = parseFloat(priceData.pair?.priceUsd || '0');
          const volume24h = parseFloat(priceData.pair?.volume?.h24 || '0');
          const liquidity = parseFloat(priceData.pair?.liquidity?.usd || '0');
          const txns24h = (priceData.pair?.txns?.h24?.buys || 0) + (priceData.pair?.txns?.h24?.sells || 0);
          const priceChange24h = parseFloat(priceData.pair?.priceChange?.h24 || '0');
          
          tokens[token.symbol.toUpperCase()] = {
            price,
            balance,
            volume24h,
            liquidity,
            txns24h,
            priceChange24h,
          };
        } catch (error) {
          console.error(`Error fetching data for ${token.symbol}:`, error);
        }
      }));

      // Get TRY exchange rate
      let tryRate = 34.5;
      try {
        const tryResponse = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        const tryData = await tryResponse.json();
        tryRate = tryData.usd?.try || 34.5;
      } catch (error) {
        console.error('Error fetching TRY rate:', error);
      }

      const snapshot: PriceSnapshot = {
        timestamp: Date.now(),
        tryRate,
        tokens,
      };

      saveSnapshot(snapshot);
      return snapshot;
    } catch (error) {
      console.error('Error capturing snapshot:', error);
      return null;
    }
  };

  useEffect(() => {
    if (activeTokens.length === 0) return;

    const loadAndUpdateData = async () => {
      setLoading(true);
      
      try {
        // Check if we have new tokens that don't exist in history
        let history = loadHistory();
        const lastSnapshot = history[history.length - 1];
        
        if (lastSnapshot && lastSnapshot.tokens) {
          const existingTokenSymbols = new Set(Object.keys(lastSnapshot.tokens));
          const currentTokenSymbols = new Set(activeTokens.map(t => t.symbol.toUpperCase()));
          
          // If there are new tokens or removed tokens, clear history and start fresh
          const hasNewTokens = [...currentTokenSymbols].some(symbol => !existingTokenSymbols.has(symbol));
          const hasRemovedTokens = [...existingTokenSymbols].some(symbol => !currentTokenSymbols.has(symbol));
          
          if (hasNewTokens || hasRemovedTokens) {
            console.log('Token değişiklikleri tespit edildi, chart history temizleniyor ve yeniden başlatılıyor...');
            localStorage.removeItem(STORAGE_KEY);
            setRawHistory([]);
            history = [];
          }
        }

        const now = Date.now();
        
        if (history.length === 0 || !lastSnapshot || (now - lastSnapshot.timestamp) > UPDATE_INTERVAL) {
          const newSnapshot = await captureSnapshot();
          if (newSnapshot) {
            history = loadHistory();
          }
        }

        if (history.length === 0) {
          setRawHistory([]);
          setLoading(false);
          return;
        }

        setRawHistory(history);

        // Performance calculations
        const currentSnapshot = history[history.length - 1];
        const firstSnapshot = history[0];
        
        if (currentSnapshot && firstSnapshot && currentSnapshot.tokens && firstSnapshot.tokens) {
          // Calculate total USD values
          const firstTotalUsd = Object.entries(firstSnapshot.tokens).reduce((sum, [_, data]) => {
            return sum + (data.balance * data.price);
          }, 0);

          const lastTotalUsd = Object.entries(currentSnapshot.tokens).reduce((sum, [_, data]) => {
            return sum + (data.balance * data.price);
          }, 0);

          // Calculate baselines for each token
          const baselines: { [key: string]: number } = {};
          Object.keys(firstSnapshot.tokens).forEach(symbol => {
            const tokenPrice = firstSnapshot.tokens[symbol].price;
            if (tokenPrice > 0) {
              baselines[symbol] = firstTotalUsd / tokenPrice;
            }
          });

          // Calculate asset values
          const lastAssetValues: { [key: string]: number } = { usd: lastTotalUsd };
          Object.keys(currentSnapshot.tokens).forEach(symbol => {
            if (baselines[symbol]) {
              lastAssetValues[symbol] = baselines[symbol] * currentSnapshot.tokens[symbol].price;
            }
          });

          // Find dominant asset
          let maxValue = 0;
          let dominant = 'usd';
          Object.entries(lastAssetValues).forEach(([key, value]) => {
            if (key !== 'usd' && value > maxValue) {
              maxValue = value;
              dominant = key;
            }
          });
          setDominantAsset(dominant);

          // Calculate performance
          const performance: {[key: string]: number} = {
            usd: firstTotalUsd > 0 ? ((lastTotalUsd - firstTotalUsd) / firstTotalUsd) * 100 : 0,
          };

          Object.keys(lastAssetValues).forEach(key => {
            if (key !== 'usd' && firstTotalUsd > 0) {
              performance[key] = ((lastAssetValues[key] - firstTotalUsd) / firstTotalUsd) * 100;
            }
          });

          setPerformanceComparison(performance);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
      
      setLoading(false);
    };
    
    loadAndUpdateData();

    const interval = setInterval(() => {
      captureSnapshot().then(() => {
        loadAndUpdateData();
      });
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [activeTokens]);

  // Memoized chart data calculation
  const chartData = useMemo(() => {
    if (rawHistory.length === 0 || activeTokens.length === 0) return [];
    
    const firstSnapshot = rawHistory[0];
    if (!firstSnapshot || !firstSnapshot.tokens) return [];
    
    // Calculate first total USD value
    const firstTotalUsd = Object.entries(firstSnapshot.tokens).reduce((sum, [_, data]) => {
      return sum + (data.balance * data.price);
    }, 0);
    
    if (firstTotalUsd === 0) return [];
    
    // Calculate baselines for each token
    const baselines: { [key: string]: number } = {};
    Object.keys(firstSnapshot.tokens).forEach(symbol => {
      const tokenPrice = firstSnapshot.tokens[symbol].price;
      if (tokenPrice > 0) {
        baselines[symbol] = firstTotalUsd / tokenPrice;
      }
    });
    
    const data: ChartData[] = rawHistory.map((snapshot, index) => {
      if (!snapshot || !snapshot.tokens) {
        return {
          date: '',
          timestamp: 0,
          valueUsd: 1,
          valueTry: 1,
          volumeTotal: 0,
          open: 1,
          high: 1,
          low: 1,
          close: 1,
        };
      }
      
      const totalValueUsd = Object.entries(snapshot.tokens).reduce((sum, [_, data]) => {
        return sum + (data.balance * data.price);
      }, 0);
      
      const totalVolume = Object.values(snapshot.tokens).reduce((sum, data) => {
        return sum + (data.volume24h || 0);
      }, 0);
      
      const prevSnapshot = index > 0 ? rawHistory[index - 1] : snapshot;
      const prevValue = index > 0 ? Object.entries(prevSnapshot.tokens).reduce((sum, [_, data]) => {
        return sum + (data.balance * data.price);
      }, 0) : totalValueUsd;
      
      const avgChange = Object.values(snapshot.tokens).reduce((sum, data) => {
        return sum + (data.priceChange24h || 0);
      }, 0) / Object.keys(snapshot.tokens).length;
      
      const open = prevValue;
      const close = totalValueUsd;
      const high = Math.max(open, close) * (1 + Math.abs(avgChange) / 200);
      const low = Math.min(open, close) * (1 - Math.abs(avgChange) / 200);
      
      const chartPoint: ChartData = {
        date: new Date(snapshot.timestamp).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
        timestamp: snapshot.timestamp,
        valueUsd: totalValueUsd,
        valueTry: totalValueUsd * snapshot.tryRate,
        volumeTotal: totalVolume,
        open,
        high,
        low,
        close,
      };

      // Add dynamic token values
      Object.keys(snapshot.tokens).forEach(symbol => {
        if (baselines[symbol]) {
          chartPoint[`value${symbol}`] = baselines[symbol] * snapshot.tokens[symbol].price;
          chartPoint[`${symbol}Volume`] = snapshot.tokens[symbol].volume24h || 0;
        }
      });
      
      return chartPoint;
    });
    
    // Normalize to first point
    const firstPoint = data[0];
    return data.map(point => {
      const normalized: ChartData = {
        ...point,
        valueUsd: point.valueUsd / firstPoint.valueUsd,
        valueTry: point.valueTry / firstPoint.valueTry,
        open: (point.open || 0) / firstPoint.valueUsd,
        high: (point.high || 0) / firstPoint.valueUsd,
        low: (point.low || 0) / firstPoint.valueUsd,
        close: (point.close || 0) / firstPoint.valueUsd,
      };

      // Normalize token values
      activeTokens.forEach(token => {
        const key = `value${token.symbol.toUpperCase()}`;
        if (point[key] && firstPoint[key]) {
          normalized[key] = (point[key] as number) / (firstPoint[key] as number);
        }
      });

      return normalized;
    });
  }, [rawHistory, activeTokens]);

  const toggleMetric = useCallback((metric: string) => {
    setVisibleMetrics(prev => {
      const newMetrics = new Set(prev);
      if (newMetrics.has(metric)) {
        if (newMetrics.size > 1) {
          newMetrics.delete(metric);
        }
      } else {
        newMetrics.add(metric);
      }
      return newMetrics;
    });
  }, []);

  if (loading) {
    return (
      <Card className="p-5 gradient-card border-corporate-blue/30 glow-blue">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-6 h-6 text-corporate-blue" />
          <h3 className="text-lg font-bold text-foreground">Multisig Toplam - Geçmiş</h3>
        </div>
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="p-5 gradient-card border-corporate-blue/30 glow-blue">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-6 h-6 text-corporate-blue animate-pulse" />
          <h3 className="text-lg font-bold text-foreground">Multisig Toplam - Geçmiş</h3>
        </div>
        <div className="h-[400px] flex flex-col items-center justify-center gap-3">
          <Database className="w-12 h-12 text-corporate-blue/50 animate-pulse" />
          <div className="text-center">
            <p className="text-foreground font-medium mb-1">Veri Toplanıyor...</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Fiyat geçmişi tarayıcınızda kaydediliyor. Her 1 dakikada bir otomatik güncelleme yapılacak.
              Zaman içinde grafik oluşacak.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const minDataPoints = 2;
  if (chartData.length < minDataPoints) {
    return (
      <Card className="p-5 gradient-card border-corporate-blue/30 glow-blue">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-6 h-6 text-corporate-blue animate-pulse" />
          <h3 className="text-lg font-bold text-foreground">Multisig Toplam - Geçmiş</h3>
        </div>
        <div className="h-[400px] flex flex-col items-center justify-center gap-3">
          <Database className="w-12 h-12 text-corporate-blue/50 animate-pulse" />
          <div className="text-center">
            <p className="text-foreground font-medium mb-1">
              Veri Toplanıyor... ({rawHistory.length}/{minDataPoints} kayıt)
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              Grafik oluşturmak için en az {minDataPoints} veri noktası gerekiyor. 
              Lütfen daha sonra tekrar kontrol edin.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const renderChartContent = () => (
    <>
      <div className="w-full">
        <div className="flex gap-2 flex-wrap mb-2">
          {activeTokens.map((token, index) => {
            const symbol = token.symbol.toUpperCase();
            const perf = performanceComparison[symbol] || 0;
            const color = getTokenColor(symbol, index);
            
            return (
              <button
                key={symbol}
                onClick={() => toggleMetric(symbol)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  visibleMetrics.has(symbol)
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                } ${dominantAsset === symbol ? 'ring-4 shadow-lg scale-110' : ''}`}
                style={visibleMetrics.has(symbol) ? { 
                  backgroundColor: color,
                  boxShadow: dominantAsset === symbol ? `0 0 20px ${color}60` : undefined
                } : {}}
              >
                <img 
                  src={token.logo} 
                  alt={symbol} 
                  className="w-4 h-4 rounded-full"
                />
                {symbol} {perf !== undefined && (
                  <span className={`text-sm font-bold ${perf >= 0 ? 'text-white' : 'opacity-70'}`}>
                    {perf >= 0 ? '+' : ''}{perf.toFixed(1)}%
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => toggleMetric('try')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
              visibleMetrics.has('try')
                ? 'bg-[#e30a17] text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            } ${dominantAsset === 'try' ? 'ring-4 ring-[#e30a17] shadow-[0_0_20px_rgba(227,10,23,0.6)] scale-110' : ''}`}
          >
            <span className="font-bold">₺</span>
            TRY {performanceComparison.try !== undefined && (
              <span className={`text-sm font-bold ${performanceComparison.try >= 0 ? 'text-white' : 'text-red-900'}`}>
                {performanceComparison.try >= 0 ? '+' : ''}{performanceComparison.try.toFixed(1)}%
              </span>
            )}
          </button>
        </div>
        
        {/* Chart Type ve Volume Controls - Mobile Optimized */}
        <div className={`flex gap-2 flex-wrap items-center border-t border-border/30 pt-2 mt-2 ${isMobile ? 'justify-center' : ''}`}>
          {!isMobile && <span className="text-xs text-muted-foreground mr-1">Grafik Tipi:</span>}
          <button
            onClick={() => setChartType('line')}
            className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
              chartType === 'line'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            {isMobile ? '' : 'Çizgi'}
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
              chartType === 'area'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            {isMobile ? '' : 'Alan'}
          </button>
          
          <div className="h-4 w-px bg-border mx-1"></div>
          
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
              showVolume
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Database className="w-3 h-3" />
            {isMobile ? (showVolume ? '✓' : '') : `Hacim ${showVolume ? '✓' : ''}`}
          </button>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            interval="preserveStartEnd"
            minTickGap={30}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            scale="log"
            domain={['auto', 'auto']}
            allowDataOverflow={false}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(value) => {
              const percentChange = (value - 1) * 100;
              return `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(0)}%`;
            }}
          />
          {showVolume && (
            <YAxis 
              yAxisId="volume"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              scale="log"
              domain={[0.1, 'auto']}
              tickFormatter={(value) => {
                if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                return `$${value.toFixed(0)}`;
              }}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              padding: '12px',
              minWidth: '250px',
            }}
            content={({ active, payload }: any) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-background/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-lg">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">{data.date}</p>
                    
                    <div className="mb-3 pb-2 border-b border-border/50">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase">Performans</p>
                      {payload.filter((entry: any) => entry.dataKey.startsWith('value')).map((entry: any) => {
                        const value = entry.value;
                        const changePercent = ((value - 1) * 100).toFixed(2);
                        const isPositive = parseFloat(changePercent) >= 0;
                        
                        return (
                          <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                              <span className="text-xs font-medium">{entry.name}</span>
                            </div>
                            <span className={`text-xs font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                              {isPositive ? '↑' : '↓'} {Math.abs(parseFloat(changePercent))}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {showVolume && (data.volumeTotal > 0) && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase">24s Hacim (USD)</p>
                        {activeTokens.map((token, index) => {
                          const symbol = token.symbol.toUpperCase();
                          const volume = data[`${symbol}Volume`];
                          if (!volume || volume <= 0) return null;
                          
                          return (
                            <div key={symbol} className="flex items-center justify-between gap-3 mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getTokenColor(symbol, index) }} />
                                <span className="text-xs">{symbol}</span>
                              </div>
                              <span className="text-xs font-semibold">${volume.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t border-border/30">
                          <span className="text-xs font-bold">Toplam</span>
                          <span className="text-xs font-bold text-primary">${data.volumeTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          
          {/* Volume Bars */}
          {showVolume && activeTokens.map((token, index) => {
            const symbol = token.symbol.toUpperCase();
            return (
              <Bar
                key={`${symbol}-volume`}
                yAxisId="volume"
                dataKey={`${symbol}Volume`}
                name={`${symbol} Hacim`}
                fill={getTokenColor(symbol, index)}
                fillOpacity={0.7}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            );
          })}
          
          {/* Token Lines/Areas */}
          {activeTokens.map((token, index) => {
            const symbol = token.symbol.toUpperCase();
            if (!visibleMetrics.has(symbol)) return null;
            
            const color = getTokenColor(symbol, index);
            const dataKey = `value${symbol}`;
            
            if (chartType === 'line') {
              return (
                <Line
                  key={symbol}
                  type="monotone"
                  dataKey={dataKey}
                  name={symbol}
                  stroke={color}
                  strokeWidth={dominantAsset === symbol ? 5 : 2}
                  dot={false}
                  activeDot={{ r: dominantAsset === symbol ? 10 : 6 }}
                  opacity={dominantAsset === symbol ? 1 : 0.7}
                >
                  <LabelList
                    dataKey={dataKey}
                    position="right"
                    content={(props: any) => {
                      const { x, y, index } = props;
                      if (index === chartData.length - 1) {
                        const perf = performanceComparison[symbol] || 0;
                        return (
                          <g>
                            <circle
                              cx={x + 16}
                              cy={y}
                              r="12"
                              fill={color}
                              opacity={dominantAsset === symbol ? 1 : 0.8}
                            />
                            <image
                              x={x + 8}
                              y={y - 8}
                              width="16"
                              height="16"
                              href={token.logo}
                            />
                            <text 
                              x={x + 32} 
                              y={y + 4} 
                              fill={perf >= 0 ? "#22c55e" : "#ef4444"} 
                              fontSize="12" 
                              fontWeight="bold"
                            >
                              {perf >= 0 ? '+' : ''}{perf.toFixed(1)}%
                            </text>
                          </g>
                        );
                      }
                      return null;
                    }}
                  />
                </Line>
              );
            } else {
              return (
                <Area
                  key={symbol}
                  type="monotone"
                  dataKey={dataKey}
                  name={symbol}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.3}
                  strokeWidth={dominantAsset === symbol ? 5 : 2}
                />
              );
            }
          })}
          
          {visibleMetrics.has('try') && (
            <>
              {chartType === 'line' ? (
                <Line
                  type="monotone"
                  dataKey="valueTry"
                  name="TRY (₺)"
                  stroke="#e30a17"
                  strokeWidth={dominantAsset === 'try' ? 5 : 2}
                  dot={false}
                  activeDot={{ r: dominantAsset === 'try' ? 10 : 6 }}
                  opacity={dominantAsset === 'try' ? 1 : 0.7}
                />
              ) : (
                <Area
                  type="monotone"
                  dataKey="valueTry"
                  name="TRY (₺)"
                  stroke="#e30a17"
                  fill="#e30a17"
                  fillOpacity={0.3}
                  strokeWidth={dominantAsset === 'try' ? 5 : 2}
                />
              )}
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        * Her 1 dakikada bir fiyat ve bakiye kayıtları tarayıcınızda saklanıyor
      </p>
    </>
  );

  return (
    <>
      <Card className={`p-3 lg:p-5 gradient-card border-corporate-blue/30 glow-blue relative h-full flex flex-col ${isMobile ? 'mx-2' : ''}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-corporate-blue" />
            <div>
              <h3 className={`font-bold text-foreground ${isMobile ? 'text-base' : 'text-lg'}`}>Multisig Toplam - Geçmiş</h3>
              <p className="text-xs text-muted-foreground">{rawHistory.length} veri noktası</p>
            </div>
          </div>
          
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(true)}
              className="hover:bg-accent"
            >
              <Maximize2 className="w-5 h-5" />
            </Button>
          )}
        </div>
        
        {renderChartContent()}
      </Card>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-corporate-blue" />
              <div>
                <h3 className="text-lg font-bold text-foreground">Multisig Toplam - Geçmiş</h3>
                <p className="text-xs text-muted-foreground">{rawHistory.length} veri noktası</p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="hover:bg-accent"
            >
              <Minimize2 className="w-5 h-5" />
            </Button>
          </div>
          
          {renderChartContent()}
        </DialogContent>
      </Dialog>
    </>
  );
};
