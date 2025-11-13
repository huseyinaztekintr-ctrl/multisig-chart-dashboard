import { useEffect, useState, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Coins, TrendingUp } from 'lucide-react';
import { getTokenBalance, fetchDexScreenerPrice } from '@/utils/blockchain';
import { TokenPrice } from '@/types/token';
import { getEnabledAddresses, getManualEntries } from './AddressManager';

const ORDER_TOKEN = '0x1BEd077195307229FcCBC719C5f2ce6416A58180';
const MAX_SUPPLY = 10000000000;

const CirculatingSupplyCardComponent = () => {
  const [circulating, setCirculating] = useState<number>(0);
  const [value, setValue] = useState<TokenPrice>({ usd: 0, try: 0, avax: 0, btc: 0, arena: 0, order: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateCirculating = async () => {
      setLoading(true);
      
      // Get enabled addresses from localStorage
      const enabledAddresses = getEnabledAddresses();
      
      // Fetch all non-circulating balances dynamically
      const balances = await Promise.all(
        enabledAddresses.map(address => getTokenBalance(ORDER_TOKEN, address))
      );

      // Get manual entries
      const manualEntries = getManualEntries();
      const manualTotal = manualEntries.reduce((sum, entry) => sum + (entry.manualAmount || 0), 0);

      const totalNonCirculating = balances.reduce((sum, bal) => sum + bal, 0) + manualTotal;
      const circulatingSupply = MAX_SUPPLY - totalNonCirculating;
      
      // Fetch prices
      const orderPriceData = await fetchDexScreenerPrice('0x5147fff4794fd96c1b0e64dcca921ca0ee1cda8d');
      const avaxPriceData = await fetchDexScreenerPrice('0x864d4e5ee7318e97483db7eb0912e09f161516ea');
      const arenaPriceData = await fetchDexScreenerPrice('0x3c5f68d2f72debba4900c60f32eb8629876401f2');
      const orderPrice = orderPriceData.price;
      const avaxPrice = avaxPriceData.price;
      const arenaPrice = arenaPriceData.price;
      const btcPrice = 95000; // Mock BTC price, would need real API
      
      // Get TRY exchange rate
      let tryRate = 34.5;
      try {
        const tryResponse = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        const tryData = await tryResponse.json();
        tryRate = tryData.usd?.try || 34.5;
      } catch (error) {
        console.error('Error fetching TRY rate:', error);
      }

      setCirculating(circulatingSupply);
      const usdValue = circulatingSupply * orderPrice;
      setValue({
        usd: usdValue,
        try: usdValue * tryRate,
        avax: usdValue / avaxPrice,
        btc: usdValue / btcPrice,
        arena: usdValue / arenaPrice,
        order: circulatingSupply,
      });
      
      setLoading(false);
    };

    calculateCirculating();
    const interval = setInterval(calculateCirculating, 180000); // Every 3 minutes
    
    // Listen for address updates
    const handleAddressUpdate = () => calculateCirculating();
    window.addEventListener('addresses-updated', handleAddressUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('addresses-updated', handleAddressUpdate);
    };
  }, []);

  return (
    <Card className="p-3 gradient-card border-primary/20 glow-order flex flex-col min-h-[180px] rounded-3xl">
      <div className="flex items-center gap-2 mb-2">
        <Coins className="w-5 h-5 text-order-green animate-pulse-slow" />
        <h2 className="text-base font-bold text-foreground">Dolaşımdaki ORDER</h2>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-xl" />
          <div className="h-5 w-32 bg-muted animate-pulse rounded-xl" />
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Toplam Dolaşımdaki Miktar</p>
            <p className="text-xl font-bold text-order-green animate-glow flex items-center gap-2">
              {circulating.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
              <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-order-green/10 to-order-green/5 ring-1 ring-order-green/30 shadow-xl shadow-order-green/20 animate-pulse backdrop-blur-sm">
                <img 
                  src="https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw" 
                  alt="ORDER" 
                  className="w-5 h-5 rounded-full"
                />
              </span>
            </p>
          </div>

          <div className="pt-1.5 border-t border-border/30 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-order-green font-bold text-sm">$</span>
                <p className="text-lg font-bold text-foreground flex items-center gap-1">
                  {value.usd.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  <TrendingUp className="w-4 h-4 text-order-green" />
                </p>
                <span className="text-sm text-muted-foreground">
                  (₺{value.try.toLocaleString('tr-TR', { maximumFractionDigits: 0 })})
                </span>
              </div>
            </div>
            
            {/* Crypto values on separate line */}
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

export const CirculatingSupplyCard = memo(CirculatingSupplyCardComponent);
