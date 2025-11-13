import { useEffect, useState, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Coins, TrendingUp, BarChart3, Eye, EyeOff } from 'lucide-react';
import { getTokenBalance, fetchDexScreenerPrice, fetchDexScreenerPriceByToken } from '@/utils/blockchain';
import { TokenPrice } from '@/types/token';
import { getEnabledAddresses, getManualEntries, getAllAddresses, getAllManualEntries, useNonCirculatingAddresses } from './AddressManager';
import { getCurrentSelectedToken } from '@/hooks/useSelectedToken';

const CirculatingSupplyComparisonComponent = () => {
  const [selectedToken, setSelectedToken] = useState(() => getCurrentSelectedToken());
  const [selectedCirculating, setSelectedCirculating] = useState<number>(0);
  const [allAddressesCirculating, setAllAddressesCirculating] = useState<number>(0);
  const [selectedValue, setSelectedValue] = useState<TokenPrice>({ usd: 0, try: 0, avax: 0, btc: 0, arena: 0, order: 0 });
  const [allAddressesValue, setAllAddressesValue] = useState<TokenPrice>({ usd: 0, try: 0, avax: 0, btc: 0, arena: 0, order: 0 });
  const [loading, setLoading] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  
  const { addresses } = useNonCirculatingAddresses();

  // Listen for selected token changes
  useEffect(() => {
    const handleTokenChange = (event: CustomEvent) => {
      setSelectedToken(event.detail);
    };

    window.addEventListener('selected-token-changed', handleTokenChange as EventListener);
    return () => window.removeEventListener('selected-token-changed', handleTokenChange as EventListener);
  }, []);

  const calculateValue = (circulatingAmount: number, tokenPrice: number, avaxPrice: number, arenaPrice: number, tryRate: number) => {
    const usdValue = circulatingAmount * tokenPrice;
    const btcPrice = 95000; // Mock BTC price
    
    return {
      usd: usdValue,
      try: usdValue * tryRate,
      avax: usdValue / avaxPrice,
      btc: usdValue / btcPrice,
      arena: usdValue / arenaPrice,
      order: circulatingAmount,
    };
  };

  useEffect(() => {
    const calculateBothCirculating = async () => {
      setLoading(true);
      
      try {
        // Get prices first
        const [tokenPriceData, avaxPriceData, arenaPriceData] = await Promise.all([
          selectedToken.pairAddress ? fetchDexScreenerPrice(selectedToken.pairAddress) : fetchDexScreenerPriceByToken(selectedToken.address),
          fetchDexScreenerPrice('0x864d4e5ee7318e97483db7eb0912e09f161516ea'),
          fetchDexScreenerPrice('0x3c5f68d2f72debba4900c60f32eb8629876401f2')
        ]);

        const tokenPrice = tokenPriceData.price;
        const avaxPrice = avaxPriceData.price;
        const arenaPrice = arenaPriceData.price;

        // Get TRY rate
        let tryRate = 34.5;
        try {
          const tryResponse = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
          const tryData = await tryResponse.json();
          tryRate = tryData.usd?.try || 34.5;
        } catch (error) {
          console.error('Error fetching TRY rate:', error);
        }

        // Calculate for selected addresses (current behavior - user's selected addresses)
        const enabledAddresses = getEnabledAddresses(selectedToken.symbol);
        const manualEntries = getManualEntries(selectedToken.symbol);
        const manualTotal = manualEntries.reduce((sum, entry) => sum + (entry.manualAmount || 0), 0);

        const selectedBalances = await Promise.all(
          enabledAddresses.map(address => getTokenBalance(selectedToken.address, address))
        );
        const selectedNonCirculating = selectedBalances.reduce((sum, bal) => sum + bal, 0) + manualTotal;
        const selectedCirculatingAmount = selectedToken.maxSupply - selectedNonCirculating;

        // Calculate for ALL addresses (including disabled ones for comparison)
        const allAddresses = getAllAddresses(selectedToken.symbol);
        const allManualEntries = getAllManualEntries(selectedToken.symbol);
        const allManualTotal = allManualEntries.reduce((sum, entry) => sum + (entry.manualAmount || 0), 0);
        
        const allBalances = await Promise.all(
          allAddresses.map(address => getTokenBalance(selectedToken.address, address))
        );
        const allNonCirculating = allBalances.reduce((sum, bal) => sum + bal, 0) + allManualTotal;
        const allCirculatingAmount = selectedToken.maxSupply - allNonCirculating;

        // Set states
        setSelectedCirculating(selectedCirculatingAmount);
        setAllAddressesCirculating(allCirculatingAmount);
        
        setSelectedValue(calculateValue(selectedCirculatingAmount, tokenPrice, avaxPrice, arenaPrice, tryRate));
        setAllAddressesValue(calculateValue(allCirculatingAmount, tokenPrice, avaxPrice, arenaPrice, tryRate));
        
      } catch (error) {
        console.error('Error calculating circulating supply:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateBothCirculating();
    const interval = setInterval(calculateBothCirculating, 180000); // Every 3 minutes
    
    // Listen for address updates
    const handleAddressUpdate = () => calculateBothCirculating();
    window.addEventListener('addresses-updated', handleAddressUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('addresses-updated', handleAddressUpdate);
    };
  }, [addresses, selectedToken.address, selectedToken.maxSupply, selectedToken.pairAddress, selectedToken.symbol]);

  const ComparisonCard = ({ title, circulating, value, isComparison = false }: {
    title: string;
    circulating: number;
    value: TokenPrice;
    isComparison?: boolean;
  }) => {

    return (
      <Card className={`p-3 gradient-card border-primary/20 glow-order flex flex-col min-h-[180px] rounded-3xl ${isComparison ? 'border-corporate-blue/30' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          {isComparison ? (
            <BarChart3 className="w-5 h-5 text-corporate-blue animate-pulse-slow" />
          ) : (
            <Coins className="w-5 h-5 text-order-green animate-pulse-slow" />
          )}
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-6 w-32 bg-muted animate-pulse rounded-xl" />
            <div className="h-4 w-24 bg-muted animate-pulse rounded-xl" />
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Dolaşımdaki Miktar</p>
              <p className={`text-lg font-bold animate-glow flex items-center gap-2 ${isComparison ? 'text-corporate-blue' : 'text-order-green'}`}>
                {circulating.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                <span className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br ${isComparison ? 'from-corporate-blue/10 to-corporate-blue/5 ring-corporate-blue/30' : 'from-order-green/10 to-order-green/5 ring-order-green/30'} ring-1 shadow-xl shadow-order-green/20 animate-pulse backdrop-blur-sm`}>
                  <img 
                    src={selectedToken.logo} 
                    alt={selectedToken.symbol} 
                    className="w-4 h-4 rounded-full"
                  />
                </span>
              </p>
            </div>

            <div className="pt-1.5 border-t border-border/30 space-y-2">
              <div className="flex items-center gap-1">
                <span className={`font-bold text-sm ${isComparison ? 'text-corporate-blue' : 'text-order-green'}`}>$</span>
                <p className="text-lg font-bold text-foreground flex items-center gap-1">
                  {value.usd.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  <TrendingUp className={`w-4 h-4 ${isComparison ? 'text-corporate-blue' : 'text-order-green'}`} />
                </p>
                <span className="text-sm text-muted-foreground">
                  (₺{value.try.toLocaleString('tr-TR', { maximumFractionDigits: 0 })})
                </span>
              </div>
              
              {/* Single row crypto values */}
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <img 
                    src="https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png" 
                    alt="AVAX" 
                    className="w-3 h-3"
                  />
                  <span className="text-muted-foreground">
                    {value.avax.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <img 
                    src="https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw" 
                    alt="BTC" 
                    className="w-3 h-3"
                  />
                  <span className="text-muted-foreground">
                    {value.btc.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <img 
                    src="https://imgproxy-mainnet.routescan.io/GrDCmdCkaNUaM4ZYPunjryrcLAPfBKsWp05O1rogplQ/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYXJlbmF0b2tlbi4zNjQ5YjNhMThhMDQucG5n" 
                    alt="ARENA" 
                    className="w-3 h-3"
                  />
                  <span className="text-muted-foreground">
                    {value.arena.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Comparison Toggle */}
      <Card className="p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {showComparison ? (
                <Eye className="w-4 h-4 text-purple-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-blue-400" />
              )}
              <Label htmlFor="comparison-mode" className="text-sm font-semibold text-foreground cursor-pointer">
                Karşılaştırma Modu
              </Label>
            </div>
            <Switch
              id="comparison-mode"
              checked={showComparison}
              onCheckedChange={setShowComparison}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {showComparison ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Karşılaştırma Aktif
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Tek Görünüm
              </span>
            )}
          </div>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          💡 {showComparison ? 
            'Karşılaştırma: Seçtikleriniz vs BÜTÜN dolaşım dışı adresler (aktif+pasif)' : 
            'Şu anda sadece seçtiğiniz adresler hesaplamaya dahil edildi'
          }
        </div>
      </Card>

      {/* Cards Container */}
      <div className={`grid gap-4 ${showComparison ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Main Circulating Supply Card */}
        <ComparisonCard
          title={`Dolaşımdaki ${selectedToken.symbol} (Seçtiklerim)`}
          circulating={selectedCirculating}
          value={selectedValue}
        />
        
        {/* Comparison Card - Only show when comparison is enabled */}
        {showComparison && (
          <ComparisonCard
            title={`Dolaşımdaki ${selectedToken.symbol} (Bütün Adresler)`}
            circulating={allAddressesCirculating}
            value={allAddressesValue}
            isComparison={true}
          />
        )}
      </div>

      {/* Difference Display - Only show when comparison is enabled */}
      {showComparison && !loading && (
        <Card className="p-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3 h-3 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">Fark Analizi</span>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-amber-500">
                {Math.abs(allAddressesCirculating - selectedCirculating).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} {selectedToken.symbol}
              </div>
              <div className="text-xs text-muted-foreground">
                ${Math.abs(allAddressesValue.usd - selectedValue.usd).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} USD fark
              </div>
            </div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            📊 {allAddressesCirculating > selectedCirculating ? 
              'Bütün adresler kullanıldığında dolaşım DAHA FAZLA' : 
              'Seçtikleriniz kullanıldığında dolaşım DAHA FAZLA'
            }
          </div>
        </Card>
      )}
    </div>
  );
};

export const CirculatingSupplyComparison = memo(CirculatingSupplyComparisonComponent);