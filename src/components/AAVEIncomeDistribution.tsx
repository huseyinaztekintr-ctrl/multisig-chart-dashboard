import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, Plus, X, Edit2, PieChart, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState, useEffect, memo } from 'react';

// Get token from localStorage
const getTokenBySymbol = (symbol: string) => {
  const tokensData = localStorage.getItem('multisig-tokens');
  if (!tokensData) return null;
  const tokens = JSON.parse(tokensData);
  return tokens.find((t: any) => t.symbol === symbol);
};

// Get stablecoin logos for compound category
const getStablecoinLogos = (): Array<{ symbol: string; logo: string }> => {
  const stablecoins = ['USDC', 'USDT', 'DAI.e', 'GHO', 'EURC'];
  const tokensData = localStorage.getItem('multisig-tokens');
  if (!tokensData) return [];
  
  const tokens = JSON.parse(tokensData);
  return stablecoins
    .map(symbol => {
      const token = tokens.find((t: any) => t.symbol === symbol);
      return token ? { symbol: token.symbol, logo: token.logo } : null;
    })
    .filter(Boolean) as Array<{ symbol: string; logo: string }>;
};

interface DistributionCategory {
  id: string;
  percentage: number;
  emoji: string;
  name: string;
  enabled: boolean;
}

const DEFAULT_CATEGORIES: DistributionCategory[] = [
  { id: '1', percentage: 20, emoji: '📄', name: 'Genel Giderler', enabled: true },
  { id: '2', percentage: 20, emoji: '🧾', name: 'Fatura Gıda vb.', enabled: true },
  { id: '3', percentage: 20, emoji: '🎮', name: 'Eğlence Harcama', enabled: true },
  { id: '4', percentage: 20, emoji: '🪙', name: 'Stablecoin Compound', enabled: true },
  { id: '5', percentage: 10, emoji: '฿', name: 'BTC.b Alımı', enabled: true },
  { id: '6', percentage: 10, emoji: '🟥', name: 'AVAX, Hisse, Altın vb.', enabled: true },
];

const STORAGE_KEY = 'aave-income-distribution';

