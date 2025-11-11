import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, Save, ChevronDown, Target } from 'lucide-react';
import { toast } from 'sonner';
import { getEnabledTokens, MultisigToken } from '@/components/TokenManager';
import { useSelectedToken, SelectedMultisigToken } from '@/hooks/useSelectedToken';

export const MultisigTokenSelector = () => {
  const { selectedToken, setSelectedToken } = useSelectedToken();
  const [availableTokens, setAvailableTokens] = useState<MultisigToken[]>([]);
  const [maxSupply, setMaxSupply] = useState<string>(selectedToken.maxSupply.toString());
  const [isOpen, setIsOpen] = useState(false);

  // Load available tokens
  useEffect(() => {
    const loadTokens = () => {
      const tokens = getEnabledTokens();
      setAvailableTokens(tokens);
    };

    loadTokens();
    
    // Listen for token updates from TokenManager
    const handleTokensUpdate = () => loadTokens();
    window.addEventListener('tokens-updated', handleTokensUpdate);
    
    return () => window.removeEventListener('tokens-updated', handleTokensUpdate);
  }, []);

  const handleTokenSelect = (tokenId: string) => {
    const token = availableTokens.find(t => t.id === tokenId);
    if (!token) return;

    const newSelectedToken: SelectedMultisigToken = {
      ...token,
      maxSupply: parseFloat(maxSupply) || selectedToken.maxSupply,
    };

    setSelectedToken(newSelectedToken);
    toast.success(`${token.symbol} token seçildi! Sistem güncelleniyor...`);
  };

  const handleMaxSupplyChange = (value: string) => {
    setMaxSupply(value);
    const supply = parseFloat(value);
    if (supply && supply > 0) {
      setSelectedToken({
        ...selectedToken,
        maxSupply: supply
      });
    }
  };

  const handleSave = () => {
    const supply = parseFloat(maxSupply);
    if (!supply || supply <= 0) {
      toast.error('Geçersiz maksimum arz miktarı');
      return;
    }

    setSelectedToken({
      ...selectedToken,
      maxSupply: supply
    });
    
    toast.success('Konfigürasyon kaydedildi!');
    setIsOpen(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-3 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500 ring-2 ring-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.6)] animate-glow-pulse backdrop-blur-sm">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <img 
              src={selectedToken.logo} 
              alt={selectedToken.symbol} 
              className="w-5 h-5 rounded-full ring-2 ring-orange-500/50"
            />
            <h3 className="font-semibold text-sm text-foreground">Multisig Token Konfigürasyonu</h3>
            <Settings className="w-4 h-4 text-orange-500" />
            {!isOpen && (
              <div className="flex items-center gap-2 ml-auto mr-2">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/10 rounded border border-orange-500/30">
                  <span className="text-sm font-bold text-orange-500">
                    {selectedToken.symbol}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/10 rounded border border-yellow-500/30">
                  <span className="text-xs text-yellow-600">
                    {selectedToken.maxSupply.toLocaleString('tr-TR')} Max
                  </span>
                </div>
              </div>
            )}
            <ChevronDown className={`w-4 h-4 text-orange-500 ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="space-y-4 mt-4">
            {/* Current Selection Display */}
            <div className="p-3 bg-background/30 rounded border border-border/30">
              <label className="text-xs text-muted-foreground block mb-2">Seçili Token</label>
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded border border-orange-500/30">
                <img 
                  src={selectedToken.logo} 
                  alt={selectedToken.symbol} 
                  className="w-8 h-8 rounded-full ring-2 ring-orange-500/50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-orange-500">{selectedToken.symbol}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-sm text-foreground">{selectedToken.name}</span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {selectedToken.address.slice(0, 12)}...{selectedToken.address.slice(-10)}
                  </div>
                  <div className="text-xs text-yellow-600 font-medium mt-1">
                    Max Supply: {selectedToken.maxSupply.toLocaleString('tr-TR')} {selectedToken.symbol}
                  </div>
                </div>
                <Target className="w-5 h-5 text-orange-500" />
              </div>
            </div>

            {/* Token Selection */}
            <div className="p-3 bg-background/30 rounded border border-border/30 space-y-3">
              <label className="text-xs text-muted-foreground block">Yeni Token Seç</label>
              <Select 
                value={selectedToken.id} 
                onValueChange={handleTokenSelect}
              >
                <SelectTrigger className="h-10 bg-background/50 border-orange-500/30 focus:border-orange-500">
                  <SelectValue placeholder="Multisig token seçin" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                  {availableTokens.map((token) => (
                    <SelectItem key={token.id} value={token.id} className="cursor-pointer hover:bg-accent">
                      <div className="flex items-center gap-3">
                        <img src={token.logo} alt={token.symbol} className="w-5 h-5 rounded-full" />
                        <div className="flex flex-col">
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground">{token.name}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Supply Configuration */}
            <div className="p-3 bg-background/30 rounded border border-border/30 space-y-3">
              <label className="text-xs text-muted-foreground block">Maksimum Arz (Max Supply)</label>
              <div className="space-y-2">
                <Input
                  type="number"
                  step="1000000"
                  value={maxSupply}
                  onChange={(e) => handleMaxSupplyChange(e.target.value)}
                  className="h-10 text-sm bg-background/50 border-orange-500/30 focus:border-orange-500"
                  placeholder="Maksimum token arzını girin"
                />
                <div className="text-xs text-muted-foreground">
                  <p>• Bu değer dolaşım hesaplamalarında kullanılacak</p>
                  <p>• Örnek: ORDER için 100,000,000 (100M)</p>
                  <p>• Token ekonomisine göre ayarlayın</p>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="p-3 bg-background/30 rounded border border-border/30">
              <label className="text-xs text-muted-foreground block mb-2">Hızlı Ayarlar</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMaxSupply('100000000')}
                  className="text-xs h-8 border-orange-500/30 hover:bg-orange-500/10"
                >
                  100M
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMaxSupply('1000000000')}
                  className="text-xs h-8 border-orange-500/30 hover:bg-orange-500/10"
                >
                  1B
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMaxSupply('10000000000')}
                  className="text-xs h-8 border-orange-500/30 hover:bg-orange-500/10"
                >
                  10B
                </Button>
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              className="w-full h-10 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold"
            >
              <Save className="w-4 h-4 mr-2" />
              Konfigürasyonu Kaydet
            </Button>

            {/* Info */}
            <div className="p-3 bg-orange-500/5 rounded border border-orange-500/20">
              <div className="text-xs text-orange-600">
                <p className="font-medium mb-1">ℹ️ Bilgi:</p>
                <p>Bu ayarlar tüm dashboard'u etkileyecek:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Navbar'daki logo ve isim</li>
                  <li>Son transferler ve analiz</li>
                  <li>Dolaşım dışı adresler</li>
                  <li>Karşılaştırmalı analiz</li>
                </ul>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};