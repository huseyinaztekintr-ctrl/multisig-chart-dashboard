import { useEffect, useState, memo } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, Scale, Percent, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTokenBalance, fetchDexScreenerPrice, fetchDexScreenerPriceByToken } from '@/utils/blockchain';
import { getEnabledAddresses, getManualEntries } from './AddressManager';
import { getEnabledTokens } from './TokenManager';
import { getEnabledWallets } from './WalletManager';
import { getCurrentSelectedToken } from '@/hooks/useSelectedToken';

const MULTISIG_ADDRESS = '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634';

const ComparativeAnalysisComponent = () => {
  const [selectedToken, setSelectedToken] = useState(() => getCurrentSelectedToken());
  const [data, setData] = useState({
    circulatingSupply: 0,
    circulatingValue: 0,
    circulatingValueTry: 0,
    circulatingValueAvax: 0,
    circulatingValueBtc: 0,
    circulatingValueArena: 0,
    circulatingValueOrder: 0,
    multisigTotalValue: 0,
    multisigTotalValueTry: 0,
    multisigTotalValueAvax: 0,
    multisigTotalValueBtc: 0,
    multisigTotalValueArena: 0,
    multisigTotalValueOrder: 0,
    difference: 0,
    differenceTry: 0,
    differenceAvax: 0,
    differenceBtc: 0,
    differenceArena: 0,
    differenceOrder: 0,
    ratio: 0,
    isCirculatingLeading: false,
  });
  const [loading, setLoading] = useState(true);
  const [tryRate, setTryRate] = useState(34.5);
  const [debtTotalValue, setDebtTotalValue] = useState(0);

  // Listen for selected token changes
  useEffect(() => {
    const handleTokenChange = (event: CustomEvent) => {
      setSelectedToken(event.detail);
    };

    window.addEventListener('selected-token-changed', handleTokenChange as EventListener);
    return () => window.removeEventListener('selected-token-changed', handleTokenChange as EventListener);
  }, []);

  useEffect(() => {
    const calculateComparison = async () => {
      // Get enabled addresses from localStorage - token specific
      const enabledAddresses = getEnabledAddresses(selectedToken.symbol);
      
      // Fetch non-circulating balances dynamically
      const balances = await Promise.all(
        enabledAddresses.map(address => getTokenBalance(selectedToken.address, address))
      );

      // Get manual entries - token specific
      const manualEntries = getManualEntries(selectedToken.symbol);
      const manualTotal = manualEntries.reduce((sum, entry) => sum + entry.manualAmount, 0);

      const totalNonCirculating = balances.reduce((sum, bal) => sum + bal, 0) + manualTotal;
      const circulatingSupply = selectedToken.maxSupply - totalNonCirculating;

      // Get prices
      const tokenPriceData = selectedToken.pairAddress 
        ? await fetchDexScreenerPrice(selectedToken.pairAddress)
        : await fetchDexScreenerPriceByToken(selectedToken.address);
      const arenaPriceData = await fetchDexScreenerPrice('0x3c5f68d2f72debba4900c60f32eb8629876401f2');
      const avaxPriceData = await fetchDexScreenerPrice('0x864d4e5ee7318e97483db7eb0912e09f161516ea');
      const tokenPrice = tokenPriceData.price;
      const arenaPrice = arenaPriceData.price;
      const avaxPrice = avaxPriceData.price;
      const btcPrice = 95000; // Mock BTC price
      
      // Get TRY exchange rate
      let currentTryRate = 34.5; // Default fallback
      try {
        const tryResponse = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        const tryData = await tryResponse.json();
        currentTryRate = tryData.usd?.try || 34.5;
        setTryRate(currentTryRate);
      } catch (error) {
        console.error('Error fetching TRY rate:', error);
      }
      
      // Get enabled tokens dynamically
      const enabledTokens = getEnabledTokens();
      const enabledWallets = getEnabledWallets();
      
      const tokenBalances = await Promise.all(
        enabledTokens.map(async (token) => {
          // Sum token balances across all enabled multisig wallets
          const walletBalances = await Promise.all(
            enabledWallets.map((w) => getTokenBalance(token.address, w.address))
          );
          const totalTokenBalance = walletBalances.reduce((sum, bal) => sum + bal, 0);

          let price = 0;
          if (token.pairAddress) {
            const priceData = await fetchDexScreenerPrice(token.pairAddress);
            price = priceData.price;
          } else if (token.symbol === 'USDC' || token.symbol === 'DAI.e' || token.symbol === 'GHO') {
            price = 1;
          } else if (token.symbol === 'BTC.b') {
            price = btcPrice;
          }
          
          return totalTokenBalance * price;
        })
      );

      // Calculate total multisig value in USD from enabled tokens (across all wallets)
      let multisigTotalValue = tokenBalances.reduce((sum, value) => sum + value, 0);
      
      // Add manual AAVE tokens value
      const manualAaveValue = parseFloat(localStorage.getItem('manual-aave-tokens-value') || '0');
      multisigTotalValue += manualAaveValue;

      // Calculate debt total value
      const debtsRaw = localStorage.getItem('debt-balance');
      let debtTotal = 0;
      if (debtsRaw) {
        const debts = JSON.parse(debtsRaw);
        for (const debt of debts) {
          if (debt.token === 'TRY') {
            debtTotal += debt.amount / currentTryRate;
          } else if (debt.token === selectedToken.symbol) {
            debtTotal += debt.amount * tokenPrice;
          } else if (debt.token === 'ARENA') {
            debtTotal += debt.amount * arenaPrice;
          } else if (debt.token === 'AVAX') {
            debtTotal += debt.amount * avaxPrice;
          } else if (debt.token === 'BTC.b') {
            debtTotal += debt.amount * btcPrice;
          } else {
            // Try to find token price from enabled tokens
            const token = enabledTokens.find(t => t.symbol === debt.token);
            if (token) {
              let price = 0;
              if (token.pairAddress) {
                const priceData = await fetchDexScreenerPrice(token.pairAddress);
                price = priceData.price;
              } else if (token.symbol === 'USDC' || token.symbol === 'DAI.e' || token.symbol === 'GHO') {
                price = 1;
              }
              debtTotal += debt.amount * price;
            }
          }
        }
      }
      setDebtTotalValue(debtTotal);

      // Subtract debt from multisig total
      multisigTotalValue -= debtTotal;
      
      const circulatingValue = circulatingSupply * tokenPrice;
      const difference = Math.abs(circulatingValue - multisigTotalValue);
      const isCirculatingLeading = circulatingValue > multisigTotalValue;
      // Calculate ratio using absolute magnitudes so it's always ≥ 1 (larger / smaller)
      const absCirculating = Math.abs(circulatingValue);
      const absMultisig = Math.abs(multisigTotalValue);
      let ratio = 0;
      if (absCirculating > 0 && absMultisig > 0) {
        ratio = absCirculating >= absMultisig 
          ? absCirculating / absMultisig 
          : absMultisig / absCirculating;
      } else {
        ratio = 0;
      }


      setData({
        circulatingSupply,
        circulatingValue,
        circulatingValueTry: circulatingValue * currentTryRate,
        circulatingValueAvax: circulatingValue / avaxPrice,
        circulatingValueBtc: circulatingValue / btcPrice,
        circulatingValueArena: circulatingValue / arenaPrice,
        circulatingValueOrder: circulatingSupply,
        multisigTotalValue,
        multisigTotalValueTry: multisigTotalValue * currentTryRate,
        multisigTotalValueAvax: multisigTotalValue / avaxPrice,
        multisigTotalValueBtc: multisigTotalValue / btcPrice,
        multisigTotalValueArena: multisigTotalValue / arenaPrice,
        multisigTotalValueOrder: multisigTotalValue / tokenPrice,
        difference,
        differenceTry: difference * currentTryRate,
        differenceAvax: difference / avaxPrice,
        differenceBtc: difference / btcPrice,
        differenceArena: difference / arenaPrice,
        differenceOrder: difference / tokenPrice,
        ratio,
        isCirculatingLeading,
      });

      // Store for AAVEYieldCalculator
      localStorage.setItem('multisig-total-value', multisigTotalValue.toString());
      localStorage.setItem('try-exchange-rate', currentTryRate.toString());
      window.dispatchEvent(new CustomEvent('comparative-analysis-updated'));

      setLoading(false);
    };

    calculateComparison();
    const interval = setInterval(calculateComparison, 180000); // Every 3 minutes
    
    // Listen for address, token, wallet, and debt updates
    const handleUpdate = () => calculateComparison();
    window.addEventListener('addresses-updated', handleUpdate);
    window.addEventListener('tokens-updated', handleUpdate);
    window.addEventListener('wallets-updated', handleUpdate);
    window.addEventListener('manual-tokens-updated', handleUpdate);
    window.addEventListener('debt-balance-updated', handleUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('addresses-updated', handleUpdate);
      window.removeEventListener('tokens-updated', handleUpdate);
      window.removeEventListener('wallets-updated', handleUpdate);
      window.removeEventListener('manual-tokens-updated', handleUpdate);
      window.removeEventListener('debt-balance-updated', handleUpdate);
    };
  }, [selectedToken.address, selectedToken.maxSupply, selectedToken.pairAddress, selectedToken.symbol]);

  return (
    <div className="space-y-3">
      <Card className="p-3 gradient-card border-corporate-blue/30 glow-blue h-full flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-5 h-5 text-corporate-blue animate-pulse-slow" />
          <h3 className="text-base font-bold text-foreground">Karşılaştırmalı Analiz</h3>
        </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2 rounded border transition-all duration-500 ${
              data.isCirculatingLeading 
                ? 'bg-corporate-blue/10 border-corporate-blue/30 ring-2 ring-corporate-blue shadow-[0_0_20px_rgba(59,130,246,0.4)]' 
                : 'bg-destructive/10 border-destructive/30 ring-2 ring-destructive shadow-[0_0_20px_rgba(239,68,68,0.4)]'
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Dolaşımdaki {selectedToken.symbol}</p>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className={`font-bold text-xs ${data.isCirculatingLeading ? 'text-corporate-blue' : 'text-destructive'}`}>$</span>
                  <p className={`text-sm font-bold ${data.isCirculatingLeading ? 'text-corporate-blue' : 'text-destructive'}`}>
                    {data.circulatingValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    (₺{data.circulatingValueTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })})
                  </span>
                </div>
                {/* Crypto values in single row */}
                <div className="flex items-center gap-1 text-[9px] overflow-hidden">
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png" 
                      alt="AVAX" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.circulatingValueAvax.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw" 
                      alt="BTC" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.circulatingValueBtc.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://imgproxy-mainnet.routescan.io/GrDCmdCkaNUaM4ZYPunjryrcLAPfBKsWp05O1rogplQ/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYXJlbmF0b2tlbi4zNjQ5YjNhMThhMDQucG5n" 
                      alt="ARENA" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.circulatingValueArena.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src={selectedToken.logo} 
                      alt={selectedToken.symbol} 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground font-medium">
                      {data.circulatingValueOrder.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={`p-2 rounded border transition-all duration-500 ${
              data.isCirculatingLeading 
                ? 'bg-destructive/10 border-destructive/30 ring-2 ring-destructive shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                : 'bg-order-green/10 border-order-green/30 ring-2 ring-order-green shadow-[0_0_20px_rgba(34,197,94,0.4)]'
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Multisig Toplam</p>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className={`font-bold text-xs ${data.isCirculatingLeading ? 'text-destructive' : 'text-order-green'}`}>$</span>
                  <p className={`text-sm font-bold ${data.isCirculatingLeading ? 'text-destructive' : 'text-order-green'}`}>
                    {data.multisigTotalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    (₺{data.multisigTotalValueTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })})
                  </span>
                </div>
                {debtTotalValue > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-destructive">Borç:</span>
                    <span className="text-xs text-destructive font-medium">
                      -${debtTotalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {/* Crypto values in single row */}
                <div className="flex items-center gap-1 text-[9px] overflow-hidden">
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png" 
                      alt="AVAX" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.multisigTotalValueAvax.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw" 
                      alt="BTC" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.multisigTotalValueBtc.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://imgproxy-mainnet.routescan.io/GrDCmdCkaNUaM4ZYPunjryrcLAPfBKsWp05O1rogplQ/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYXJlbmF0b2tlbi4zNjQ5YjNhMThhMDQucG5n" 
                      alt="ARENA" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.multisigTotalValueArena.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw" 
                      alt="ORDER" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground font-medium">
                      {data.multisigTotalValueOrder.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <div className={`p-1.5 rounded border transition-all duration-500 ${
              data.isCirculatingLeading 
                ? 'bg-corporate-blue/10 border-corporate-blue/30 ring-2 ring-corporate-blue shadow-[0_0_20px_rgba(59,130,246,0.4)]' 
                : 'bg-order-green/10 border-order-green/30 ring-2 ring-order-green shadow-[0_0_20px_rgba(34,197,94,0.4)]'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">
                  {data.isCirculatingLeading ? 'Dolaşım Fazlası' : 'Multisig Fazlası'}
                </span>
                <TrendingUp className={`w-2.5 h-2.5 ${data.isCirculatingLeading ? 'text-corporate-blue' : 'text-order-green'}`} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-0.5">
                  <span className={`font-bold text-[9px] ${data.isCirculatingLeading ? 'text-corporate-blue' : 'text-order-green'}`}>$</span>
                  <p className={`text-xs font-bold ${data.isCirculatingLeading ? 'text-corporate-blue' : 'text-order-green'}`}>
                    {data.difference.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-[8px] text-muted-foreground">
                  ₺{data.differenceTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                </div>
                {/* Compact crypto values in single row */}
                <div className="flex items-center gap-1 text-[8px] overflow-hidden">
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png" 
                      alt="AVAX" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.differenceAvax.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw" 
                      alt="BTC" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.differenceBtc.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://imgproxy-mainnet.routescan.io/GrDCmdCkaNUaM4ZYPunjryrcLAPfBKsWp05O1rogplQ/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYXJlbmF0b2tlbi4zNjQ5YjNhMThhMDQucG5n" 
                      alt="ARENA" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground">
                      {data.differenceArena.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <img 
                      src="https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw" 
                      alt="ORDER" 
                      className="w-1.5 h-1.5"
                    />
                    <span className="text-muted-foreground font-medium">
                      {data.differenceOrder.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-1.5 rounded border transition-all duration-500 ${
              data.isCirculatingLeading 
                ? 'bg-corporate-blue/10 border-corporate-blue/30 ring-2 ring-corporate-blue shadow-[0_0_20px_rgba(59,130,246,0.4)]' 
                : 'bg-order-green/10 border-order-green/30 ring-2 ring-order-green shadow-[0_0_20px_rgba(34,197,94,0.4)]'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Değer Oranı</span>
                <Scale className={`w-2.5 h-2.5 ${data.isCirculatingLeading ? 'text-corporate-blue' : 'text-order-green'}`} />
              </div>
              <p className={`text-sm font-bold ${data.isCirculatingLeading ? 'text-corporate-blue' : 'text-order-green'}`}>
                {(data.ratio || 0).toFixed(2)}x
              </p>
              <p className="text-[8px] text-muted-foreground mt-1 leading-tight">
                {Math.abs(data.circulatingValue) >= Math.abs(data.multisigTotalValue)
                  ? `Dolaşım ${(data.ratio || 0).toFixed(2)}x fazla`
                  : `Multisig ${(data.ratio || 0).toFixed(2)}x fazla`}
              </p>
            </div>
          </div>


        </div>
      )}
      </Card>
    </div>
  );
};

export const ComparativeAnalysis = memo(ComparativeAnalysisComponent);
