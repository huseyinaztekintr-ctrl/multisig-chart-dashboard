import { useEffect, useState, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { getTokenBalance, fetchDexScreenerPrice, getProvider } from '@/utils/blockchain';
import { TokenData } from '@/types/token';
import { getEnabledTokens } from './TokenManager';
import { getEnabledWallets } from './WalletManager';
import { ethers } from 'ethers';

const ORDER_PAIR_ADDRESS = '0x5147fff4794fd96c1b0e64dcca921ca0ee1cda8d';

const MultisigHoldingsComponent = () => {
  const [holdings, setHoldings] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const fetchHoldings = async () => {
      const enabledWallets = getEnabledWallets();
      const enabledTokens = getEnabledTokens();
      
      if (enabledWallets.length === 0) {
        setHoldings([]);
        setLoading(false);
        return;
      }
      
      try {
        // Fetch all prices in parallel
        const [avaxPriceData, arenaPriceData, orderPriceData] = await Promise.all([
          fetchDexScreenerPrice('0x864d4e5ee7318e97483db7eb0912e09f161516ea'),
          fetchDexScreenerPrice('0x3c5f68d2f72debba4900c60f32eb8629876401f2'),
          fetchDexScreenerPrice(ORDER_PAIR_ADDRESS)
        ]);
        const avaxPrice = avaxPriceData.price;
        const arenaPrice = arenaPriceData.price;
        const orderPrice = orderPriceData.price;
        const btcPrice = 95000; // Mock
        
        // Get TRY exchange rate
        let tryRate = 34.5;
        try {
          const tryResponse = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
          const tryData = await tryResponse.json();
          tryRate = tryData.usd?.try || 34.5;
        } catch (error) {
          console.error('Error fetching TRY rate:', error);
        }
        
        const provider = getProvider();

        // Fetch all wallet balances in parallel
        const walletDataPromises = enabledWallets.map(async (wallet) => {
          // Fetch native AVAX balance
          const avaxBalance = await provider.getBalance(wallet.address);
          const nativeAvaxBalance = Number(ethers.formatEther(avaxBalance));

          // Fetch all token balances for this wallet in parallel
          const tokenBalancePromises = enabledTokens.map(async (token) => {
            const balance = await getTokenBalance(token.address, wallet.address);
            
            if (balance === 0) return null;
            
            let price = 0;
            if (token.pairAddress) {
              const priceData = await fetchDexScreenerPrice(token.pairAddress);
              price = priceData.price;
            } else if (token.symbol === 'USDC' || token.symbol === 'DAI.e' || token.symbol === 'GHO') {
              price = 1;
            } else if (token.symbol === 'BTC.b') {
              price = btcPrice;
            }

            return {
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              logo: token.logo,
              balance,
              price
            };
          });

          const tokenBalances = (await Promise.all(tokenBalancePromises)).filter(Boolean);

          return {
            avaxBalance: nativeAvaxBalance,
            tokenBalances
          };
        });

        const walletsData = await Promise.all(walletDataPromises);

        // Aggregate all holdings
        const aggregatedHoldings = new Map<string, TokenData>();

        // Aggregate AVAX
        walletsData.forEach(({ avaxBalance }) => {
          const nativeAvaxValue = avaxBalance * avaxPrice;
          const avaxKey = 'AVAX';
          
          if (aggregatedHoldings.has(avaxKey)) {
            const existing = aggregatedHoldings.get(avaxKey)!;
            existing.balance += avaxBalance;
            existing.value.usd += nativeAvaxValue;
            existing.value.try += nativeAvaxValue * tryRate;
            existing.value.avax += avaxBalance;
            existing.value.btc += nativeAvaxValue / btcPrice;
            existing.value.arena += nativeAvaxValue / arenaPrice;
            existing.value.order += nativeAvaxValue / orderPrice;
          } else {
            aggregatedHoldings.set(avaxKey, {
              symbol: 'AVAX',
              name: 'Avalanche',
              address: 'native',
              logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png',
              price: { usd: avaxPrice, try: avaxPrice * tryRate, avax: 1, btc: avaxPrice / btcPrice, arena: avaxPrice / arenaPrice, order: avaxPrice / orderPrice },
              balance: avaxBalance,
              value: {
                usd: nativeAvaxValue,
                try: nativeAvaxValue * tryRate,
                avax: avaxBalance,
                btc: nativeAvaxValue / btcPrice,
                arena: nativeAvaxValue / arenaPrice,
                order: nativeAvaxValue / orderPrice,
              },
            });
          }
        });

        // Aggregate tokens
        walletsData.forEach(({ tokenBalances }) => {
          tokenBalances.forEach((token: any) => {
            const usdValue = token.balance * token.price;
            const tokenKey = token.symbol;

            if (aggregatedHoldings.has(tokenKey)) {
              const existing = aggregatedHoldings.get(tokenKey)!;
              existing.balance += token.balance;
              existing.value.usd += usdValue;
              existing.value.try += usdValue * tryRate;
              existing.value.avax += usdValue / avaxPrice;
              existing.value.btc += usdValue / btcPrice;
              existing.value.arena += usdValue / arenaPrice;
              existing.value.order += usdValue / orderPrice;
            } else {
              aggregatedHoldings.set(tokenKey, {
                symbol: token.symbol,
                name: token.name,
                address: token.address,
                logo: token.logo,
                price: { usd: token.price, try: token.price * tryRate, avax: token.price / avaxPrice, btc: token.price / btcPrice, arena: token.price / arenaPrice, order: token.price / orderPrice },
                balance: token.balance,
                value: {
                  usd: usdValue,
                  try: usdValue * tryRate,
                  avax: usdValue / avaxPrice,
                  btc: usdValue / btcPrice,
                  arena: usdValue / arenaPrice,
                  order: usdValue / orderPrice,
                },
              });
            }
          });
        });

        const allHoldings = Array.from(aggregatedHoldings.values()).sort((a, b) => b.value.usd - a.value.usd);
        setHoldings(allHoldings);
      } catch (error) {
        console.error('Error fetching holdings:', error);
      } finally {
        setLoading(false);
      }
    };

    const debouncedFetch = () => {
      setLoading(true);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchHoldings, 500);
    };

    fetchHoldings();
    const interval = setInterval(fetchHoldings, 180000); // Every 3 minutes
    
    const handleUpdate = () => debouncedFetch();
    window.addEventListener('tokens-updated', handleUpdate);
    window.addEventListener('wallets-updated', handleUpdate);
    
    return () => {
      clearTimeout(debounceTimer);
      clearInterval(interval);
      window.removeEventListener('tokens-updated', handleUpdate);
      window.removeEventListener('wallets-updated', handleUpdate);
    };
  }, []);

  const totalValue = holdings.reduce((sum, token) => sum + token.value.usd, 0);
  const enabledWallets = getEnabledWallets();

  return (
    <Card className="p-5 gradient-card border-corporate-blue/30 glow-blue h-full flex flex-col min-h-[500px]">
      <div className="flex items-center gap-2 mb-4">
        <img 
          src="https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png" 
          alt="Safe"
          className="w-6 h-6"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground">Multisig Holdingleri</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <Wallet className="w-3 h-3" />
            {enabledWallets.length} Cüzdan
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="mb-2 p-2 bg-muted/30 rounded-lg border border-corporate-blue/20 flex-shrink-0">
            <p className="text-xs text-muted-foreground mb-1">Toplam Değer</p>
            <p className="text-xl font-bold text-corporate-blue">
              ${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1">
            {holdings.map((token, index) => (
              <div
                key={token.symbol}
                className="group p-3 bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg border border-border/50 hover:border-corporate-blue/50 transition-all duration-300 hover:shadow-lg hover:shadow-corporate-blue/20 hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full ring-2 ring-corporate-blue/20 group-hover:ring-corporate-blue/40 transition-all" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{token.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {token.balance.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-border/30">
                    <p className="text-sm font-bold text-corporate-blue group-hover:text-corporate-blue/80 transition-colors">
                      ${token.value.usd.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 10 })}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <img 
                        src="https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png" 
                        alt="AVAX" 
                        className="w-3 h-3"
                      />
                      {token.value.avax.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 10 })}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <img 
                        src="https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw" 
                        alt="BTC" 
                        className="w-3 h-3"
                      />
                      {token.value.btc.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 10 })}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <img 
                        src="https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw" 
                        alt="ORDER" 
                        className="w-3 h-3"
                      />
                      {token.value.order.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 10 })}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <img 
                        src="https://imgproxy-mainnet.routescan.io/GrDCmdCkaNUaM4ZYPunjryrcLAPfBKsWp05O1rogplQ/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYXJlbmF0b2tlbi4zNjQ5YjNhMThhMDQucG5n" 
                        alt="ARENA" 
                        className="w-3 h-3"
                      />
                      {token.value.arena.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 10 })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export const MultisigHoldings = memo(MultisigHoldingsComponent);
