import { useState, useEffect, useCallback, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, TrendingUp, TrendingDown, Key, Wallet, AlertTriangle, RefreshCw, Activity, DollarSign, BarChart3, Settings, Eye, EyeOff } from 'lucide-react';

interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

interface FuturesBalance {
  asset: string;
  balance: string;
  availableBalance: string;
  crossWalletBalance: string;
  maxWithdrawAmount: string;
}

interface FuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  percentage: string;
  positionSide: string;
}

interface OrderData {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: string;
  price?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

// Popular USD-S Margined Futures symbols
const POPULAR_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'AVAXUSDT',
  'LINKUSDT', 'SOLUSDT', 'MATICUSDT', 'ATOMUSDT', 'LTCUSDT',
  'XRPUSDT', 'UNIUSDT', 'AAVEUSDT', 'FILUSDT', 'SUSHIUSDT',
  'COMPUSDT', 'CRVUSDT', 'YFIUSDT', 'BCHUSDT', 'EOSUSDT'
];

const BinanceTradingPanelComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [credentials, setCredentials] = useState<BinanceCredentials>({
    apiKey: '',
    apiSecret: '',
    testnet: true
  });
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<FuturesBalance[]>([]);
  const [positions, setPositions] = useState<FuturesPosition[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [orderData, setOrderData] = useState<OrderData>({
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: '0.001'
  });
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { toast } = useToast();

  // Load saved credentials from localStorage
  useEffect(() => {
    const savedCredentials = localStorage.getItem('binance-trading-credentials');
    if (savedCredentials) {
      try {
        const parsed = JSON.parse(savedCredentials);
        setCredentials(parsed);
      } catch (error) {
        console.error('Error loading credentials:', error);
      }
    }
  }, []);

  // Save credentials to localStorage
  const saveCredentials = useCallback(() => {
    try {
      localStorage.setItem('binance-trading-credentials', JSON.stringify(credentials));
      toast({
        title: "Bilgiler kaydedildi",
        description: "API bilgileri güvenli şekilde tarayıcınızda saklandı.",
      });
    } catch (error) {
      toast({
        title: "Kaydetme hatası",
        description: "API bilgileri kaydedilirken hata oluştu.",
        variant: "destructive",
      });
    }
  }, [credentials, toast]);

  // Test Binance connection
  const testConnection = useCallback(async () => {
    if (!credentials.apiKey || !credentials.apiSecret) {
      toast({
        title: "Eksik bilgiler",
        description: "Lütfen API Key ve Secret'ınızı girin.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Initialize Binance client (we'll implement this with dynamic import)
      const { USDMClient } = await import('binance');
      
      const client = new USDMClient({
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret,
        testnet: credentials.testnet,
        beautifyResponses: true,
      });

      // Test connection
      await client.testConnectivity();
      
      // Get account info to verify API keys
      const accountInfo = await client.getBalance();
      setBalances(accountInfo || []);
      
      // Get current positions
      const positionsInfo = await client.getPositions();
      const activePositions = positionsInfo.filter((pos: any) => parseFloat(pos.positionAmt) !== 0);
      setPositions(activePositions || []);
      
      setIsConnected(true);
      setLastUpdate(new Date());
      
      toast({
        title: "Bağlantı başarılı! 🎉",
        description: "Binance Futures API'ye başarıyla bağlandı.",
      });
    } catch (error: any) {
      console.error('Binance connection error:', error);
      setIsConnected(false);
      
      let errorMessage = "Bağlantı hatası oluştu.";
      if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Bağlantı hatası",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [credentials, toast]);

  // Execute trade
  const executeTrade = useCallback(async () => {
    if (!isConnected) {
      toast({
        title: "Bağlantı yok",
        description: "Önce Binance API'ye bağlanın.",
        variant: "destructive",
      });
      return;
    }

    if (!orderData.quantity || parseFloat(orderData.quantity) <= 0) {
      toast({
        title: "Geçersiz miktar",
        description: "Lütfen geçerli bir miktar girin.",
        variant: "destructive",
      });
      return;
    }

    if (orderData.type === 'LIMIT' && (!orderData.price || parseFloat(orderData.price) <= 0)) {
      toast({
        title: "Geçersiz fiyat",
        description: "Limit order için fiyat belirtmelisiniz.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { USDMClient } = await import('binance');
      
      const client = new USDMClient({
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret,
        testnet: credentials.testnet,
        beautifyResponses: true,
      });

      const orderParams: any = {
        symbol: orderData.symbol,
        side: orderData.side,
        type: orderData.type,
        quantity: orderData.quantity,
      };

      if (orderData.type === 'LIMIT') {
        orderParams.price = orderData.price;
        orderParams.timeInForce = orderData.timeInForce || 'GTC';
      }

      const result = await client.submitNewOrder(orderParams);
      
      // Refresh positions and balances
      const [updatedBalances, updatedPositions] = await Promise.all([
        client.getBalance(),
        client.getPositions()
      ]);
      
      setBalances(updatedBalances || []);
      const activePositions = updatedPositions.filter((pos: any) => parseFloat(pos.positionAmt) !== 0);
      setPositions(activePositions || []);
      setLastUpdate(new Date());

      const action = orderData.side === 'BUY' ? 'Long' : 'Short';
      const orderType = orderData.type === 'MARKET' ? 'Market' : `Limit @ ${orderData.price}`;
      
      toast({
        title: `${action} Position Açıldı! 🚀`,
        description: `${orderData.symbol} ${orderType} - Miktar: ${orderData.quantity}`,
      });
    } catch (error: any) {
      console.error('Trade execution error:', error);
      
      let errorMessage = "İşlem gerçekleştirilemedi.";
      if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "İşlem hatası",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isConnected, orderData, credentials, toast]);

  // Refresh data
  const refreshData = useCallback(async () => {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      const { USDMClient } = await import('binance');
      
      const client = new USDMClient({
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret,
        testnet: credentials.testnet,
        beautifyResponses: true,
      });

      const [updatedBalances, updatedPositions] = await Promise.all([
        client.getBalance(),
        client.getPositions()
      ]);
      
      setBalances(updatedBalances || []);
      const activePositions = updatedPositions.filter((pos: any) => parseFloat(pos.positionAmt) !== 0);
      setPositions(activePositions || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setLoading(false);
    }
  }, [isConnected, credentials]);

  return (
    <Card className="p-4 gradient-card border-amber-500/30 glow-amber">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-foreground">Binance Trading Panel</h3>
              {isConnected && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-green-500/50">
                  <Activity className="w-3 h-3 mr-1" />
                  Live
                </Badge>
              )}
              {credentials.testnet && (
                <Badge variant="outline" className="text-orange-500 border-orange-500/50">
                  Testnet
                </Badge>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-4">
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Güvenlik Uyarısı:</strong> API bilgileri sadece tarayıcınızda saklanır. 
              Testnet kullanmanızı öneririz. Real trading için kendi riskinizi alın!
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="setup">
                <Key className="w-4 h-4 mr-1" />
                Setup
              </TabsTrigger>
              <TabsTrigger value="trading">
                <DollarSign className="w-4 h-4 mr-1" />
                Trading
              </TabsTrigger>
              <TabsTrigger value="positions">
                <TrendingUp className="w-4 h-4 mr-1" />
                Positions
              </TabsTrigger>
            </TabsList>

            {/* Setup Tab */}
            <TabsContent value="setup" className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="text"
                    placeholder="Binance API Key'inizi girin..."
                    value={credentials.apiKey}
                    onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-secret">API Secret</Label>
                  <div className="relative">
                    <Input
                      id="api-secret"
                      type={showApiSecret ? "text" : "password"}
                      placeholder="Binance API Secret'ınızı girin..."
                      value={credentials.apiSecret}
                      onChange={(e) => setCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiSecret(!showApiSecret)}
                    >
                      {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="testnet"
                    checked={credentials.testnet}
                    onChange={(e) => setCredentials(prev => ({ ...prev, testnet: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="testnet" className="text-sm">
                    Testnet kullan (Önerilen)
                  </Label>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={saveCredentials}
                    variant="outline"
                    className="flex-1"
                    disabled={!credentials.apiKey || !credentials.apiSecret}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Kaydet
                  </Button>
                  <Button
                    onClick={testConnection}
                    disabled={loading || !credentials.apiKey || !credentials.apiSecret}
                    className="flex-1"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4 mr-2" />
                    )}
                    {loading ? 'Bağlanıyor...' : 'Bağlan'}
                  </Button>
                </div>
              </div>

              {/* Connection Status & Account Info */}
              {isConnected && balances.length > 0 && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <h4 className="font-semibold text-green-500 mb-2 flex items-center">
                    <Wallet className="w-4 h-4 mr-2" />
                    Futures Wallet Bakiyeleri
                  </h4>
                  <div className="space-y-1">
                    {balances.filter(b => parseFloat(b.balance) > 0).map((balance) => (
                      <div key={balance.asset} className="flex justify-between text-sm">
                        <span className="font-medium">{balance.asset}</span>
                        <span>{parseFloat(balance.availableBalance).toFixed(4)} / {parseFloat(balance.balance).toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                  {lastUpdate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Trading Tab */}
            <TabsContent value="trading" className="space-y-4">
              {!isConnected ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Trading yapmak için önce Setup sekmesinden API bağlantısı yapın.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Symbol</Label>
                      <Select
                        value={selectedSymbol}
                        onValueChange={(value) => {
                          setSelectedSymbol(value);
                          setOrderData(prev => ({ ...prev, symbol: value }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto">
                          {POPULAR_SYMBOLS.map((symbol) => (
                            <SelectItem key={symbol} value={symbol}>
                              {symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setOrderData(prev => ({ ...prev, side: 'BUY' }))}
                        variant={orderData.side === 'BUY' ? 'default' : 'outline'}
                        className={orderData.side === 'BUY' ? 'bg-green-500 hover:bg-green-600' : ''}
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Long (BUY)
                      </Button>
                      <Button
                        onClick={() => setOrderData(prev => ({ ...prev, side: 'SELL' }))}
                        variant={orderData.side === 'SELL' ? 'default' : 'outline'}
                        className={orderData.side === 'SELL' ? 'bg-red-500 hover:bg-red-600' : ''}
                      >
                        <TrendingDown className="w-4 h-4 mr-2" />
                        Short (SELL)
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Order Type</Label>
                      <Select
                        value={orderData.type}
                        onValueChange={(value: 'MARKET' | 'LIMIT') => setOrderData(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MARKET">Market Order</SelectItem>
                          <SelectItem value="LIMIT">Limit Order</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="0.001"
                        value={orderData.quantity}
                        onChange={(e) => setOrderData(prev => ({ ...prev, quantity: e.target.value }))}
                      />
                    </div>

                    {orderData.type === 'LIMIT' && (
                      <div className="space-y-2">
                        <Label>Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="45000.00"
                          value={orderData.price || ''}
                          onChange={(e) => setOrderData(prev => ({ ...prev, price: e.target.value }))}
                        />
                      </div>
                    )}

                    <Button
                      onClick={executeTrade}
                      disabled={loading}
                      className={`w-full ${orderData.side === 'BUY' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Activity className="w-4 h-4 mr-2" />
                      )}
                      {orderData.side === 'BUY' ? 'Long Position Aç' : 'Short Position Aç'}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold">Açık Pozisyonlar</h4>
                {isConnected && (
                  <Button
                    onClick={refreshData}
                    size="sm"
                    variant="outline"
                    disabled={loading}
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>

              {positions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Henüz açık pozisyon yok</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.map((position, index) => {
                    const pnlValue = parseFloat(position.unRealizedProfit);
                    const isProfitable = pnlValue >= 0;
                    const positionSide = parseFloat(position.positionAmt) > 0 ? 'LONG' : 'SHORT';
                    
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${isProfitable ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{position.symbol}</span>
                            <Badge
                              variant={positionSide === 'LONG' ? 'default' : 'secondary'}
                              className={positionSide === 'LONG' ? 'bg-green-500' : 'bg-red-500'}
                            >
                              {positionSide}
                            </Badge>
                          </div>
                          <div className={`text-sm font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfitable ? '+' : ''}{pnlValue.toFixed(4)} USDT
                          </div>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Size:</span>
                            <span>{Math.abs(parseFloat(position.positionAmt)).toFixed(6)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Entry Price:</span>
                            <span>{parseFloat(position.entryPrice).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mark Price:</span>
                            <span>{parseFloat(position.markPrice).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">ROE:</span>
                            <span className={isProfitable ? 'text-green-500' : 'text-red-500'}>
                              {position.percentage ? parseFloat(position.percentage).toFixed(2) : '0.00'}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="text-xs text-muted-foreground border-t pt-2">
            <p><strong>Not:</strong> Bu panel Binance USD-S Margined Futures API kullanır.</p>
            <p>• API bilgileriniz sadece tarayıcınızda saklanır</p>
            <p>• Testnet kullanarak güvenle test edebilirsiniz</p>
            <p>• Real trading kendi riskinizdir</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export const BinanceTradingPanel = memo(BinanceTradingPanelComponent);