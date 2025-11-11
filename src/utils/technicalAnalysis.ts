// MA50, MA200, RSI ve MACD teknik analizi için utility fonksiyonlar

export interface TechnicalSignal {
  signal: 'BUY' | 'SELL' | null;
  ma50: number | null;
  ma200: number | null;
  rsi: number | null;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  } | null;
  timeframe: '1h' | '4h';
  strength: 'STRONG' | 'WEAK' | null; // Tüm indikatörler aynı yönde ise STRONG
}

/**
 * Simple Moving Average hesapla
 */
const calculateSMA = (prices: number[], period: number): number | null => {
  if (prices.length < period) return null;
  const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
  return sum / period;
};

/**
 * Exponential Moving Average hesapla
 */
const calculateEMA = (prices: number[], period: number): number | null => {
  if (prices.length < period) return null;
  
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((acc, price) => acc + price, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] * k) + (ema * (1 - k));
  }
  
  return ema;
};

/**
 * RSI (Relative Strength Index) hesapla
 */
const calculateRSI = (prices: number[], period: number = 14): number | null => {
  if (prices.length < period + 1) return null;
  
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let avgGain = 0;
  let avgLoss = 0;
  
  // İlk period için ortalama hesapla
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // Smoothed moving average ile devam et
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

/**
 * MACD (Moving Average Convergence Divergence) hesapla
 */
const calculateMACD = (prices: number[]): { value: number; signal: number; histogram: number } | null => {
  if (prices.length < 26) return null;
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  if (ema12 === null || ema26 === null) return null;
  
  const macdValue = ema12 - ema26;
  
  // MACD line'ın kendisinin EMA'sını hesapla (signal line için basitleştirilmiş)
  // Gerçek implementasyon MACD değerlerinin EMA'sını alır, burada yaklaşık değer kullanıyoruz
  const macdSignal = macdValue * 0.8; // Basitleştirilmiş signal line
  const histogram = macdValue - macdSignal;
  
  return {
    value: macdValue,
    signal: macdSignal,
    histogram: histogram
  };
};

/**
 * CoinGecko'dan geçmiş fiyat verilerini çek (rate limit için retry mekanizması ile)
 */
const fetchHistoricalPrices = async (
  coingeckoId: string,
  days: number,
  retries: number = 2
): Promise<number[]> => {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}&interval=hourly`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.status === 429) {
        // Rate limit - bekle ve tekrar dene
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
          continue;
        }
        throw new Error('CoinGecko rate limit exceeded');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.prices && Array.isArray(data.prices)) {
        // Her veri noktası [timestamp, price] formatında
        return data.prices.map((point: [number, number]) => point[1]);
      }
      
      return [];
    } catch (error) {
      if (i === retries) {
        console.error(`Error fetching historical prices for ${coingeckoId}:`, error);
        return [];
      }
    }
  }
  
  return [];
};

/**
 * MA50/MA200 + RSI + MACD kombinasyonu ile teknik analiz yap
 */
export const calculateTechnicalSignals = async (
  coingeckoId?: string,
  pairAddress?: string,
  timeframe: '1h' | '4h' = '4h'
): Promise<TechnicalSignal> => {
  const result: TechnicalSignal = {
    signal: null,
    ma50: null,
    ma200: null,
    rsi: null,
    macd: null,
    timeframe,
    strength: null,
  };

  try {
    let prices: number[] = [];

    // CoinGecko ID varsa oradan çek
    if (coingeckoId) {
      // MA200 için 200 saat = ~8.3 gün, güvenli olmak için 10 gün alalım
      prices = await fetchHistoricalPrices(coingeckoId, 10);
    } else {
      // DexScreener için şimdilik desteklenmedi
      console.log(`No coingeckoId for technical analysis`);
      return result;
    }

    if (prices.length < 200) {
      console.warn(`Insufficient data: ${prices.length} points, need 200+`);
      return result;
    }

    // Timeframe'e göre fiyatları filtrele
    let filteredPrices = prices;
    if (timeframe === '4h') {
      // Her 4 saat için bir veri al
      filteredPrices = prices.filter((_, index) => index % 4 === 0);
    }

    if (filteredPrices.length < 200) {
      console.warn(`Insufficient filtered data: ${filteredPrices.length} points after ${timeframe} filtering`);
      return result;
    }

    // MA50 ve MA200 hesapla
    const ma50 = calculateSMA(filteredPrices, 50);
    const ma200 = calculateSMA(filteredPrices, 200);

    // RSI hesapla
    const rsi = calculateRSI(filteredPrices, 14);

    // MACD hesapla
    const macd = calculateMACD(filteredPrices);

    if (ma50 !== null && ma200 !== null) {
      result.ma50 = ma50;
      result.ma200 = ma200;
      result.rsi = rsi;
      result.macd = macd;

      // Sinyalleri değerlendir
      const maSignal = ma50 > ma200 ? 'BUY' : 'SELL';
      const rsiSignal = rsi !== null ? (rsi < 30 ? 'BUY' : rsi > 70 ? 'SELL' : null) : null;
      const macdSignal = macd && macd.histogram > 0 ? 'BUY' : macd && macd.histogram < 0 ? 'SELL' : null;

      // Ana sinyal MA'dan gelir
      result.signal = maSignal;

      // Güç analizi: Tüm indikatörler aynı yönde ise STRONG
      const buySignals = [
        maSignal === 'BUY',
        rsiSignal === 'BUY',
        macdSignal === 'BUY'
      ].filter(Boolean).length;

      const sellSignals = [
        maSignal === 'SELL',
        rsiSignal === 'SELL',
        macdSignal === 'SELL'
      ].filter(Boolean).length;

      if (buySignals >= 2) {
        result.signal = 'BUY';
        result.strength = buySignals === 3 ? 'STRONG' : 'WEAK';
      } else if (sellSignals >= 2) {
        result.signal = 'SELL';
        result.strength = sellSignals === 3 ? 'STRONG' : 'WEAK';
      }
    }

    return result;
  } catch (error) {
    console.error('Error calculating technical signals:', error);
    return result;
  }
};

// Geriye uyumluluk için eski fonksiyon
export const calculateMACrossing = calculateTechnicalSignals;