const AAVEIncomeDistributionComponent = () => {
  const [categories, setCategories] = useState<DistributionCategory[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_CATEGORIES;
  });

  const [monthlyUSD, setMonthlyUSD] = useState(0);
  const [monthlyTRY, setMonthlyTRY] = useState(0);
  const [tryRate, setTryRate] = useState(34.5);
  const [isEditing, setIsEditing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ percentage: 0, emoji: '', name: '' });

  // Read values from AAVE calculator
  useEffect(() => {
    const updateValues = () => {
      const usd = parseFloat(localStorage.getItem('aave-monthly-usd') || '0');
      const tryCurrency = parseFloat(localStorage.getItem('aave-monthly-try') || '0');
      const rate = parseFloat(localStorage.getItem('try-exchange-rate') || '34.5');
      
      setMonthlyUSD(usd);
      setMonthlyTRY(tryCurrency);
      setTryRate(rate);
    };

    updateValues();
    
    const handleUpdate = () => updateValues();
    window.addEventListener('comparative-analysis-updated', handleUpdate);
    window.addEventListener('manual-tokens-updated', handleUpdate);
    
    // Listen for storage changes from AAVEYieldCalculator
    const handleStorageUpdate = () => updateValues();
    window.addEventListener('storage', handleStorageUpdate);
    
    // Check for updates periodically
    const interval = setInterval(updateValues, 1000);
    
    return () => {
      window.removeEventListener('comparative-analysis-updated', handleUpdate);
      window.removeEventListener('manual-tokens-updated', handleUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
      clearInterval(interval);
    };
  }, []);

  // Save categories to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  const updateCategory = (id: string, field: keyof DistributionCategory, value: string | number | boolean) => {
    setCategories(categories.map(cat => 
      cat.id === id ? { ...cat, [field]: value } : cat
    ));
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter(cat => cat.id !== id));
  };

  const addCategory = () => {
    if (!newCategory.name || newCategory.percentage <= 0) return;
    
    const category: DistributionCategory = {
      id: Date.now().toString(),
      percentage: newCategory.percentage,
      emoji: newCategory.emoji || '📌',
      name: newCategory.name,
      enabled: true,
    };
    
    setCategories([...categories, category]);
    setNewCategory({ percentage: 0, emoji: '', name: '' });
  };

  const totalPercentage = categories.reduce((sum, cat) => cat.enabled ? sum + cat.percentage : sum, 0);
  const enabledCategories = categories.filter(cat => cat.enabled);

  return (
    <>
      {/* Compact Summary Card */}
      <Card 
        className="p-3 bg-gradient-to-br from-[#2EBAC6]/10 to-[#B6509E]/10 border-[#2EBAC6]/30 glow-aave cursor-pointer hover:border-[#2EBAC6]/50 transition-all"
        onClick={() => setShowDialog(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#2EBAC6] animate-pulse-slow" />
            <h3 className="text-base font-bold text-foreground">Gelir Dağılımı</h3>
            {enabledCategories.length > 0 && (
              <span className="text-xs bg-[#2EBAC6]/10 text-[#2EBAC6] px-2 py-1 rounded border border-[#2EBAC6]/30">
                {enabledCategories.length} kategori
              </span>
            )}
          </div>
          <Eye className="w-4 h-4 text-muted-foreground" />
        </div>

        {monthlyUSD > 0 ? (
          <div className="mt-3 space-y-2">
            {/* Monthly Totals */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Aylık USD</p>
                  <p className="text-lg font-bold text-[#2EBAC6]">
                    ${monthlyUSD.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Aylık TRY</p>
                  <p className="text-lg font-bold text-[#B6509E]">
                    ₺{monthlyTRY.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Dağılım</p>
                <p className={`text-sm font-bold ${totalPercentage === 100 ? 'text-[#2EBAC6]' : 'text-yellow-500'}`}>
                  {totalPercentage}%
                </p>
                {totalPercentage !== 100 && (
                  <p className="text-xs text-yellow-500/80">
                    Ayarlanmalı
                  </p>
                )}
              </div>
            </div>

            {/* Top 3 Categories Preview */}
            <div className="space-y-1">
              {enabledCategories.slice(0, 3).map((category) => {
                const usdAmount = (monthlyUSD * category.percentage) / 100;
                return (
                  <div key={category.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#2EBAC6]">{category.percentage}%</span>
                      <span className="text-sm">{category.emoji}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-20">
                        {category.name}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      ${usdAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                );
              })}
              {enabledCategories.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{enabledCategories.length - 3} kategori daha...
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-center">
            <p className="text-sm text-muted-foreground">AAVE geliri bekleniyor...</p>
          </div>
        )}
      </Card>

      {/* Full Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#2EBAC6]" />
              Aylık Gelir Dağılımı
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <Card className="p-4 bg-gradient-to-br from-[#2EBAC6]/10 to-[#B6509E]/10 border-[#2EBAC6] ring-2 ring-[#2EBAC6] shadow-[0_0_30px_rgba(46,186,198,0.6)] animate-glow-pulse backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#2EBAC6]" />
          <h3 className="font-semibold text-sm text-foreground">Aylık Gelir Dağılımı</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(!isEditing)}
          className="h-7 w-7 p-0"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Total Monthly Income */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 bg-background/50 rounded border border-border/50">
          <p className="text-xs text-muted-foreground mb-0.5">Toplam Aylık</p>
          <div className="flex items-center gap-1">
            <span className="font-bold text-xs text-[#2EBAC6]">$</span>
            <p className="text-base font-bold text-[#2EBAC6]">
              {monthlyUSD.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        <div className="p-2 bg-background/50 rounded border border-border/50">
          <p className="text-xs text-muted-foreground mb-0.5">Toplam Aylık</p>
          <div className="flex items-center gap-1">
            <span className="font-bold text-xs text-[#B6509E]">₺</span>
            <p className="text-base font-bold text-[#B6509E]">
              {monthlyTRY.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Distribution Categories */}
      <div className="space-y-1.5 mb-3">
        {enabledCategories.map((category) => {
          const usdAmount = (monthlyUSD * category.percentage) / 100;
          const tryAmount = (monthlyTRY * category.percentage) / 100;

          return (
            <div
              key={category.id}
              className="flex items-center justify-between p-2 bg-background/30 rounded border border-border/30 group hover:border-[#2EBAC6]/50 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isEditing ? (
                  <>
                    <Input
                      type="number"
                      value={category.percentage}
                      onChange={(e) => updateCategory(category.id, 'percentage', parseFloat(e.target.value) || 0)}
                      className="w-14 h-7 text-xs bg-background/50"
                    />
                    <Input
                      type="text"
                      value={category.emoji}
                      onChange={(e) => updateCategory(category.id, 'emoji', e.target.value)}
                      className="w-12 h-7 text-xs bg-background/50"
                      placeholder="📌"
                    />
                    <Input
                      type="text"
                      value={category.name}
                      onChange={(e) => updateCategory(category.id, 'name', e.target.value)}
                      className="flex-1 h-7 text-xs bg-background/50"
                    />
                  </>
                ) : (
                  <>
                    <span className="text-lg font-bold text-[#2EBAC6] w-12">{category.percentage}%</span>
                    {category.name.toLowerCase().includes('stablecoin') || category.name.toLowerCase().includes('compound') ? (
                      <div className="flex items-center gap-0.5">
                        {getStablecoinLogos().map((token) => (
                          <img 
                            key={token.symbol}
                            src={token.logo} 
                            alt={token.symbol}
                            title={token.symbol}
                            className="w-5 h-5 rounded-full flex-shrink-0 -ml-0.5 first:ml-0 border border-background"
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const normalizedName = category.name.toLowerCase();
                          let tokenSymbol = '';
                          
                          if (normalizedName.includes('btc')) tokenSymbol = 'BTC.b';
                          else if (normalizedName.includes('avax')) tokenSymbol = 'WAVAX';
                          else if (normalizedName.includes('usdc')) tokenSymbol = 'USDC';
                          else if (normalizedName.includes('dai')) tokenSymbol = 'DAI.e';
                          else if (normalizedName.includes('gho')) tokenSymbol = 'GHO';
                          
                          const token = tokenSymbol ? getTokenBySymbol(tokenSymbol) : null;
                          
                          return token ? (
                            <img 
                              src={token.logo} 
                              alt={token.symbol}
                              title={token.symbol}
                              className="w-6 h-6 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <span className="text-xl">{category.emoji}</span>
                          );
                        })()}
                      </>
                    )}
                    <span className="text-sm text-foreground flex-1 min-w-0 truncate">{category.name}</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-lg font-bold text-foreground">
                    ${usdAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ₺{tryAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                
                {isEditing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteCategory(category.id)}
                    className="h-6 w-6 p-0 hover:bg-red-500/10 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Category */}
      {isEditing && (
        <div className="p-2 bg-background/30 rounded border border-border/30 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <Input
              type="number"
              step="1"
              value={newCategory.percentage || ''}
              onChange={(e) => setNewCategory({ ...newCategory, percentage: parseFloat(e.target.value) || 0 })}
              className="col-span-3 h-7 text-xs bg-background/50"
              placeholder="%"
            />
            <Input
              type="text"
              value={newCategory.emoji}
              onChange={(e) => setNewCategory({ ...newCategory, emoji: e.target.value })}
              className="col-span-2 h-7 text-xs bg-background/50"
              placeholder="📌"
            />
            <Input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              className="col-span-7 h-7 text-xs bg-background/50"
              placeholder="Kategori adı"
            />
          </div>
          <Button
            onClick={addCategory}
            disabled={!newCategory.name || newCategory.percentage <= 0}
            className="w-full h-7 text-xs"
            size="sm"
          >
            <Plus className="w-3 h-3 mr-1" />
            Kategori Ekle
          </Button>
        </div>
      )}

              {/* Total Percentage Warning */}
              {totalPercentage !== 100 && (
                <div className={`text-xs text-center p-1.5 rounded ${
                  totalPercentage > 100 
                    ? 'bg-red-500/10 text-red-500' 
                    : 'bg-yellow-500/10 text-yellow-500'
                }`}>
                  Toplam: {totalPercentage}% {totalPercentage !== 100 && '(100% olmalı)'}
                </div>
              )}
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const AAVEIncomeDistribution = memo(AAVEIncomeDistributionComponent);
