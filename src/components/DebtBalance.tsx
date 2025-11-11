import { useState, useEffect, memo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown, Plus, X, DollarSign } from 'lucide-react';
import { getEnabledTokens } from './TokenManager';

interface Debt {
  id: string;
  name: string;
  token: string;
  amount: number;
}

interface TokenOption {
  symbol: string;
  logo: string;
}

const DEFAULT_DEBTS: Debt[] = [
  { id: 'default-1', name: 'AKBANK NAKİT AVANS', token: 'TRY', amount: 104000 },
  { id: 'default-2', name: 'AKBANK KREDİ', token: 'TRY', amount: 350000 },
  { id: 'default-3', name: 'YUSUF USDT BORCU', token: 'USDC', amount: 3450 },
  { id: 'default-4', name: 'DAVA FAİZCİ', token: 'TRY', amount: 100000 },
  { id: 'default-5', name: 'BABAM AVAX BORCU', token: 'WAVAX', amount: 55 },
];

const DebtBalanceComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [debts, setDebts] = useState<Debt[]>(() => {
    const savedDebts = localStorage.getItem('debt-balance');
    if (savedDebts) {
      return JSON.parse(savedDebts);
    }
    return DEFAULT_DEBTS;
  });
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtToken, setNewDebtToken] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [availableTokens, setAvailableTokens] = useState<TokenOption[]>([]);

  const loadAvailableTokens = useCallback(() => {
    const tokens = getEnabledTokens().map(t => ({
      symbol: t.symbol,
      logo: t.logo
    }));
    setAvailableTokens([
      ...tokens,
      { symbol: 'TRY', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Flag_of_Turkey.svg/32px-Flag_of_Turkey.svg.png' }
    ]);
  }, []);

  useEffect(() => {
    loadAvailableTokens();

    const handleTokenUpdate = () => loadAvailableTokens();
    window.addEventListener('tokens-updated', handleTokenUpdate);

    return () => {
      window.removeEventListener('tokens-updated', handleTokenUpdate);
    };
  }, [loadAvailableTokens]);

  useEffect(() => {
    // Save debts to localStorage and notify ComparativeAnalysis
    localStorage.setItem('debt-balance', JSON.stringify(debts));
    window.dispatchEvent(new CustomEvent('debt-balance-updated'));
  }, [debts]);

  const addDebt = () => {
    if (!newDebtName || !newDebtToken || !newDebtAmount || parseFloat(newDebtAmount) <= 0) {
      return;
    }

    const newDebt: Debt = {
      id: Date.now().toString(),
      name: newDebtName,
      token: newDebtToken,
      amount: parseFloat(newDebtAmount),
    };

    setDebts([...debts, newDebt]);
    setNewDebtName('');
    setNewDebtToken('');
    setNewDebtAmount('');
  };

  const removeDebt = (id: string) => {
    setDebts(debts.filter(d => d.id !== id));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-4 gradient-card border-corporate-blue/30">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-destructive" />
              <h3 className="text-base font-bold text-foreground">Borç Dengesi</h3>
              {debts.length > 0 && (
                <span className="text-xs text-muted-foreground">({debts.length} borç)</span>
              )}
            </div>
            <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="Borç Adı"
              value={newDebtName}
              onChange={(e) => setNewDebtName(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={newDebtToken} onValueChange={setNewDebtToken}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Token Seç" />
                </SelectTrigger>
                <SelectContent>
                  {availableTokens.map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center gap-2">
                        <img src={token.logo} alt={token.symbol} className="w-4 h-4 rounded-full" />
                        <span>{token.symbol}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Miktar"
                value={newDebtAmount}
                onChange={(e) => setNewDebtAmount(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button
              onClick={addDebt}
              size="sm"
              className="w-full h-8 text-xs"
              variant="default"
            >
              <Plus className="w-3 h-3 mr-1" />
              Borç Ekle
            </Button>
          </div>

          {debts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              {debts.map((debt) => (
                <div
                  key={debt.id}
                  className="flex items-center justify-between p-2 rounded bg-destructive/10 border border-destructive/20"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{debt.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {debt.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {debt.token}
                    </p>
                  </div>
                  <Button
                    onClick={() => removeDebt(debt.id)}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-destructive/20"
                  >
                    <X className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export const DebtBalance = memo(DebtBalanceComponent);
