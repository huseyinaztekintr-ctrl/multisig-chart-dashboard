import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Percent, Plus, X, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect, memo } from 'react';
import { fetchDexScreenerPrice, fetchDexScreenerPriceByToken } from '@/utils/blockchain';

interface ManualTokenEntry {
  id: string;
  tokenSymbol: string;
  amount: number;
  apy: number;
  note?: string;
  createdAt: number;
  enabled: boolean;
}

const MANUAL_TOKENS_STORAGE_KEY = 'manual-aave-tokens';
const MULTISIG_VALUE_STORAGE_KEY = 'multisig-total-value';
const TRY_RATE_STORAGE_KEY = 'try-exchange-rate';
const MULTISIG_AUTO_ENABLED_KEY = 'multisig-auto-enabled';

// CoinGecko price fetching
const fetchCoinGeckoPrice = async (symbol: string): Promise<number> => {
  try {
    const coinGeckoIds: Record<string, string> = {
      'BTC.b': 'bitcoin',
      'WBTC.e': 'wrapped-bitcoin',
      'USDC': 'usd-coin',
      'USDC.e': 'usd-coin',
      'USDT': 'tether',
      'USDT.e': 'tether',
      'DAI': 'dai',
      'DAI.e': 'dai',
      'GHO': 'gho',
      'WAVAX': 'avalanche-2',
      'AVAX': 'avalanche-2',
    };
    
    const coinId = coinGeckoIds[symbol];
    if (!coinId) return 0;
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    const data = await response.json();
    return data[coinId]?.usd || 0;
  } catch (error) {
    console.error(`Error fetching CoinGecko price for ${symbol}:`, error);
    return 0;
  }
};

// Check if token is a stablecoin
const isStablecoin = (symbol: string): boolean => {
  const stablecoins = ['USDC', 'USDC.e', 'USDT', 'USDT.e', 'DAI', 'DAI.e', 'GHO', 'FRAX', 'BUSD'];
  return stablecoins.includes(symbol);
};

const DEFAULT_LENDING_POSITIONS: ManualTokenEntry[] = [
  {
    id: 'default-arena-staking',
    tokenSymbol: 'ARENA',
    amount: 2000000,
    apy: 20,
    note: 'The Arena Staking',
    createdAt: Date.now(),
    enabled: true,
  },
];

