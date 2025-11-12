// Exchange rates utility for currency conversion
interface ExchangeRates {
  USD_TRY: number;
  lastUpdated: number;
}

let cachedRates: ExchangeRates | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchExchangeRates = async (): Promise<number> => {
  try {
    // Check cache first
    if (cachedRates && Date.now() - cachedRates.lastUpdated < CACHE_DURATION) {
      return cachedRates.USD_TRY;
    }

    // Free exchange rate API - no key required
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    
    if (!response.ok) {
      throw new Error('Exchange rate fetch failed');
    }
    
    const data = await response.json();
    const usdToTry = data.rates.TRY;
    
    // Cache the result
    cachedRates = {
      USD_TRY: usdToTry,
      lastUpdated: Date.now()
    };
    
    return usdToTry;
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    // Fallback rate if API fails
    return 34.25; // Approximate USD/TRY rate as fallback
  }
};

export const formatCurrency = (amount: number, currency: 'USD' | 'TRY') => {
  if (currency === 'TRY') {
    return `₺${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
};