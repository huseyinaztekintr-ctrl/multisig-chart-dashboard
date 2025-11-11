import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings, Plus, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export interface NonCirculatingAddress {
  id: string;
  name: string;
  address: string;
  enabled: boolean;
  type: 'address' | 'manual';
  manualAmount?: number;
  reason?: string;
}

const DEFAULT_ADDRESSES: NonCirculatingAddress[] = [
  { id: '1', name: 'LP Pool (WAVAX/ORDER)', address: '0x5147fff4794FD96c1B0E64dCcA921CA0EE1cdA8d', enabled: true, type: 'address' },
  { id: '2', name: 'Burned', address: '0x000000000000000000000000000000000000dEaD', enabled: true, type: 'address' },
  { id: '3', name: 'OrderLend', address: '0xab3AeC80f3b986af37f1aE9D22b795a9D9Ef4011', enabled: true, type: 'address' },
  { id: '4', name: 'Team 1', address: '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634', enabled: true, type: 'address' },
  { id: '5', name: 'Team 2', address: '0xAA1A1c49b8fd0AA010387Cb2d8b5A0fc950205aB', enabled: true, type: 'address' },
  { id: '6', name: 'Team 3', address: '0x0131E47D3815b41A6C0a9072Ba6BB84912A65Bb2', enabled: true, type: 'address' },
  { id: '7', name: 'Team 4', address: '0xb999C018B79578ab92D495e084e420A155eB63a7', enabled: true, type: 'address' },
  { id: '8', name: 'WITCH/ORDER Pool', address: '0xAc7e3b8242e0915d22C107c411b90cAc702EBC56', enabled: true, type: 'address' },
  { id: '9', name: 'Order Staking', address: '0x6c28d5be99994bEAb3bDCB3b30b0645481e835fd', enabled: true, type: 'address' },
  { id: '10', name: 'Order Staking', address: '0x9Fd7EcFC7FA65D5EdD21dcd9aAe28e9f0c042647', enabled: true, type: 'address' },
  { id: '11', name: 'Order Staking', address: '0xd82f262f19d582b6d4023a332d4815f83512073e', enabled: true, type: 'address' },
  { id: '12', name: 'Order Staking', address: '0x43fa1C48694E688aA437121E09aBFD54E4E62126', enabled: true, type: 'address' },
  { id: '13', name: 'Order Staking', address: '0x17e77Caa1773f9f01a1D36892cd33a516cE41fC5', enabled: true, type: 'address' },
  { id: '14', name: 'Order Staking', address: '0xbd3ab92148db18167117E88Ec188a77187178951', enabled: true, type: 'address' },
  { id: '15', name: 'Order Reward', address: '0xaC6B8391C4593C7761A730244206D5351F86D90E', enabled: true, type: 'address' },
  { id: '16', name: 'OrderSlot Reward', address: '0x2Fd6cB1951C014027443e456c1F6ac7C5642B2BB', enabled: true, type: 'address' },
  { id: '17', name: 'EcoLP Multisig', address: '0x5151Ecca198557Abe46478a86879BAD91Dc423D3', enabled: true, type: 'address' },
  { id: '18', name: 'Brandon', address: '0x6b3cc5596e05b2e8d755cc0cf54073790d584caf', enabled: false, type: 'address' },
  { id: '19', name: 'JasonDesimone', address: '0xd910bf90fc49913ec5192af7690c6efdcf3e2396', enabled: false, type: 'address' },
  { id: '20', name: 'xORDER Boosting', address: '0xc5dec1750557497f95ab54818e88a25c4a72609a', enabled: false, type: 'address' },
];

const STORAGE_KEY = 'non-circulating-addresses';

export const useNonCirculatingAddresses = () => {
  const [addresses, setAddresses] = useState<NonCirculatingAddress[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_ADDRESSES;
    
    const parsed = JSON.parse(stored);
    // Migration: Add type field to old addresses
    const migrated = parsed.map((addr: any) => ({
      ...addr,
      type: addr.type || 'address'
    }));
    
    return migrated;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
    // Trigger custom event for other components to update
    window.dispatchEvent(new CustomEvent('addresses-updated'));
  }, [addresses]);

  return { addresses, setAddresses };
};