const AAVEYieldCalculatorComponent = () => {
  const [manualTokens, setManualTokens] = useState<ManualTokenEntry[]>(() => {
    const saved = localStorage.getItem(MANUAL_TOKENS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure all entries have enabled property (for backward compatibility)
      return parsed.map((entry: any) => ({
        ...entry,
        enabled: entry.enabled !== undefined ? entry.enabled : true
      }));
    }
    return DEFAULT_LENDING_POSITIONS;
  });
  
  const [newManualToken, setNewManualToken] = useState('');
  const [newManualAmount, setNewManualAmount] = useState('');
  const [newManualApy, setNewManualApy] = useState('');
  const [newManualNote, setNewManualNote] = useState('');
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [multisigTotalValue, setMultisigTotalValue] = useState(0);
  const [tryRate, setTryRate] = useState(34.5);
  const [isOpen, setIsOpen] = useState(false);
  const [multisigAutoEnabled, setMultisigAutoEnabled] = useState(() => {
    const saved = localStorage.getItem(MULTISIG_AUTO_ENABLED_KEY);
    return saved === null ? true : saved === 'true';
  });

  const getEnabledTokens = () => {
    const tokensData = localStorage.getItem('multisig-tokens');
    if (!tokensData) return [];
    const allTokens = JSON.parse(tokensData);
    const enabledTokens = allTokens.filter((token: any) => token.enabled);
    // Add TRY
    return [
      ...enabledTokens,
      {
        symbol: 'TRY',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Flag_of_Turkey.svg/32px-Flag_of_Turkey.svg.png',
        enabled: true,
      }
    ];
  };

  // Read multisig value and TRY rate from localStorage
  useEffect(() => {
    const updateValues = () => {
      const savedMultisigValue = localStorage.getItem(MULTISIG_VALUE_STORAGE_KEY);
      const savedTryRate = localStorage.getItem(TRY_RATE_STORAGE_KEY);
      
      if (savedMultisigValue) {
        setMultisigTotalValue(parseFloat(savedMultisigValue));
      }
      if (savedTryRate) {
        setTryRate(parseFloat(savedTryRate));
      }
    };

    updateValues();
    
    // Listen for updates from ComparativeAnalysis
    const handleUpdate = () => updateValues();
    window.addEventListener('comparative-analysis-updated', handleUpdate);
    
    return () => window.removeEventListener('comparative-analysis-updated', handleUpdate);
  }, []);

  // Fetch prices for manual tokens
  useEffect(() => {
    const fetchPrices = async () => {
      const tokens = getEnabledTokens();
      const prices: Record<string, number> = {};
      
      for (const entry of manualTokens) {
        const token = tokens.find((t: any) => t.symbol === entry.tokenSymbol);
        let price = 0;
        
        // Try DexScreener first
        if (token) {
          const priceData = token.isTokenAddress 
            ? await fetchDexScreenerPriceByToken(token.pairAddress)
            : await fetchDexScreenerPrice(token.pairAddress);
          price = priceData.price;
        }
        
        // Fallback to CoinGecko if DexScreener fails
        if (price === 0) {
          price = await fetchCoinGeckoPrice(entry.tokenSymbol);
        }
        
        // Fallback to $1 for known stablecoins
        if (price === 0 && isStablecoin(entry.tokenSymbol)) {
          price = 1.0;
        }
        
        if (price > 0) {
          prices[entry.tokenSymbol] = price;
        } else {
          console.warn(`Could not fetch price for ${entry.tokenSymbol}`);
        }
      }
      
      setTokenPrices(prices);
    };

    if (manualTokens.length > 0) {
      fetchPrices();
      const interval = setInterval(fetchPrices, 180000); // Every 3 minutes
      return () => clearInterval(interval);
    }
  }, [manualTokens]);

  const addManualToken = () => {
    if (!newManualToken || !newManualAmount || parseFloat(newManualAmount) <= 0 || !newManualApy || parseFloat(newManualApy) <= 0) return;
    
    const newEntry: ManualTokenEntry = {
      id: `${newManualToken}-${Date.now()}`,
      tokenSymbol: newManualToken,
      amount: parseFloat(newManualAmount),
      apy: parseFloat(newManualApy),
      note: newManualNote || undefined,
      createdAt: Date.now(),
      enabled: true,
    };
    
    const updatedTokens = [...manualTokens, newEntry];
    setManualTokens(updatedTokens);
    localStorage.setItem(MANUAL_TOKENS_STORAGE_KEY, JSON.stringify(updatedTokens));
    
    setNewManualToken('');
    setNewManualAmount('');
    setNewManualApy('');
    setNewManualNote('');
    
    window.dispatchEvent(new CustomEvent('manual-tokens-updated'));
  };

  const toggleManualToken = (id: string) => {
    const updatedTokens = manualTokens.map(t => 
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    setManualTokens(updatedTokens);
    localStorage.setItem(MANUAL_TOKENS_STORAGE_KEY, JSON.stringify(updatedTokens));
    window.dispatchEvent(new CustomEvent('manual-tokens-updated'));
  };

  const toggleMultisigAuto = () => {
    const newValue = !multisigAutoEnabled;
    setMultisigAutoEnabled(newValue);
    localStorage.setItem(MULTISIG_AUTO_ENABLED_KEY, newValue.toString());
  };

  const deleteManualToken = (id: string) => {
    const updatedTokens = manualTokens.filter(t => t.id !== id);
    setManualTokens(updatedTokens);
    localStorage.setItem(MANUAL_TOKENS_STORAGE_KEY, JSON.stringify(updatedTokens));
    window.dispatchEvent(new CustomEvent('manual-tokens-updated'));
  };

  const calculateManualTokenValue = (entry: ManualTokenEntry): number => {
    // USD is already in USD
    if (entry.tokenSymbol === 'USD') {
      return entry.amount;
    }
    // TRY uses tryRate
    if (entry.tokenSymbol === 'TRY') {
      return entry.amount / tryRate;
    }
    const price = tokenPrices[entry.tokenSymbol] || 0;
    return entry.amount * price;
  };

  // Create automatic multisig position entry
  const multisigAutoEntry: ManualTokenEntry = {
    id: 'multisig-auto',
    tokenSymbol: 'USD',
    amount: multisigTotalValue,
    apy: 5.0,
    note: 'Multisig toplamı (otomatik)',
    createdAt: 0,
    enabled: multisigAutoEnabled,
  };

  // Combine auto entry with manual tokens
  const allEntries = multisigTotalValue > 0 
    ? [multisigAutoEntry, ...manualTokens]
    : manualTokens;

  // Calculate monthly income per entry
  const calculateMonthlyIncome = (entry: ManualTokenEntry): number => {
    const valueUSD = calculateManualTokenValue(entry);
    return (valueUSD * entry.apy) / 100 / 12;
  };

  // Filter only enabled entries for calculations
  const enabledEntries = allEntries.filter(entry => entry.enabled);

  const totalManualValue = manualTokens
    .filter(entry => entry.enabled)
    .reduce((sum, entry) => sum + calculateManualTokenValue(entry), 0);

  // Calculate total monthly income (only enabled entries)
  const totalMonthlyUSD = enabledEntries.reduce((sum, entry) => 
    sum + calculateMonthlyIncome(entry), 0
  );
  const totalMonthlyTRY = totalMonthlyUSD * tryRate;

  // Calculate total value including auto entry (only enabled)
  const totalValue = enabledEntries.reduce((sum, entry) => 
    sum + calculateManualTokenValue(entry), 0
  );

  // Save manual token value to localStorage for ComparativeAnalysis (exclude auto multisig to avoid double counting)
  useEffect(() => {
    localStorage.setItem('manual-aave-tokens-value', totalManualValue.toString());
    localStorage.setItem('aave-monthly-usd', totalMonthlyUSD.toString());
    localStorage.setItem('aave-monthly-try', totalMonthlyTRY.toString());
  }, [totalManualValue, totalMonthlyUSD, totalMonthlyTRY]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-3 bg-gradient-to-br from-[#B6509E]/10 to-[#2EBAC6]/10 border-[#B6509E] ring-2 ring-[#B6509E] shadow-[0_0_30px_rgba(182,80,158,0.6)] animate-glow-pulse backdrop-blur-sm">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <img 
              src="https://imgproxy-mainnet.routescan.io/xQnAYos0BtnjeFRIaVy3-b2CH_rbX4zu6KKluWxpj8k/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvc21hbGxfQWF2ZV9Ub2tlbl9wbmdfNGU3NmQwNTFiMC5lMTY0YjA0ODE3NTYucG5n" 
              alt="AAVE" 
              className="w-5 h-5"
            />
            <h3 className="font-semibold text-sm text-foreground">Lending Yield Pozition</h3>
            <Percent className="w-4 h-4 text-[#B6509E]" />
            {!isOpen && allEntries.length > 0 && (
              <div className="flex items-center gap-2 ml-auto mr-2">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#2EBAC6]/10 rounded border border-[#2EBAC6]/30">
                  <span className="text-lg font-bold text-[#2EBAC6]">
                    ${totalMonthlyUSD.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#B6509E]/10 rounded border border-[#B6509E]/30">
                  <span className="text-lg font-bold text-[#B6509E]">
                    ₺{totalMonthlyTRY.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}
            <ChevronDown className={`w-4 h-4 text-[#B6509E] ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="space-y-2 mb-3 mt-3">
        {/* Add Manual Token Form */}
        <div className="p-2 bg-background/30 rounded border border-border/30 space-y-2">
          <label className="text-xs text-muted-foreground block">Yeni Lending Pozisyon Ekle</label>
          <div className="grid grid-cols-2 gap-2">
            <Select 
              value={newManualToken} 
              onValueChange={setNewManualToken}
            >
              <SelectTrigger className="h-8 text-xs bg-background/50">
                <SelectValue placeholder="Token seç" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                {getEnabledTokens().map((token: any) => (
                  <SelectItem key={token.symbol} value={token.symbol} className="cursor-pointer hover:bg-accent">
                    <div className="flex items-center gap-2">
                      <img src={token.logo} alt={token.symbol} className="w-4 h-4 rounded-full" />
                      {token.symbol}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.000001"
              value={newManualAmount}
              onChange={(e) => setNewManualAmount(e.target.value)}
              className="h-8 text-xs bg-background/50"
              placeholder="Miktar"
              disabled={!newManualToken}
            />
          </div>
          <Input
            type="number"
            step="0.1"
            value={newManualApy}
            onChange={(e) => setNewManualApy(e.target.value)}
            className="h-8 text-xs bg-background/50"
            placeholder="Yıllık APY (%)"
            disabled={!newManualToken}
          />
          <Input
            type="text"
            value={newManualNote}
            onChange={(e) => setNewManualNote(e.target.value)}
            className="h-8 text-xs bg-background/50"
            placeholder="Not (opsiyonel)"
          />
          <Button
            onClick={addManualToken}
            disabled={!newManualToken || !newManualAmount || parseFloat(newManualAmount) <= 0 || !newManualApy || parseFloat(newManualApy) <= 0}
            className="w-full h-7 text-xs"
            size="sm"
          >
            <Plus className="w-3 h-3 mr-1" />
            Pozisyon Ekle
          </Button>
        </div>

        {/* All Entries List (Auto + Manual) */}
        {allEntries.length > 0 && (
          <div className="space-y-1.5">
            {allEntries.map((entry) => {
              const isAutoEntry = entry.id === 'multisig-auto';
              const token = getEnabledTokens().find((t: any) => t.symbol === entry.tokenSymbol);
              const value = calculateManualTokenValue(entry);
              const monthlyIncome = calculateMonthlyIncome(entry);
              return (
                <div 
                  key={entry.id} 
                  className={`flex items-center justify-between p-2 rounded border group transition-colors ${
                    isAutoEntry 
                      ? 'bg-gradient-to-r from-[#B6509E]/20 to-[#2EBAC6]/20 border-[#B6509E]/50 ring-1 ring-[#B6509E]/30' 
                      : 'bg-background/30 border-border/30 hover:border-[#2EBAC6]/50'
                  } ${!entry.enabled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {token && (
                      <img src={token.logo} alt={entry.tokenSymbol} className="w-4 h-4 rounded-full flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-foreground">
                          {entry.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{entry.tokenSymbol}</span>
                        <span className="text-[10px] text-[#B6509E] font-semibold">@ {entry.apy}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#2EBAC6]">
                          ${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className="text-[10px] font-bold text-[#B6509E]">
                          ${monthlyIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ay
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-[10px] text-muted-foreground italic mt-0.5">{entry.note}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={entry.enabled}
                      onCheckedChange={() => isAutoEntry ? toggleMultisigAuto() : toggleManualToken(entry.id)}
                      className="h-4 w-8 data-[state=checked]:bg-[#2EBAC6]"
                    />
                    {!isAutoEntry && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteManualToken(entry.id)}
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Total Summary */}
            <div className="p-2 bg-gradient-to-r from-[#2EBAC6]/10 to-[#B6509E]/10 rounded border border-[#2EBAC6]/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Toplam Pozisyon Değeri:</span>
                <span className="text-xs font-bold text-[#2EBAC6]">
                  ${totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-xs font-semibold text-foreground">Toplam Aylık Getiri:</span>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-[#B6509E]">
                    ${totalMonthlyUSD.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-bold text-[#B6509E]">
                    ₺{totalMonthlyTRY.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export const AAVEYieldCalculator = memo(AAVEYieldCalculatorComponent);
