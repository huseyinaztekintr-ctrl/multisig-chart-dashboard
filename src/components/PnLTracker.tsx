import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Plus, Trash2, BarChart3, Target, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getEnabledTokens } from './TokenManager';
import { fetchDexScreenerPrice } from '@/utils/blockchain';
import { fetchExchangeRates, formatCurrency } from '@/utils/currency';

const PNL_POSITIONS_STORAGE_KEY = 'order-pnl-positions';

interface PnLPosition {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenPairAddress?: string;
  tokenLogo: string;
  quantity: number;
  entryPrice: number;
  sellTarget: number;
  positionType: 'spot' | 'long' | 'short';
  notes?: string;
  createdAt: string;
  currentPrice?: number;
  lastUpdated?: string;
  targetReached?: boolean;
}

export const PnLTracker = () => {
  const { toast } = useToast();
  const [pnlPositions, setPnlPositions] = useState<PnLPosition[]>([]);
  const [showPnlForm, setShowPnlForm] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [usdToTryRate, setUsdToTryRate] = useState<number>(0);

  // P&L form states
  const [pnlTokenSymbol, setPnlTokenSymbol] = useState('');
  const [pnlQuantity, setPnlQuantity] = useState('');
  const [pnlEntryPrice, setPnlEntryPrice] = useState('');
  const [pnlSellTarget, setPnlSellTarget] = useState('');
  const [positionType, setPositionType] = useState<'spot' | 'long' | 'short'>('spot');
  const [pnlNotes, setPnlNotes] = useState('');
  const [formKey, setFormKey] = useState(0); // For forcing form re-render

  // Load P&L positions from localStorage
  useEffect(() => {
    const savedPnlPositions = localStorage.getItem(PNL_POSITIONS_STORAGE_KEY);
    if (savedPnlPositions) {
      try {
        const positions = JSON.parse(savedPnlPositions);
        // Migrate old positions to include targetReached and currentPrice
        const migratedPositions = positions.map((p: PnLPosition) => ({
          ...p,
          targetReached: p.targetReached ?? false, // Default to false if undefined
          currentPrice: p.currentPrice ?? 0, // Default to 0 if undefined
          positionType: p.positionType ?? 'spot' // Default to spot if undefined
        }));
        setPnlPositions(migratedPositions);
        
        // Save migrated positions back to localStorage
        if (JSON.stringify(positions) !== JSON.stringify(migratedPositions)) {
          localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(migratedPositions));
          console.log('Migrated PnL positions with targetReached property');
        }
      } catch (e) {
        console.error('Error loading P&L positions:', e);
      }
    }
  }, []);

  // Fetch TRY exchange rate
  useEffect(() => {
    const fetchTryRate = async () => {
      try {
        const rate = await fetchExchangeRates();
        setUsdToTryRate(rate);
      } catch (error) {
        console.error('Error fetching TRY rate:', error);
      }
    };

    fetchTryRate();
    const interval = setInterval(fetchTryRate, 300000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Check P&L positions for sell target alerts
  useEffect(() => {
    const checkPnlAlerts = async () => {
      if (pnlPositions.length === 0) return;

      const updatedPositions = [...pnlPositions];
      let hasUpdates = false;

      for (let i = 0; i < updatedPositions.length; i++) {
        const position = updatedPositions[i];
        if (position.targetReached) continue;

        try {
          let tokenPrice = 0;
          
          if (position.tokenSymbol === 'BTC.b') {
            const btcPairAddress = '0x856b38Bf1e2E367F747DD4d3951DDA8a35F1bF60';
            const btcPriceData = await fetchDexScreenerPrice(btcPairAddress);
            tokenPrice = btcPriceData.price;
          } else if (position.tokenSymbol === 'USDC' || position.tokenSymbol === 'DAI.e' || position.tokenSymbol === 'GHO') {
            tokenPrice = 1;
          } else if (position.tokenPairAddress) {
            const priceData = await fetchDexScreenerPrice(position.tokenPairAddress);
            tokenPrice = priceData.price;
          }
          
          if (tokenPrice === 0) continue;

          // Update current price
          updatedPositions[i].currentPrice = tokenPrice;
          updatedPositions[i].lastUpdated = new Date().toISOString();
          hasUpdates = true;

          // Check if sell target is reached based on position type
          const isTargetReached = position.positionType === 'short'
            ? tokenPrice <= position.sellTarget  // Short: target reached when price goes down
            : tokenPrice >= position.sellTarget; // Long/Spot: target reached when price goes up
            
          if (isTargetReached) {
            updatedPositions[i].targetReached = true;
            
            const profit = position.positionType === 'short'
              ? (position.entryPrice - position.sellTarget) * position.quantity
              : (position.sellTarget - position.entryPrice) * position.quantity;
            const profitPercent = position.positionType === 'short'
              ? ((position.entryPrice / position.sellTarget) - 1) * 100
              : ((position.sellTarget / position.entryPrice) - 1) * 100;
            
            toast({
              title: `🎯 ${position.tokenSymbol} HEDEF ULAŞILDI! 🚀`,
              description: `Satış fiyatı $${tokenPrice.toFixed(6)} seviyesine ulaştı! Kar: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`,
            });
          }
        } catch (e) {
          console.error('Error checking P&L position:', e);
        }
      }

      if (hasUpdates) {
        setPnlPositions(updatedPositions);
        localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));
      }
    };

    const interval = setInterval(checkPnlAlerts, 30000); // Check every 30 seconds
    checkPnlAlerts(); // Initial check

    return () => clearInterval(interval);
  }, [pnlPositions, toast]);

  const addPnlPosition = () => {
    if (!pnlTokenSymbol || !pnlQuantity || !pnlEntryPrice || !pnlSellTarget) {
      toast({
        title: 'Hata',
        description: 'Lütfen tüm zorunlu alanları doldurun.',
        variant: 'destructive',
      });
      return;
    }

    // Validate numeric inputs
    const quantity = parseFloat(pnlQuantity);
    const entryPrice = parseFloat(pnlEntryPrice);
    const sellTarget = parseFloat(pnlSellTarget);

    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: 'Hata',
        description: 'Geçerli bir adet giriniz.',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(entryPrice) || entryPrice <= 0) {
      toast({
        title: 'Hata',
        description: 'Geçerli bir alım fiyatı giriniz.',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(sellTarget) || sellTarget <= 0) {
      toast({
        title: 'Hata',
        description: 'Geçerli bir satış hedefi giriniz.',
        variant: 'destructive',
      });
      return;
    }

    // Position type specific validation
    if (positionType === 'short' && sellTarget >= entryPrice) {
      toast({
        title: 'Hata',
        description: 'Short pozisyonda satış hedefi entry fiyatından düşük olmalıdır.',
        variant: 'destructive',
      });
      return;
    }

    if ((positionType === 'long' || positionType === 'spot') && sellTarget <= entryPrice) {
      toast({
        title: 'Hata',
        description: 'Long/Spot pozisyonda satış hedefi entry fiyatından yüksek olmalıdır.',
        variant: 'destructive',
      });
      return;
    }

    const selectedToken = getEnabledTokens().find(t => t.symbol === pnlTokenSymbol);
    if (!selectedToken) {
      toast({
        title: 'Hata',
        description: 'Seçilen token bulunamadı.',
        variant: 'destructive',
      });
      return;
    }

    // Generate unique ID with timestamp and random component
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newPosition: PnLPosition = {
      id: uniqueId,
      tokenSymbol: pnlTokenSymbol,
      tokenAddress: selectedToken.address,
      tokenPairAddress: selectedToken.pairAddress || undefined,
      tokenLogo: selectedToken.logo,
      quantity,
      entryPrice,
      sellTarget,
      positionType,
      notes: pnlNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      targetReached: false, // Explicitly set to false
      currentPrice: 0, // Initialize current price
    };

    try {
      const updatedPositions = [...pnlPositions, newPosition];
      setPnlPositions(updatedPositions);
      localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));

      // Reset form after successful save
      const tokenSymbolForToast = pnlTokenSymbol;
      
      // Force form reset and re-render
      setTimeout(() => {
        setPnlTokenSymbol('');
        setPnlQuantity('');
        setPnlEntryPrice('');
        setPnlSellTarget('');
        setPositionType('spot');
        setPnlNotes('');
        setFormKey(prev => prev + 1); // Force re-render
      }, 0);
      
      setShowPnlForm(false);

      toast({
        title: 'Başarılı',
        description: `${tokenSymbolForToast} pozisyonu eklendi. Toplam ${updatedPositions.length} pozisyon.`,
      });
    } catch (error) {
      console.error('Error adding P&L position:', error);
      toast({
        title: 'Hata',
        description: 'Pozisyon eklenirken bir hata oluştu.',
        variant: 'destructive',
      });
    }
  };

  const deletePnlPosition = (id: string) => {
    try {
      console.log('Delete called with ID:', id);
      console.log('Current positions:', pnlPositions.map(p => ({ id: p.id, symbol: p.tokenSymbol })));
      
      const positionToDelete = pnlPositions.find(p => p.id === id);
      if (!positionToDelete) {
        console.log('Position not found!');
        toast({
          title: 'Hata',
          description: 'Silinecek pozisyon bulunamadı.',
          variant: 'destructive',
        });
        return;
      }

      console.log('Deleting position:', positionToDelete);
      const updatedPositions = pnlPositions.filter(p => p.id !== id);
      console.log('Updated positions:', updatedPositions);
      
      // Force state update
      setPnlPositions([]);
      setTimeout(() => {
        setPnlPositions(updatedPositions);
      }, 0);
      
      localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));
      
      console.log('Position deleted successfully');
      toast({
        title: 'Başarılı',
        description: `${positionToDelete.tokenSymbol} pozisyonu silindi. Kalan: ${updatedPositions.length} pozisyon.`,
      });
    } catch (error) {
      console.error('Error deleting P&L position:', error);
      toast({
        title: 'Hata',
        description: 'Pozisyon silinirken bir hata oluştu.',
        variant: 'destructive',
      });
    }
  };

  const clearAllPositions = () => {
    try {
      setPnlPositions([]);
      localStorage.removeItem(PNL_POSITIONS_STORAGE_KEY);
      
      toast({
        title: 'Başarılı',
        description: 'Tüm pozisyonlar ve cache temizlendi.',
      });
    } catch (error) {
      console.error('Error clearing positions:', error);
      toast({
        title: 'Hata',
        description: 'Pozisyonlar temizlenirken bir hata oluştu.',
        variant: 'destructive',
      });
    }
  };

  // Calculate summary statistics
  const totalPositions = pnlPositions.length;
  const activePositions = pnlPositions.filter(p => !p.targetReached).length;
  const completedPositions = pnlPositions.filter(p => p.targetReached === true).length;
  const uniqueTokens = [...new Set(pnlPositions.map(p => p.tokenSymbol))];
  
  // Calculate P&L based on position type
  const calculatePositionPnL = (position: PnLPosition) => {
    if (!position.currentPrice) return 0;
    
    const currentValue = position.quantity * position.currentPrice;
    const entryValue = position.quantity * position.entryPrice;
    
    switch (position.positionType) {
      case 'long':
        return currentValue - entryValue; // Profit when price goes up
      case 'short':
        return entryValue - currentValue; // Profit when price goes down
      case 'spot':
      default:
        return currentValue - entryValue; // Standard spot calculation
    }
  };

  const totalUnrealizedPnL = pnlPositions.reduce((sum, position) => {
    return sum + calculatePositionPnL(position);
  }, 0);

  // Additional statistics for compact card
  const completionRate = totalPositions > 0 ? (completedPositions / totalPositions) * 100 : 0;
  
  // Debug completion rate
  console.log('P&L Debug:', {
    totalPositions,
    completedPositions,
    completionRate,
    positions: pnlPositions.map(p => ({
      symbol: p.tokenSymbol,
      targetReached: p.targetReached,
      currentPrice: p.currentPrice,
      sellTarget: p.sellTarget,
      id: p.id
    })),
    rawPositions: pnlPositions
  });
  
  // Find position closest to target
  const closestToTarget = pnlPositions
    .filter(p => p.targetReached !== true && p.currentPrice && p.currentPrice > 0)
    .map(p => {
      const progressPercent = p.positionType === 'short'
        ? ((p.entryPrice - p.currentPrice!) / (p.entryPrice - p.sellTarget)) * 100
        : (p.currentPrice! / p.sellTarget) * 100;
      return { symbol: p.tokenSymbol, progress: Math.max(0, progressPercent), type: p.positionType };
    })
    .sort((a, b) => b.progress - a.progress)[0];

  // Average P&L percentage
  const avgPnLPercent = pnlPositions.length > 0 
    ? pnlPositions.reduce((sum, p) => {
        if (!p.currentPrice) return sum;
        const percent = ((p.currentPrice / p.entryPrice) - 1) * 100;
        return sum + percent;
      }, 0) / pnlPositions.filter(p => p.currentPrice).length
    : 0;

  // Total invested amount
  const totalInvested = pnlPositions.reduce((sum, p) => sum + (p.quantity * p.entryPrice), 0);

  return (
    <>
      {/* Compact Summary Card */}
      <Card 
        className="p-3 gradient-card border-order-green/30 glow-order cursor-pointer hover:border-order-green/50 transition-all"
        onClick={() => setShowDialog(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-order-green animate-pulse-slow" />
            <h3 className="text-base font-bold text-foreground">P&L Tracker</h3>
            {totalPositions > 0 && (
              <span className="text-xs bg-order-green/10 text-order-green px-2 py-1 rounded border border-order-green/30">
                {totalPositions} pozisyon
              </span>
            )}
          </div>
          <Eye className="w-4 h-4 text-muted-foreground" />
        </div>

        {totalPositions > 0 ? (
          <div className="mt-3 space-y-3">
            {/* Token Logos & Completion Rate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-2">Tokenler:</span>
                <div className="flex items-center -space-x-1">
                  {uniqueTokens.slice(0, 4).map((tokenSymbol) => {
                    const position = pnlPositions.find(p => p.tokenSymbol === tokenSymbol);
                    return (
                      <img 
                        key={tokenSymbol}
                        src={position?.tokenLogo} 
                        alt={tokenSymbol}
                        className="w-6 h-6 rounded-full ring-2 ring-background"
                      />
                    );
                  })}
                  {uniqueTokens.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-xs font-bold text-muted-foreground">
                      +{uniqueTokens.length - 4}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Completion Rate */}
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Tamamlanma</p>
                <div className="flex items-center gap-1">
                  <p className={`text-sm font-bold ${
                    completionRate >= 50 ? 'text-order-green' : 
                    completionRate >= 25 ? 'text-yellow-500' : 'text-muted-foreground'
                  }`} title={`${completedPositions}/${totalPositions} tamamlandı`}>
                    {completionRate.toFixed(0)}%
                  </p>
                  <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        completionRate >= 50 ? 'bg-order-green' : 
                        completionRate >= 25 ? 'bg-yellow-500' : 'bg-muted-foreground'
                      }`}
                      style={{ width: `${Math.min(completionRate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Aktif</p>
                <p className="text-sm font-bold text-corporate-blue">{activePositions}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tamamlanan</p>
                <p className="text-sm font-bold text-order-green">{completedPositions}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ort. K/Z</p>
                <p className={`text-sm font-bold ${
                  avgPnLPercent >= 0 ? 'text-order-green' : 'text-red-500'
                }`}>
                  {avgPnLPercent >= 0 ? '+' : ''}{avgPnLPercent.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Yatırım</p>
                <p className="text-sm font-bold text-muted-foreground">
                  ${totalInvested.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {/* P&L Summary & Closest Target */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div>
                <p className="text-xs text-muted-foreground">Toplam K/Z</p>
                <div className="flex items-center gap-1">
                  <p className={`text-sm font-bold ${totalUnrealizedPnL >= 0 ? 'text-order-green' : 'text-red-500'}`}>
                    {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                  </p>
                  {totalUnrealizedPnL !== 0 && (
                    totalUnrealizedPnL > 0 ? (
                      <TrendingUp className="w-3 h-3 text-order-green" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-500" />
                    )
                  )}
                </div>
                {usdToTryRate > 0 && (
                  <p className={`text-xs ${totalUnrealizedPnL >= 0 ? 'text-order-green' : 'text-red-500'}/80`}>
                    ₺{(totalUnrealizedPnL * usdToTryRate).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </p>
                )}
              </div>
              
              {/* Closest to Target */}
              {closestToTarget && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">En Yakın Hedef</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-bold text-corporate-blue">{closestToTarget.symbol}</p>
                    <Target className="w-3 h-3 text-corporate-blue" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {closestToTarget.progress.toFixed(1)}% tamamlandı
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-center py-2">
            <p className="text-sm text-muted-foreground">Henüz pozisyon eklenmemiş</p>
            <p className="text-xs text-muted-foreground mt-1">İlk pozisyonunu eklemek için tıkla</p>
          </div>
        )}
      </Card>

      {/* Full Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-order-green" />
              P&L Tracker
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <Card className="p-5 gradient-card border-order-green/30 glow-order h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-order-green animate-pulse-slow" />
          <h3 className="text-lg font-bold text-foreground">P&L Tracker</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            Cache: {totalPositions} pozisyon
          </span>
        </div>
        <div className="flex gap-2">
          {totalPositions > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearAllPositions}
              className="border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 text-red-500 hover:text-red-400"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Cache Temizle
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              if (!showPnlForm) {
                // Clear form when opening
                setPnlTokenSymbol('');
                setPnlQuantity('');
                setPnlEntryPrice('');
                setPnlSellTarget('');
                setPositionType('spot');
                setPnlNotes('');
                setFormKey(prev => prev + 1);
              }
              setShowPnlForm(!showPnlForm);
            }}
            className="bg-gradient-to-r from-order-green to-emerald-500 hover:from-order-green/90 hover:to-emerald-500/90 text-white shadow-lg shadow-order-green/30"
          >
            <Plus className="w-4 h-4 mr-1" />
            Yeni Pozisyon
          </Button>
        </div>
      </div>

      {/* P&L Position Form */}
      {showPnlForm && (
        <div className="p-4 bg-gradient-to-br from-order-green/10 via-emerald-500/10 to-green-600/10 rounded-lg border border-order-green/20 space-y-3 mb-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-order-green" />
            Yeni Pozisyon Ekle
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Token (Multisig Holdings)</Label>
              <Select key={formKey} value={pnlTokenSymbol} onValueChange={setPnlTokenSymbol}>
                <SelectTrigger>
                  <SelectValue placeholder="Token seçin" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {getEnabledTokens().map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center gap-2">
                        <img src={token.logo} alt={token.symbol} className="w-4 h-4 rounded-full" />
                        {token.symbol}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Pozisyon Türü</Label>
              <Select key={`type-${formKey}`} value={positionType} onValueChange={(value: 'spot' | 'long' | 'short') => setPositionType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tür seçin" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="spot">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span>Spot</span>
                      <span className="text-xs text-muted-foreground">(Fiyat ↗️)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="long">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-order-green rounded-full"></span>
                      <span>Long</span>
                      <span className="text-xs text-muted-foreground">(Fiyat ↗️)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="short">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span>Short</span>
                      <span className="text-xs text-muted-foreground">(Fiyat ↘️)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Adet</Label>
              <Input
                type="number"
                step="0.000001"
                value={pnlQuantity}
                onChange={(e) => setPnlQuantity(e.target.value)}
                placeholder="0.00"
                className="bg-background/50 border-order-green/30 focus:border-order-green"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Alım Fiyatı ($)</Label>
              <Input
                type="number"
                step="0.000001"
                value={pnlEntryPrice}
                onChange={(e) => setPnlEntryPrice(e.target.value)}
                placeholder="0.00"
                className="bg-background/50 border-order-green/30 focus:border-order-green"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                {positionType === 'short' ? 'Satış Hedefi ($) - Entry\'dan düşük' : 'Satış Hedefi ($) - Entry\'dan yüksek'}
              </Label>
              <Input
                type="number"
                step="0.000001"
                value={pnlSellTarget}
                onChange={(e) => setPnlSellTarget(e.target.value)}
                placeholder={positionType === 'short' ? 'Entry\'dan düşük fiyat' : 'Entry\'dan yüksek fiyat'}
                className="bg-background/50 border-order-green/30 focus:border-order-green"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Notlar (İsteğe Bağlı)</Label>
            <Textarea
              value={pnlNotes}
              onChange={(e) => setPnlNotes(e.target.value)}
              placeholder="Bu pozisyon hakkında notlarınız..."
              className="bg-background/50 border-order-green/30 focus:border-order-green h-20"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={addPnlPosition} className="flex-1 bg-order-green hover:bg-order-green/90">
              <Plus className="w-4 h-4 mr-2" />
              Pozisyon Ekle
            </Button>
            <Button variant="outline" onClick={() => {
              setPnlTokenSymbol('');
              setPnlQuantity('');
              setPnlEntryPrice('');
              setPnlSellTarget('');
              setPositionType('spot');
              setPnlNotes('');
              setFormKey(prev => prev + 1);
              setShowPnlForm(false);
            }} className="border-order-green/30 hover:bg-order-green/10">
              İptal
            </Button>
          </div>
        </div>
      )}

      {/* P&L Positions List */}
      <div className="space-y-3 flex-1 overflow-auto">
        {pnlPositions.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm text-muted-foreground">
              Henüz pozisyon eklenmemiş
            </p>
            <Button
              onClick={() => {
                // Clear form when opening
                setPnlTokenSymbol('');
                setPnlQuantity('');
                setPnlEntryPrice('');
                setPnlSellTarget('');
                setPositionType('spot');
                setPnlNotes('');
                setFormKey(prev => prev + 1);
                setShowPnlForm(true);
              }}
              className="bg-gradient-to-r from-order-green to-emerald-500 hover:from-order-green/90 hover:to-emerald-500/90 text-white shadow-lg shadow-order-green/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              İlk Pozisyonunu Ekle
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {pnlPositions.map((position) => {
              const currentPrice = position.currentPrice || 0;
              const currentValue = position.quantity * currentPrice;
              const entryValue = position.quantity * position.entryPrice;
              const targetValue = position.quantity * position.sellTarget;
              const unrealizedPnL = calculatePositionPnL(position);
              
              // Calculate percentage based on position type
              let unrealizedPercent = 0;
              let expectedPercent = 0;
              
              if (position.positionType === 'short') {
                unrealizedPercent = currentPrice > 0 ? ((position.entryPrice / currentPrice) - 1) * 100 : 0;
                expectedPercent = ((position.entryPrice / position.sellTarget) - 1) * 100;
              } else {
                unrealizedPercent = currentPrice > 0 ? ((currentPrice / position.entryPrice) - 1) * 100 : 0;
                expectedPercent = ((position.sellTarget / position.entryPrice) - 1) * 100;
              }
              
              const expectedProfit = position.positionType === 'short' 
                ? (position.entryPrice - position.sellTarget) * position.quantity
                : (position.sellTarget - position.entryPrice) * position.quantity;
              const isProfit = unrealizedPnL > 0;
              const isTargetReached = position.targetReached;
              
              return (
                <div
                  key={position.id}
                  className={`p-4 rounded-lg border transition-all group ${
                    isTargetReached 
                      ? 'bg-gradient-to-r from-order-green/20 to-emerald-500/20 border-order-green/50 shadow-lg shadow-order-green/20' 
                      : 'bg-gradient-to-r from-background to-background/80 border-border/50 hover:border-order-green/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative">
                        <img 
                          src={position.tokenLogo} 
                          alt={position.tokenSymbol}
                          className={`w-10 h-10 rounded-full ring-2 transition-all ${
                            isTargetReached 
                              ? 'ring-order-green/70 shadow-lg shadow-order-green/30' 
                              : 'ring-order-green/30 group-hover:ring-order-green/50'
                          }`}
                        />
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                          isTargetReached ? 'bg-order-green animate-pulse' : 'bg-order-green'
                        }`} />
                        {isTargetReached && (
                          <div className="absolute -top-1 -left-1 w-4 h-4 bg-order-green rounded-full flex items-center justify-center">
                            <span className="text-xs text-white font-bold">🎯</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-foreground text-lg">{position.tokenSymbol}</h4>
                          <span className={`text-xs font-bold px-2 py-1 rounded border ${
                            position.positionType === 'long' 
                              ? 'text-order-green bg-order-green/10 border-order-green/30'
                              : position.positionType === 'short'
                              ? 'text-red-500 bg-red-500/10 border-red-500/30'
                              : 'text-blue-500 bg-blue-500/10 border-blue-500/30'
                          }`}>
                            {position.positionType.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {position.quantity.toLocaleString()} adet
                          </span>
                          {isTargetReached && (
                            <span className="text-xs font-bold text-order-green bg-order-green/10 px-2 py-1 rounded border border-order-green/30 animate-pulse">
                              🎯 HEDEF ULAŞILDI!
                            </span>
                          )}
                        </div>
                        
                        {/* Current vs Entry Price */}
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Mevcut Fiyat</p>
                            <p className={`font-semibold ${currentPrice > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {currentPrice > 0 ? `$${currentPrice.toFixed(8)}` : 'Loading...'}
                            </p>
                            {position.lastUpdated && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(position.lastUpdated).toLocaleTimeString('tr-TR')}
                              </p>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Alım Fiyatı</p>
                            <p className="font-semibold text-corporate-blue">
                              ${position.entryPrice.toFixed(8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Toplam: ${entryValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Hedef Fiyat</p>
                            <p className="font-semibold text-order-green">
                              ${position.sellTarget.toFixed(8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Hedef: ${targetValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        
                        {/* P&L Section */}
                        {currentPrice > 0 && (
                          <div className="pt-2 border-t border-border/30">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Gerçekleşmemiş K/Z</p>
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold text-lg ${isProfit ? 'text-order-green' : 'text-red-500'}`}>
                                    {isProfit ? '+' : ''}${unrealizedPnL.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                                  </p>
                                  <p className={`text-sm ${isProfit ? 'text-order-green' : 'text-red-500'}`}>
                                    ({unrealizedPercent > 0 ? '+' : ''}{unrealizedPercent.toFixed(2)}%)
                                  </p>
                                  {isProfit ? (
                                    <TrendingUp className="w-4 h-4 text-order-green" />
                                  ) : (
                                    <TrendingDown className="w-4 h-4 text-red-500" />
                                  )}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground">
                                    Mevcut Değer: ${currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                                  </p>
                                  {usdToTryRate > 0 && (
                                    <p className={`text-xs ${isProfit ? 'text-order-green' : 'text-red-500'}/80`}>
                                      TRY: {formatCurrency(unrealizedPnL * usdToTryRate, 'TRY')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Beklenen Kar</p>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-order-green">
                                    +${expectedProfit.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-sm text-order-green">
                                    (+{expectedPercent.toFixed(2)}%)
                                  </p>
                                </div>
                                {usdToTryRate > 0 && (
                                  <p className="text-xs text-order-green/80">
                                    TRY: +{formatCurrency(expectedProfit * usdToTryRate, 'TRY')}
                                  </p>
                                )}
                                <div className="w-full bg-muted rounded-full h-2 mt-1">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-500 ${
                                      isTargetReached ? 'bg-order-green animate-pulse' : 
                                      position.positionType === 'short'
                                        ? currentPrice <= position.sellTarget ? 'bg-order-green' : 'bg-red-500'
                                        : currentPrice >= position.sellTarget ? 'bg-order-green' : 'bg-corporate-blue'
                                    }`}
                                    style={{ 
                                      width: position.positionType === 'short'
                                        ? `${Math.min(Math.max(((position.entryPrice - currentPrice) / (position.entryPrice - position.sellTarget)) * 100, 0), 100)}%`
                                        : `${Math.min(Math.max((currentPrice / position.sellTarget) * 100, 0), 100)}%`
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {currentPrice > 0 ? 
                                    `${((currentPrice / position.sellTarget) * 100).toFixed(1)}% hedefe` : 
                                    'Fiyat bekleniyor...'
                                  }
                                </p>
                              </div>
                            </div>
                            
                            {position.notes && (
                              <div className="mt-2 pt-2 border-t border-border/20">
                                <p className="text-xs text-muted-foreground">
                                  <strong>Notlar:</strong> {position.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const updatedPositions = pnlPositions.map(p => 
                            p.id === position.id 
                              ? { ...p, targetReached: !p.targetReached }
                              : p
                          );
                          setPnlPositions(updatedPositions);
                          localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));
                          toast({
                            title: position.targetReached ? 'Hedef kaldırıldı' : 'Hedef tamamlandı',
                            description: `${position.tokenSymbol} pozisyonu ${position.targetReached ? 'aktif' : 'tamamlandı'} olarak işaretlendi.`,
                          });
                        }}
                        className={`hover:bg-order-green/10 hover:text-order-green transition-all ${
                          position.targetReached ? 'text-order-green bg-order-green/5' : ''
                        }`}
                      >
                        <Target className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deletePnlPosition(position.id)}
                        className="hover:bg-red-500/10 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

              <div className="text-xs text-muted-foreground italic p-3 bg-order-green/5 rounded-lg border border-order-green/20 mt-4 space-y-2">
                <p>
                  💡 <strong>Geliştirilecek:</strong> Gerçek zamanlı fiyat güncellemeleri, portfolio özeti ve gelişmiş analitik özellikleri yakında eklenecek!
                </p>
                <p className="text-muted-foreground/60">
                  🔧 <strong>Debug:</strong> LocalStorage Key: '{PNL_POSITIONS_STORAGE_KEY}' | Stored: {localStorage.getItem(PNL_POSITIONS_STORAGE_KEY) ? 'Yes' : 'No'} | Count: {totalPositions}
                </p>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};