export const getEnabledAddresses = (): string[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_ADDRESSES.map(addr => addr.address);
  
  const parsed = JSON.parse(stored);
  // Migration: Add type field to old addresses
  const addresses: NonCirculatingAddress[] = parsed.map((addr: any) => ({
    ...addr,
    type: addr.type || 'address'
  }));
  
  return addresses.filter(addr => addr.enabled && addr.type === 'address').map(addr => addr.address);
};

export const getManualEntries = (): NonCirculatingAddress[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  const parsed = JSON.parse(stored);
  // Migration: Add type field to old addresses
  const addresses: NonCirculatingAddress[] = parsed.map((addr: any) => ({
    ...addr,
    type: addr.type || 'address'
  }));
  
  return addresses.filter(addr => addr.enabled && addr.type === 'manual');
};

export const AddressManager = () => {
  const { addresses, setAddresses } = useNonCirculatingAddresses();
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [entryType, setEntryType] = useState<'address' | 'manual'>('address');
  const [manualAmount, setManualAmount] = useState('');
  const [manualReason, setManualReason] = useState('');

  const handleAddAddress = () => {
    if (!newName.trim() || !newAddress.trim()) {
      toast.error('Lütfen isim ve adres girin');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(newAddress)) {
      toast.error('Geçersiz Ethereum adresi');
      return;
    }

    const newAddr: NonCirculatingAddress = {
      id: Date.now().toString(),
      name: newName.trim(),
      address: newAddress.trim(),
      enabled: true,
      type: 'address',
    };

    setAddresses([...addresses, newAddr]);
    setNewName('');
    setNewAddress('');
    toast.success('Adres eklendi');
  };

  const handleAddManual = () => {
    if (!newName.trim() || !manualAmount.trim() || !manualReason.trim()) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Geçerli bir miktar girin');
      return;
    }

    const newEntry: NonCirculatingAddress = {
      id: Date.now().toString(),
      name: newName.trim(),
      address: '',
      enabled: true,
      type: 'manual',
      manualAmount: amount,
      reason: manualReason.trim(),
    };

    setAddresses([...addresses, newEntry]);
    setNewName('');
    setManualAmount('');
    setManualReason('');
    toast.success('Manuel giriş eklendi');
  };

  const handleToggle = (id: string) => {
    setAddresses(addresses.map(addr => 
      addr.id === id ? { ...addr, enabled: !addr.enabled } : addr
    ));
  };

  const enabledCount = addresses.filter(a => a.enabled).length;

  return (
    <Card className="p-4 gradient-card border-primary/30">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-order-green" />
          <h3 className="text-sm font-bold text-foreground">Dolaşım Dışı Adresler</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {enabledCount}/{addresses.length}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* Address List */}
          <div className="space-y-2">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border/30 hover:border-order-green/40 transition-colors"
              >
                <Switch
                  checked={addr.enabled}
                  onCheckedChange={() => handleToggle(addr.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-xs">{addr.name}</p>
                  {addr.type === 'address' ? (
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(addr.address);
                          toast.success('Adres kopyalandı');
                        }}
                        className="h-6 w-6 p-0 hover:bg-muted"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p className="font-semibold text-order-green">
                        {addr.manualAmount?.toLocaleString('tr-TR')} ORDER
                      </p>
                      <p className="truncate italic">{addr.reason}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add New Entry Form */}
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center gap-1 mb-2">
              <Plus className="w-3 h-3 text-order-green" />
              <span className="text-xs font-semibold text-foreground">Yeni Giriş</span>
            </div>
            
            {/* Type Selector */}
            <div className="flex gap-1 mb-2">
              <Button
                variant={entryType === 'address' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEntryType('address')}
                className="flex-1 h-7 text-xs"
              >
                Adres
              </Button>
              <Button
                variant={entryType === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEntryType('manual')}
                className="flex-1 h-7 text-xs"
              >
                Manuel
              </Button>
            </div>

            {entryType === 'address' ? (
              <div className="space-y-2">
                <Input
                  placeholder="İsim (Örn: Team 5)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="0x..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
                <Button
                  onClick={handleAddAddress}
                  className="w-full h-7 text-xs"
                  size="sm"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adres Ekle
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="İsim (Örn: Ekip Tahsisi)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Miktar (Örn: 1000000)"
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Sebep (Örn: Gelecek borçlar için ayrılan)"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  onClick={handleAddManual}
                  className="w-full h-7 text-xs"
                  size="sm"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Manuel Ekle
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
