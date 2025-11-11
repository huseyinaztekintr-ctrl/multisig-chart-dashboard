import { useEffect, useState, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Coins, TrendingUp, BarChart3, Eye, EyeOff } from 'lucide-react';
import { getTokenBalance, fetchDexScreenerPrice } from '@/utils/blockchain';
import { TokenPrice } from '@/types/token';
import { getEnabledAddresses, getManualEntries, useNonCirculatingAddresses } from './AddressManager';

const ORDER_TOKEN = '0x1BEd077195307229FcCBC719C5f2ce6416A58180';
const MAX_SUPPLY = 10000000000;

const CirculatingSupplyComparisonComponent = () => {
  const [selectedCirculating, setSelectedCirculating] = useState<number>(0);
  const [allAddressesCirculating, setAllAddressesCirculating] = useState<number>(0);
  const [selectedValue, setSelectedValue] = useState<TokenPrice>({ usd: 0, try: 0, avax: 0, btc: 0, arena: 0, order: 0 });
  const [allAddressesValue, setAllAddressesValue] = useState<TokenPrice>({ usd: 0, try: 0, avax: 0, btc: 0, arena: 0, order: 0 });
  const [loading, setLoading] = useState(true);
  const [showAllAddresses, setShowAllAddresses] = useState(false);
  
  const { addresses } = useNonCirculatingAddresses();

  const calculateValue = (circulatingAmount: number, orderPrice: number, avaxPrice: number, arenaPrice: number, tryRate: number) => {
    const usdValue = circulatingAmount * orderPrice;
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
        const [orderPriceData, avaxPriceData, arenaPriceData] = await Promise.all([
          fetchDexScreenerPrice('0x5147fff4794fd96c1b0e64dcca921ca0ee1cda8d'),
          fetchDexScreenerPrice('0x864d4e5ee7318e97483db7eb0912e09f161516ea'),
          fetchDexScreenerPrice('0x3c5f68d2f72debba4900c60f32eb8629876401f2')
        ]);

        const orderPrice = orderPriceData.price;
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

        // Calculate for selected addresses (current behavior)
        const enabledAddresses = getEnabledAddresses();
        const manualEntries = getManualEntries();
        const manualTotal = manualEntries.reduce((sum, entry) => sum + (entry.manualAmount || 0), 0);

        const selectedBalances = await Promise.all(
          enabledAddresses.map(address => getTokenBalance(ORDER_TOKEN, address))
        );
        const selectedNonCirculating = selectedBalances.reduce((sum, bal) => sum + bal, 0) + manualTotal;
        const selectedCirculatingAmount = MAX_SUPPLY - selectedNonCirculating;

        // Calculate for ALL addresses (including disabled ones)
        const allAddresses = addresses.filter(addr => addr.type === 'address').map(addr => addr.address);
        const allBalances = await Promise.all(
          allAddresses.map(address => getTokenBalance(ORDER_TOKEN, address))
        );
        
        // Add ALL manual entries (both enabled and disabled)
        const allManualEntries = addresses.filter(addr => addr.type === 'manual');
        const allManualTotal = allManualEntries.reduce((sum, entry) => sum + (entry.manualAmount || 0), 0);
        
        const allNonCirculating = allBalances.reduce((sum, bal) => sum + bal, 0) + allManualTotal;
        const allCirculatingAmount = MAX_SUPPLY - allNonCirculating;

        // Set states
        setSelectedCirculating(selectedCirculatingAmount);
        setAllAddressesCirculating(allCirculatingAmount);
        
        setSelectedValue(calculateValue(selectedCirculatingAmount, orderPrice, avaxPrice, arenaPrice, tryRate));
        setAllAddressesValue(calculateValue(allCirculatingAmount, orderPrice, avaxPrice, arenaPrice, tryRate));
        
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
  }, [addresses]);

  const currentData = showAllAddresses ? 
    { circulating: allAddressesCirculating, value: allAddressesValue } :
    { circulating: selectedCirculating, value: selectedValue };

  const ComparisonCard = ({ title, circulating, value, isComparison = false }: {
    title: string;
    circulating: number;
    value: TokenPrice;
    isComparison?: boolean;
  }) => (
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
                  src="https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw" 
                  alt="ORDER" 
                  className="w-4 h-4 rounded-full"
                />
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-border/30">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <span className={`font-bold ${isComparison ? 'text-corporate-blue' : 'text-order-green'}`}>$</span> USD
              </p>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                ${value.usd.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                <TrendingUp className={`w-3 h-3 ${isComparison ? 'text-corporate-blue' : 'text-order-green'}`} />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <img 
                  src="https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png" 
                  alt="AVAX" 
                  className="w-3 h-3"
                />
                AVAX
              </p>
              <p className="text-sm font-semibold text-foreground">
                {value.avax.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <img 
                  src="https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw" 
                  alt="BTC" 
                  className="w-3 h-3"
                />
                BTC
              </p>
              <p className="text-sm font-semibold text-foreground">
                {value.btc.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <img 
                  src="https://imgproxy-mainnet.routescan.io/GrDCmdCkaNUaM4ZYPunjryrcLAPfBKsWp05O1rogplQ/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYXJlbmF0b2tlbi4zNjQ5YjNhMThhMDQucG5n" 
                  alt="ARENA" 
                  className="w-3 h-3"
                />
                ARENA
              </p>
              <p className="text-sm font-semibold text-foreground">
                {value.arena.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Comparison Toggle */}
      <Card className="p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {showAllAddresses ? (
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
              checked={showAllAddresses}
              onCheckedChange={setShowAllAddresses}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {showAllAddresses ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Tüm Adresler Açık
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Seçtiklerim
              </span>
            )}
          </div>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          💡 {showAllAddresses ? 
            'Şu anda TÜM dolaşım dışı adresler hesaplamaya dahil edildi' : 
            'Şu anda sadece ETKİN olan adresler hesaplamaya dahil edildi'
          }
        </div>
      </Card>

      {/* Cards Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Main Circulating Supply Card */}
        <ComparisonCard
          title="Dolaşımdaki ORDER (Seçtiklerim)"
          circulating={selectedCirculating}
          value={selectedValue}
        />
        
        {/* Comparison Card */}
        <ComparisonCard
          title={showAllAddresses ? "Dolaşımdaki ORDER (Tüm Adresler Açık)" : "Karşılaştırma (Seçtiklerim)"}
          circulating={currentData.circulating}
          value={currentData.value}
          isComparison={true}
        />
      </div>

      {/* Difference Display */}
      {!loading && (
        <Card className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">Fark Analizi</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-amber-500">
                {Math.abs(allAddressesCirculating - selectedCirculating).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ORDER
              </div>
              <div className="text-xs text-muted-foreground">
                ${Math.abs(allAddressesValue.usd - selectedValue.usd).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} USD fark
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            📊 {allAddressesCirculating > selectedCirculating ? 
              'Tüm adresler açık olduğunda dolaşım DAHA FAZLA' : 
              'Seçtikleriniz açık olduğunda dolaşım DAHA FAZLA'
            }
          </div>
        </Card>
      )}
    </div>
  );
};

export const CirculatingSupplyComparison = memo(CirculatingSupplyComparisonComponent);