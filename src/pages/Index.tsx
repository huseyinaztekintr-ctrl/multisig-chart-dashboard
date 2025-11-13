import { PriceFeed } from '@/components/PriceFeed';
import { CurrencyFeed } from '@/components/CurrencyFeed';
import { CirculatingSupplyComparison } from '@/components/CirculatingSupplyComparison';
import { MultisigHoldings } from '@/components/MultisigHoldings';
import { ComparativeAnalysis } from '@/components/ComparativeAnalysis';
import { AddressManager } from '@/components/AddressManager';
import { TokenManager } from '@/components/TokenManager';
import { WalletManager } from '@/components/WalletManager';
import { InstallPrompt } from '@/components/InstallPrompt';
import { RecentTransactions } from '@/components/RecentTransactions';
import { PositionNotes } from '@/components/PositionNotes';
import { MultisigHistoryChart } from '@/components/MultisigHistoryChart';
import { AAVEYieldCalculator } from '@/components/AAVEYieldCalculator';
import { AAVEIncomeDistribution } from '@/components/AAVEIncomeDistribution';
import { MultisigLastActivity } from '@/components/MultisigLastActivity';
import { DebtBalance } from '@/components/DebtBalance';
import { SwapBot } from '@/components/SwapBot';
import { AirdropCard } from '@/components/AirdropCard';
import { MultisigTokenSelector } from '@/components/MultisigTokenSelector';
import { LiveClock } from '@/components/LiveClock';
import { StrategyTable } from '@/components/StrategyTable';
import { PnLTracker } from '@/components/PnLTracker';
import { useSelectedToken } from '@/hooks/useSelectedToken';
import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Index = () => {
  const { selectedToken } = useSelectedToken();
  const [showStrategies, setShowStrategies] = useState(false);

  // Update document title based on selected token
  useEffect(() => {
    document.title = `${selectedToken.symbol} Multisig Yönetişim Paneli | Avalanche DeFi Analytics`;
  }, [selectedToken.symbol]);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-background lg:overflow-hidden">
      <InstallPrompt />
      {/* Compact Header with News Ticker */}
      <header className="border-b border-border/50 bg-gradient-to-r from-card/40 via-card/30 to-card/40 backdrop-blur-md z-50 flex-shrink-0 shadow-lg">
        {/* Single Row - Compact Layout */}
        <div className="px-4 py-2.5 overflow-x-auto">
          <div className="flex items-center gap-4 min-w-max">
            {/* Logo and Title - Havalı Neon Design */}
            <div className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="relative">
                <div className="absolute inset-0 bg-order-green/20 rounded-full blur-lg animate-glow-pulse" />
                <img 
                  src={selectedToken.logo} 
                  alt={selectedToken.symbol} 
                  className="relative w-8 h-8 rounded-full ring-2 ring-order-green/50 shadow-[0_0_15px_rgba(25,209,136,0.4)] group-hover:ring-order-green group-hover:shadow-[0_0_20px_rgba(25,209,136,0.6)] transition-all duration-300"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-order-green rounded-full border-2 border-background animate-pulse shadow-[0_0_8px_rgba(25,209,136,0.8)]" />
              </div>
              <div>
                <h1 className="text-sm font-bold bg-gradient-to-r from-order-green via-order-green-glow to-order-green bg-clip-text text-transparent whitespace-nowrap tracking-wide drop-shadow-[0_0_8px_rgba(25,209,136,0.4)] group-hover:drop-shadow-[0_0_12px_rgba(25,209,136,0.6)] transition-all duration-300">
                  {selectedToken.symbol} Multisig
                </h1>
                <p className="text-[10px] text-order-green/70 font-medium whitespace-nowrap">⚡ Yönetişim Paneli</p>
                {/* Live Clock */}
                <div className="mt-1">
                  <LiveClock />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-border/50 flex-shrink-0" />
            
            {/* Price Feed Cards - Fully Responsive */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name="Bitcoin"
                  symbol="BTC"
                  pairAddress="0x856b38bf1e2e367f747dd4d3951dda8a35f1bf60"
                  logo="https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name="Avalanche"
                  symbol="AVAX"
                  pairAddress="0x864d4e5ee7318e97483db7eb0912e09f161516ea"
                  logo="https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name="Arena"
                  symbol="ARENA"
                  pairAddress="0x3c5f68d2f72debba4900c60f32eb8629876401f2"
                  logo="https://imgproxy-mainnet.routescan.io/GrDCmdCkaNUaM4ZYPunjryrcLAPfBKsWp05O1rogplQ/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYXJlbmF0b2tlbi4zNjQ5YjNhMThhMDQucG5n"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name={selectedToken.name}
                  symbol={selectedToken.symbol}
                  pairAddress={selectedToken.pairAddress || selectedToken.address}
                  logo={selectedToken.logo}
                  isTokenAddress={!selectedToken.pairAddress}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name="GHO Stablecoin"
                  symbol="GHO"
                  pairAddress="0xE32F23B1894eC87eDdee0947ce3D788A3Eddd1E6"
                  logo="https://imgproxy-mainnet.routescan.io/yFJ0mA8KRWqJDuC2mAHftCShVJszMOsICMj-zpKG8JI/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvZ2hvLmRiZjMyZTg1YTYzMi5qcGc"
                  isTokenAddress={false}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name="USD Coin"
                  symbol="USDC"
                  pairAddress="0x2823299af89285fF1a1abF58DB37cE57006FEf5D"
                  logo="https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png"
                  isTokenAddress={false}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name="Dai Stablecoin"
                  symbol="DAI.e"
                  pairAddress="0x2f1DA4bafd5f2508EC2e2E425036063A374993B6"
                  logo="https://imgproxy-mainnet.routescan.io/KXBq5ADiOubzvjufqEJxvwpBmeoVsRnyuGnAz2ImGTo/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvREFJLjE1NjZhZDBiOWJiNi5wbmc"
                  isTokenAddress={false}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name="Tether USD"
                  symbol="USDT"
                  pairAddress="0x2823299af89285fF1a1abF58DB37cE57006FEf5D"
                  logo="https://s2.coinmarketcap.com/static/img/coins/64x64/825.png"
                  isTokenAddress={false}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <PriceFeed
                  name="Euro Coin"
                  symbol="EURC"
                  pairAddress="0xcD4f57d6B160B4ef2DFb78Ad1c76Cc4242EDB4CE"
                  logo="https://imgproxy-mainnet.routescan.io/MS8AU1mCVjdR9AeyiIdTJG_0PvIrnAKwi695D8XAzR4/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvY2lyY2xlZXVyY29pbnNud18zMi5iOTFlMzMyNGZiNTMucG5n"
                  isTokenAddress={false}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <CurrencyFeed />
              </div>
            </div>

            {/* Live Status - Right Side */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-order-green/20 to-order-green/10 rounded-lg border border-order-green/40 shadow-sm flex-shrink-0">
              <div className="w-2 h-2 bg-order-green rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Grid - Mobile First Responsive */}
      <main className="flex-1 lg:overflow-hidden p-4">
        <div className="lg:h-full flex flex-col lg:grid lg:grid-cols-12 gap-4">
          {/* Mobile Layout: Stack all columns vertically */}
          
          {/* Chart Section - Mobile Priority */}
          <div className="lg:hidden w-full mb-6">
            <div className="h-[300px]">
              <MultisigHistoryChart />
            </div>
          </div>

          {/* Left Column */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 lg:overflow-y-auto lg:max-h-screen">
            {/* Multisig Last Activity */}
            <MultisigLastActivity />
            
            {/* Wallet Manager */}
            <WalletManager />
            
            {/* Address Manager */}
            <AddressManager />
            
            {/* Token Manager */}
            <TokenManager />
            
            {/* AAVE Yield Calculator */}
            <AAVEYieldCalculator />
            
            {/* Multisig Token Selector */}
            <MultisigTokenSelector />
            
            {/* Airdrop Card */}
            <AirdropCard />
            
            {/* Swap Bot */}
            <SwapBot />
            
            {/* Recent Transactions */}
            <RecentTransactions />
          </div>

          {/* Center Column */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 lg:overflow-y-auto">
            <CirculatingSupplyComparison />
            
            {/* Multisig History Chart - Desktop Only */}
            <div className="hidden lg:block min-h-[500px] flex-grow relative z-0">
              <MultisigHistoryChart />
            </div>
            
            <PositionNotes />
            <DebtBalance />
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 lg:overflow-y-auto">
            <ComparativeAnalysis />
            <PnLTracker />
            <AAVEIncomeDistribution />
            <MultisigHoldings />
          </div>
        </div>
      </main>

      {/* Floating Strategies Button */}
      <Button
        onClick={() => setShowStrategies(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-corporate-blue to-blue-600 hover:from-corporate-blue/90 hover:to-blue-600/90 text-white shadow-lg shadow-corporate-blue/30 rounded-full w-14 h-14 p-0"
        title="Stratejiler"
      >
        <TrendingUp className="w-6 h-6" />
      </Button>

      {/* Strategies Dialog */}
      <Dialog open={showStrategies} onOpenChange={setShowStrategies}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-corporate-blue" />
              Alınan Arzın Akıbeti ve Stratejiler
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-corporate-blue/10 rounded-lg border border-corporate-blue/30">
              <h4 className="font-semibold text-sm text-foreground mb-2">Alınan Arzın Akıbeti</h4>
              <p className="text-sm text-muted-foreground">
                ORDER'in açık arzı market değeridir. Multisig'de o değer kadar stabil coin bulunur. 
                4h mAcrss'a göre WAVAX-USDC Trade edilerek MarketCap değişir.
              </p>
            </div>
            
            <StrategyTable />
          </div>
        </DialogContent>
      </Dialog>

      {/* Compact Footer */}
      <footer className="border-t border-border/50 py-2 flex-shrink-0">
        <div className="px-4 text-center">
          <p className="text-xs text-muted-foreground">
            {selectedToken.symbol} Multisig • Avalanche C-Chain • DexScreener & Avalanche RPC
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
