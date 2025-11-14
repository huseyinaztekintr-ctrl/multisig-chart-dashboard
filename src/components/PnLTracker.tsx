import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Plus, Trash2, BarChart3, Target, Eye, RefreshCw, Bell, Volume2, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getEnabledTokens } from './TokenManager';
import { fetchDexScreenerPrice } from '@/utils/blockchain';
import { formatCurrency } from '@/utils/currency';

const PNL_POSITIONS_STORAGE_KEY = 'order-pnl-positions-v2';

// Sayı formatlama fonksiyonu
const formatNumber = (num: number, decimals = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

interface PnLPosition {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenPairAddress?: string;
  tokenLogo: string;
  quantity: number;
  entryPrice: number;
  positionType: 'LONG' | 'SHORT';
  targets: {
    takeProfit?: number;
    stopLoss?: number;
  };
  notes?: string;
  createdAt: string;
  currentPrice?: number;
  lastUpdated?: string;
  targetReached?: boolean;
  alertsEnabled: boolean;
  alarmSound: boolean;
  pnlPercentage?: number;
  pnlAmount?: number;
  status: 'ACTIVE' | 'CLOSED' | 'ALARM_TRIGGERED';
}

export const PnLTracker = () => {
  const { toast } = useToast();
  const [pnlPositions, setPnlPositions] = useState<PnLPosition[]>([]);
  const [showPnlForm, setShowPnlForm] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  // P&L form states
  const [pnlTokenSymbol, setPnlTokenSymbol] = useState('');
  const [pnlQuantity, setPnlQuantity] = useState('');
  const [pnlEntryPrice, setPnlEntryPrice] = useState('');
  const [pnlPositionType, setPnlPositionType] = useState<'LONG' | 'SHORT'>('LONG');
  const [pnlTakeProfit, setPnlTakeProfit] = useState('');
  const [pnlStopLoss, setPnlStopLoss] = useState('');
  const [pnlNotes, setPnlNotes] = useState('');
  const [pnlAlertsEnabled, setPnlAlertsEnabled] = useState(true);
  const [pnlAlarmSound, setPnlAlarmSound] = useState(true);

  // Load P&L positions from localStorage with migration
  useEffect(() => {
    // Eski storage key'lerini kontrol et
    const oldKey1 = 'order-pnl-positions';
    const oldKey2 = 'order-pnl-positions-v1';
    
    let savedPnlPositions = localStorage.getItem(PNL_POSITIONS_STORAGE_KEY);
    
    // Yeni key'de veri yoksa, eski key'leri kontrol et
    if (!savedPnlPositions) {
      const oldData1 = localStorage.getItem(oldKey1);
      const oldData2 = localStorage.getItem(oldKey2);
      
      savedPnlPositions = oldData2 || oldData1;
      
      // Eski verileri temizle
      if (savedPnlPositions) {
        localStorage.removeItem(oldKey1);
        localStorage.removeItem(oldKey2);
      }
    }
    
    if (savedPnlPositions) {
      try {
        const parsed = JSON.parse(savedPnlPositions);
        
        // Eski format veriyi yeni formata migrate et
        const migratedPositions = parsed.map((position: Partial<PnLPosition> & { sellTarget?: number }) => {
          // Eski format kontrolü
          if (position.sellTarget && !position.positionType) {
            return {
              ...position,
              positionType: 'LONG', // Eski veriler sadece LONG olabilir
              targets: {
                takeProfit: position.sellTarget,
                stopLoss: undefined
              },
              alertsEnabled: true,
              alarmSound: true,
              status: position.targetReached ? 'ALARM_TRIGGERED' : 'ACTIVE',
              pnlPercentage: 0,
              pnlAmount: 0
            };
          }
          
          // Eksik alanları tamamla
          return {
            ...position,
            positionType: position.positionType || 'LONG',
            targets: position.targets || {},
            alertsEnabled: position.alertsEnabled ?? true,
            alarmSound: position.alarmSound ?? true,
            status: position.status || (position.targetReached ? 'ALARM_TRIGGERED' : 'ACTIVE'),
            pnlPercentage: position.pnlPercentage || 0,
            pnlAmount: position.pnlAmount || 0
          };
        });
        
        setPnlPositions(migratedPositions);
        
        // Migrate edilmiş veriyi kaydet
        localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(migratedPositions));
        
        console.log('P&L positions migrated to new format:', migratedPositions.length);
        
      } catch (error) {
        console.error('Error parsing saved P&L positions:', error);
        // Hatalı veriyi temizle
        localStorage.removeItem(PNL_POSITIONS_STORAGE_KEY);
      }
    }
  }, []);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // P&L hesaplama fonksiyonu
  const calculatePnL = useCallback((position: PnLPosition, currentPrice: number) => {
    if (!currentPrice || currentPrice <= 0) return { percentage: 0, amount: 0 };

    const priceDifference = position.positionType === 'LONG' 
      ? currentPrice - position.entryPrice 
      : position.entryPrice - currentPrice;
    
    const percentage = (priceDifference / position.entryPrice) * 100;
    const amount = (priceDifference * position.quantity);

    return { percentage, amount };
  }, []);

  // Alarm tetikleme fonksiyonu
  const triggerAlarm = useCallback((position: PnLPosition, targetType: 'takeProfit' | 'stopLoss', currentPrice: number) => {
    // Alarm sesi çal
    if (position.alarmSound) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmYdBDWK0/DSfCwFJnjH8N2QQAoUXrTp66hVFApGn+DyvmYdBDWK0/DSfCwFJnjH8N2QQAoUXrTp66hVFApGn+DyvmYdBDWK0/DSfCwFJnjH8N2QQAoUXrTp66hVFApGn+DyvmYdBDWK0/DSfCwFJnjH8N2QQAoUXrTp66hVFApGn+DyvmYdBDWK0/DSfCwF');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ses çalamazsa hata verme
    }

    const targetPrice = targetType === 'takeProfit' ? position.targets.takeProfit : position.targets.stopLoss;
    const isProfit = (position.positionType === 'LONG' && targetType === 'takeProfit') || 
                     (position.positionType === 'SHORT' && targetType === 'takeProfit');
    
    toast({
      title: isProfit ? '🎯 Take Profit Tetiklendi!' : '⚠️ Stop Loss Tetiklendi!',
      description: `${position.tokenSymbol} ${position.positionType} - Hedef: $${formatNumber(targetPrice, 4)} | Mevcut: $${formatNumber(currentPrice, 4)}`,
      variant: isProfit ? 'default' : 'destructive',
    });

    // Browser notification (eğer izin verilmişse)
    if (Notification.permission === 'granted') {
      new Notification(`${position.tokenSymbol} ${targetType === 'takeProfit' ? 'Take Profit' : 'Stop Loss'}`, {
        body: `${position.positionType} pozisyonu tetiklendi - $${formatNumber(currentPrice, 4)}`,
        icon: position.tokenLogo,
      });
    }
  }, [toast]);

  // Enhanced price monitoring with alarm system
  useEffect(() => {
    const checkPnlAlerts = async () => {
      if (pnlPositions.length === 0) return;

      const updatedPositions = [...pnlPositions];
      let hasUpdates = false;

      for (let i = 0; i < updatedPositions.length; i++) {
        const position = updatedPositions[i];
        if (position.status !== 'ACTIVE') continue;

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

          // Calculate P&L
          const pnl = calculatePnL(position, tokenPrice);

          // Update current price and P&L
          updatedPositions[i].currentPrice = tokenPrice;
          updatedPositions[i].pnlPercentage = pnl.percentage;
          updatedPositions[i].pnlAmount = pnl.amount;
          updatedPositions[i].lastUpdated = new Date().toISOString();
          hasUpdates = true;

          // Check alarm conditions
          if (position.alertsEnabled && !position.targetReached) {
            // Take Profit check
            if (position.targets.takeProfit) {
              const tpTriggered = position.positionType === 'LONG' 
                ? tokenPrice >= position.targets.takeProfit
                : tokenPrice <= position.targets.takeProfit;
              
              if (tpTriggered) {
                updatedPositions[i].status = 'ALARM_TRIGGERED';
                updatedPositions[i].targetReached = true;
                
                triggerAlarm(position, 'takeProfit', tokenPrice);
                continue;
              }
            }

            // Stop Loss check
            if (position.targets.stopLoss) {
              const slTriggered = position.positionType === 'LONG'
                ? tokenPrice <= position.targets.stopLoss
                : tokenPrice >= position.targets.stopLoss;
              
              if (slTriggered) {
                updatedPositions[i].status = 'ALARM_TRIGGERED';
                updatedPositions[i].targetReached = true;
                
                triggerAlarm(position, 'stopLoss', tokenPrice);
                continue;
              }
            }
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

    const interval = setInterval(checkPnlAlerts, 10000); // Check every 10 seconds
    checkPnlAlerts(); // Initial check

    return () => clearInterval(interval);
  }, [pnlPositions, triggerAlarm, calculatePnL]);

  const addPnlPosition = () => {
    if (!pnlTokenSymbol || !pnlQuantity || !pnlEntryPrice) {
      toast({
        title: 'Hata',
        description: 'Lütfen token, adet ve giriş fiyatı alanlarını doldurun.',
        variant: 'destructive',
      });
      return;
    }

    const quantity = parseFloat(pnlQuantity);
    const entryPrice = parseFloat(pnlEntryPrice);
    const takeProfit = pnlTakeProfit ? parseFloat(pnlTakeProfit) : undefined;
    const stopLoss = pnlStopLoss ? parseFloat(pnlStopLoss) : undefined;

    if (isNaN(quantity) || quantity <= 0) {
      toast({ title: 'Hata', description: 'Geçerli bir adet giriniz.', variant: 'destructive' });
      return;
    }

    if (isNaN(entryPrice) || entryPrice <= 0) {
      toast({ title: 'Hata', description: 'Geçerli bir giriş fiyatı giriniz.', variant: 'destructive' });
      return;
    }

    // Validate targets based on position type
    if (pnlPositionType === 'LONG') {
      if (takeProfit && takeProfit <= entryPrice) {
        toast({ title: 'Hata', description: 'LONG pozisyon için Take Profit giriş fiyatından yüksek olmalı.', variant: 'destructive' });
        return;
      }
      if (stopLoss && stopLoss >= entryPrice) {
        toast({ title: 'Hata', description: 'LONG pozisyon için Stop Loss giriş fiyatından düşük olmalı.', variant: 'destructive' });
        return;
      }
    } else { // SHORT
      if (takeProfit && takeProfit >= entryPrice) {
        toast({ title: 'Hata', description: 'SHORT pozisyon için Take Profit giriş fiyatından düşük olmalı.', variant: 'destructive' });
        return;
      }
      if (stopLoss && stopLoss <= entryPrice) {
        toast({ title: 'Hata', description: 'SHORT pozisyon için Stop Loss giriş fiyatından yüksek olmalı.', variant: 'destructive' });
        return;
      }
    }

    const selectedToken = getEnabledTokens().find(t => t.symbol === pnlTokenSymbol);
    if (!selectedToken) {
      toast({ title: 'Hata', description: 'Seçilen token bulunamadı.', variant: 'destructive' });
      return;
    }

    const newPosition: PnLPosition = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tokenSymbol: pnlTokenSymbol,
      tokenAddress: selectedToken.address,
      tokenPairAddress: selectedToken.pairAddress || undefined,
      tokenLogo: selectedToken.logo,
      quantity,
      entryPrice,
      positionType: pnlPositionType,
      targets: { takeProfit, stopLoss },
      notes: pnlNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      targetReached: false,
      alertsEnabled: pnlAlertsEnabled,
      alarmSound: pnlAlarmSound,
      currentPrice: 0,
      status: 'ACTIVE',
    };

    const updatedPositions = [...pnlPositions, newPosition];
    setPnlPositions(updatedPositions);
    localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));

    // Reset form
    setPnlTokenSymbol('');
    setPnlQuantity('');
    setPnlEntryPrice('');
    setPnlPositionType('LONG');
    setPnlTakeProfit('');
    setPnlStopLoss('');
    setPnlNotes('');
    setPnlAlertsEnabled(true);
    setPnlAlarmSound(true);

    toast({
      title: `${pnlPositionType} Pozisyon Eklendi! 🎯`,
      description: `${pnlTokenSymbol} - ${quantity} adet @ $${entryPrice}`,
    });

    setShowPnlForm(false);
  };

  const closePosition = (positionId: string) => {
    const updatedPositions = pnlPositions.map(p => 
      p.id === positionId 
        ? { ...p, status: 'CLOSED' as const, lastUpdated: new Date().toISOString() }
        : p
    );
    setPnlPositions(updatedPositions);
    localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));

    const closedPosition = pnlPositions.find(p => p.id === positionId);
    if (closedPosition) {
      toast({
        title: '✅ Pozisyon Kapatıldı',
        description: `${closedPosition.tokenSymbol} ${closedPosition.positionType} pozisyonu kapatıldı.`,
      });
    }
  };

  const deletePnlPosition = (id: string) => {
    console.log('=== DELETE POSITION DEBUG ===');
    console.log('Attempting to delete position with ID:', id);
    console.log('Current positions before filter:', pnlPositions.map(p => ({ 
      id: p.id, 
      symbol: p.tokenSymbol,
      idType: typeof p.id,
      idLength: p.id?.length 
    })));
    
    // String olarak karşılaştır
    const updatedPositions = pnlPositions.filter(p => String(p.id) !== String(id));
    
    console.log('Updated positions after filter:', updatedPositions.map(p => ({ 
      id: p.id, 
      symbol: p.tokenSymbol 
    })));
    console.log('Positions removed:', pnlPositions.length - updatedPositions.length);
    
    if (pnlPositions.length === updatedPositions.length) {
      console.log('ERROR: No position was removed! ID mismatch detected.');
      console.log('Available IDs:', pnlPositions.map(p => `"${p.id}"`));
      console.log('Requested ID:', `"${id}"`);
      
      toast({
        title: 'Silme Hatası',
        description: 'Pozisyon bulunamadı. Tümünü Sil butonunu kullanın.',
        variant: 'destructive',
      });
      return;
    }
    
    setPnlPositions(updatedPositions);
    localStorage.setItem(PNL_POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));
    
    console.log('Position successfully deleted and saved to localStorage');
    console.log('=== END DELETE DEBUG ===');
    
    toast({
      title: 'Pozisyon Silindi',
      description: `Pozisyon başarıyla silindi. Kalan: ${updatedPositions.length} pozisyon.`,
    });
  };

  const clearAllPositions = () => {
    // Tüm localStorage'ı temizle
    const keysToRemove = [
      PNL_POSITIONS_STORAGE_KEY,
      'order-pnl-positions',
      'order-pnl-positions-v1',
      'order-pnl-positions-v2'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed localStorage key: ${key}`);
    });
    
    // State'i sıfırla
    setPnlPositions([]);
    
    console.log('All positions cleared, localStorage cleaned');
    
    toast({
      title: 'Tüm Pozisyonlar Temizlendi',
      description: 'Tüm pozisyonlar ve cache tamamen temizlendi. Sayfa yenilenecek.',
    });
    
    // Sayfayı yenile
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Stats calculations
  const totalPositions = pnlPositions.length;
  const activePositions = pnlPositions.filter(p => p.status === 'ACTIVE').length;
  const closedPositions = pnlPositions.filter(p => p.status === 'CLOSED').length;
  const alarmTriggeredPositions = pnlPositions.filter(p => p.status === 'ALARM_TRIGGERED').length;
  
  const totalPnL = pnlPositions
    .filter(p => p.pnlAmount !== undefined)
    .reduce((sum, p) => sum + (p.pnlAmount || 0), 0);

  const longPositions = pnlPositions.filter(p => p.positionType === 'LONG' && p.status === 'ACTIVE').length;
  const shortPositions = pnlPositions.filter(p => p.positionType === 'SHORT' && p.status === 'ACTIVE').length;

  return (
    <>
      {/* Compact Summary Card */}
      <Card 
        className="p-3 gradient-card border-order-green/30 glow-order cursor-pointer hover:border-order-green/50 transition-all"
        onClick={() => setShowDialog(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-order-green" />
            <span className="text-sm font-medium text-foreground">P&L Tracker</span>
            {totalPositions > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activePositions}A / {closedPositions}C / {alarmTriggeredPositions}T
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {longPositions > 0 && (
              <Badge variant="outline" className="text-green-500 border-green-500/50">
                {longPositions} LONG
              </Badge>
            )}
            {shortPositions > 0 && (
              <Badge variant="outline" className="text-red-500 border-red-500/50">
                {shortPositions} SHORT
              </Badge>
            )}
            <span className={totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}>
              {totalPnL >= 0 ? '+' : ''}${formatNumber(totalPnL)}
            </span>
            <Eye className="w-3 h-3" />
          </div>
        </div>
      </Card>

      {/* Main Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-order-green" />
              Long/Short P&L Tracker
              <Badge variant="secondary">{totalPositions} Pozisyon</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Add Position Button */}
            <div className="flex justify-between items-center">
              <div className="flex gap-4 text-sm">
                <span>Aktif: <strong className="text-blue-500">{activePositions}</strong></span>
                <span>Kapalı: <strong className="text-gray-500">{closedPositions}</strong></span>
                <span>Alarm: <strong className="text-orange-500">{alarmTriggeredPositions}</strong></span>
                <span className={`font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  P&L: {totalPnL >= 0 ? '+' : ''}${formatNumber(totalPnL)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllPositions}
                  className="gap-2 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Tümünü Sil
                </Button>
                <Button onClick={() => setShowPnlForm(!showPnlForm)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Pozisyon Ekle
                </Button>
              </div>
            </div>

            {/* Add Position Form */}
            {showPnlForm && (
              <Card className="p-4 border-dashed">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <Label>Token</Label>
                    <Select value={pnlTokenSymbol} onValueChange={setPnlTokenSymbol}>
                      <SelectTrigger>
                        <SelectValue placeholder="Token seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {getEnabledTokens().map((token) => (
                          <SelectItem key={token.symbol} value={token.symbol}>
                            {token.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Pozisyon Tipi</Label>
                    <Select value={pnlPositionType} onValueChange={(value: 'LONG' | 'SHORT') => setPnlPositionType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LONG">LONG</SelectItem>
                        <SelectItem value="SHORT">SHORT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Adet</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="0.001"
                      value={pnlQuantity}
                      onChange={(e) => setPnlQuantity(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Giriş Fiyatı ($)</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="0.00"
                      value={pnlEntryPrice}
                      onChange={(e) => setPnlEntryPrice(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Take Profit ($)</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="0.00"
                      value={pnlTakeProfit}
                      onChange={(e) => setPnlTakeProfit(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Stop Loss ($)</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="0.00"
                      value={pnlStopLoss}
                      onChange={(e) => setPnlStopLoss(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={pnlAlertsEnabled} onCheckedChange={setPnlAlertsEnabled} />
                      <Label className="text-sm">Alarmlar</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={pnlAlarmSound} onCheckedChange={setPnlAlarmSound} />
                      <Label className="text-sm">Ses</Label>
                    </div>
                  </div>

                  <div>
                    <Button onClick={addPnlPosition} className="w-full">
                      Ekle
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Notlar</Label>
                  <Textarea
                    placeholder="Pozisyon notları..."
                    value={pnlNotes}
                    onChange={(e) => setPnlNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </Card>
            )}

            {/* Positions List */}
            <div className="space-y-3">
              {pnlPositions.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Henüz pozisyon eklenmemiş.</p>
                  <p className="text-sm">Long veya Short pozisyon ekleyerek başlayın.</p>
                </Card>
              ) : (
                pnlPositions.map((position) => {
                  const currentPrice = position.currentPrice || 0;
                  const pnlPercentage = position.pnlPercentage || 0;
                  const pnlAmount = position.pnlAmount || 0;
                  const isProfitable = pnlAmount > 0;

                  return (
                    <Card key={position.id} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                        {/* Token Info */}
                        <div className="flex items-center gap-3">
                          <img src={position.tokenLogo} alt={position.tokenSymbol} className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{position.tokenSymbol}</span>
                              <Badge 
                                variant={position.positionType === 'LONG' ? 'default' : 'destructive'}
                                className={`text-xs ${position.positionType === 'LONG' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}
                              >
                                {position.positionType}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {position.quantity} @ ${position.entryPrice}
                            </div>
                          </div>
                        </div>

                        {/* Current Price */}
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Mevcut</div>
                          <div className="font-medium">${formatNumber(currentPrice, 4)}</div>
                        </div>

                        {/* P&L */}
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">P&L</div>
                          <div className={`font-medium ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfitable ? '+' : ''}${formatNumber(pnlAmount)}
                          </div>
                          <div className={`text-xs ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfitable ? '+' : ''}{formatNumber(pnlPercentage)}%
                          </div>
                        </div>

                        {/* Targets */}
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Hedefler</div>
                          {position.targets.takeProfit && (
                            <div className="text-xs text-green-500">TP: ${formatNumber(position.targets.takeProfit, 4)}</div>
                          )}
                          {position.targets.stopLoss && (
                            <div className="text-xs text-red-500">SL: ${formatNumber(position.targets.stopLoss, 4)}</div>
                          )}
                        </div>

                        {/* Status & Alerts */}
                        <div className="text-center">
                          <Badge 
                            variant={position.status === 'ACTIVE' ? 'default' : position.status === 'CLOSED' ? 'secondary' : 'destructive'}
                            className="mb-1"
                          >
                            {position.status}
                          </Badge>
                          <div className="flex justify-center gap-1">
                            {position.alertsEnabled && (
                              <Bell className="w-3 h-3 text-blue-500" />
                            )}
                            {position.alarmSound && (
                              <Volume2 className="w-3 h-3 text-purple-500" />
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2">
                          {position.status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => closePosition(position.id)}
                              className="gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Kapat
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deletePnlPosition(position.id)}
                            className="gap-1 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                            Sil
                          </Button>
                        </div>
                      </div>

                      {/* Notes */}
                      {position.notes && (
                        <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                          {position.notes}
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PnLTracker;