import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, Plus, Trash2, ChevronDown, ChevronUp, FileSignature, Copy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import rabbyLogo from '@/assets/rabby-logo.png';
import coreLogo from '@/assets/core-logo.png';
import ledgerLogo from '@/assets/ledger-logo.png';
import arenaLogo from '@/assets/arena-logo.png';

export interface MultisigWallet {
  id: string;
  address: string;
  label: string;
  enabled: boolean;
  logo?: string;
  logos?: string[];
  solanaAddress?: string;
}

const DEFAULT_WALLETS: MultisigWallet[] = [
  {
    id: '1',
    address: '0xB799CD1f2ED5dB96ea94EdF367fBA2d90dfd9634',
    label: 'Ana Multisig',
    enabled: true,
    logo: 'https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png',
  },
  {
    id: '2',
    address: '0xAA1A1c49b8fd0AA010387Cb2d8b5A0fc950205aB',
    label: '0xAA LEDGER',
    enabled: true,
    logo: arenaLogo,
  },
  {
    id: '3',
    address: '0x149cF6b96F4A73B3F273993ee6FFFACB37e0A4Fa',
    label: '0x149 LEDGER',
    enabled: false,
    logo: arenaLogo,
  },
  {
    id: '4',
    address: '0x5151Ecca198557Abe46478a86879BAD91Dc423D3',
    label: 'ECO LP Multisig',
    enabled: true,
    logo: 'https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png',
  },
  {
    id: '5',
    address: '0x91b5965e81DAC2687D0dAD000bd6ef207D2D167f',
    label: '0x91 LEDGER',
    enabled: true,
    logo: arenaLogo,
  },
  {
    id: '6',
    address: '0x881327E6B5b73859E12247863E904d80e77bAF85',
    label: '0x88 LEDGER',
    enabled: true,
    logo: arenaLogo,
  },
  {
    id: '7',
    address: '0xaF2b2f98C478c62E60244E34635933c8d09993eB',
    label: '0x88 3.Sub Ledger',
    enabled: true,
    logo: 'https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png',
  },
  {
    id: '8',
    address: '0xb999C018B79578ab92D495e084e420A155eB63a7',
    label: '0xAA 3. Sub Ledger',
    enabled: true,
    logo: 'https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png',
  },
  {
    id: '9',
    address: '0x87A7A3D8f13f92795e2Ce5016B36E15893439B4F',
    label: 'Hot Google Wallet',
    enabled: true,
    logos: [rabbyLogo, coreLogo, ledgerLogo, 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg'],
  },
  {
    id: '10',
    address: '0x3fa6df8357dc58935360833827a9762433488c83',
    label: 'The Arena Wallet',
    enabled: true,
    logo: ledgerLogo,
    solanaAddress: 'G3Ea5aSe6pbADPPuWxjWoxiLJTLLd1YeegTk7MHYvby',
  },
  {
    id: '11',
    address: '0x5b83b14863F641a2FDA4433580482D2c63EC9F27',
    label: 'Gülbeyaz',
    enabled: false,
    logo: arenaLogo,
  },
];

const STORAGE_KEY = 'multisig-wallets';

export const useMultisigWallets = () => {
  const [wallets, setWallets] = useState<MultisigWallet[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_WALLETS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
    window.dispatchEvent(new CustomEvent('wallets-updated'));
  }, [wallets]);

  return { wallets, setWallets };
};

export const getEnabledWallets = (): MultisigWallet[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const wallets = stored ? JSON.parse(stored) : DEFAULT_WALLETS;
  return wallets.filter((w: MultisigWallet) => w.enabled);
};

export const WalletManager = () => {
  const { wallets, setWallets } = useMultisigWallets();
  const [isExpanded, setIsExpanded] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const validateAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleAdd = () => {
    if (!newAddress.trim()) {
      toast.error('Lütfen bir cüzdan adresi girin');
      return;
    }

    if (!validateAddress(newAddress)) {
      toast.error('Geçersiz Ethereum adresi');
      return;
    }

    if (wallets.some(w => w.address.toLowerCase() === newAddress.toLowerCase())) {
      toast.error('Bu cüzdan zaten ekli');
      return;
    }

    const wallet: MultisigWallet = {
      id: Date.now().toString(),
      address: newAddress,
      label: newLabel.trim() || 'Yeni Cüzdan',
      enabled: true,
      logo: 'https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png',
    };

    setWallets([...wallets, wallet]);
    setNewAddress('');
    setNewLabel('');
    toast.success('Cüzdan eklendi');
  };

  const toggleWallet = (id: string) => {
    setWallets(wallets.map(w => 
      w.id === id ? { ...w, enabled: !w.enabled } : w
    ));
  };

  const deleteWallet = (id: string) => {
    setWallets(wallets.filter(w => w.id !== id));
    toast.success('Cüzdan silindi');
  };

  const enabledCount = wallets.filter(w => w.enabled).length;

  return (
    <Card className="p-4 gradient-card border-corporate-blue/30">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-corporate-blue" />
          <h3 className="font-bold text-foreground">Multisig Cüzdanları</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {enabledCount}/{wallets.length}
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
          {/* Add New Wallet */}
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border/50">
            <Input
              placeholder="Cüzdan Adresi (0x...)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="text-sm"
            />
            <Input
              placeholder="Etiket (opsiyonel)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="text-sm"
            />
            <Button
              onClick={handleAdd}
              size="sm"
              className="w-full bg-corporate-blue hover:bg-corporate-blue/90"
            >
              <Plus className="w-4 h-4 mr-1" />
              Cüzdan Ekle
            </Button>
          </div>

          {/* Wallet List */}
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border/30 hover:border-corporate-blue/40 transition-colors"
              >
                <Switch
                  checked={wallet.enabled}
                  onCheckedChange={() => toggleWallet(wallet.id)}
                />
                {wallet.label.includes('3.Sub Ledger') || wallet.label.includes('3. Sub Ledger') ? (
                  <div className="w-5 h-5 flex items-center justify-center bg-corporate-blue/20 rounded-full flex-shrink-0">
                    <FileSignature className="w-3 h-3 text-corporate-blue" />
                  </div>
                ) : wallet.logos ? (
                  <div className="flex gap-1 flex-shrink-0">
                    {wallet.logos.map((logo, idx) => (
                      <img 
                        key={idx}
                        src={logo} 
                        alt={`${wallet.label} logo ${idx + 1}`} 
                        className="w-5 h-5 rounded-full" 
                      />
                    ))}
                  </div>
                ) : wallet.logo ? (
                  <img 
                    src={wallet.logo} 
                    alt={wallet.label} 
                    className="w-5 h-5 rounded-full flex-shrink-0" 
                  />
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-foreground truncate mb-0.5">
                    {wallet.label}
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(wallet.address);
                        toast.success('Adres kopyalandı');
                      }}
                      className="h-6 w-6 p-0 hover:bg-muted"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  {wallet.solanaAddress && (
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        SOL: {wallet.solanaAddress.slice(0, 8)}...{wallet.solanaAddress.slice(-6)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(wallet.solanaAddress!);
                          toast.success('Solana adresi kopyalandı');
                        }}
                        className="h-6 w-6 p-0 hover:bg-muted"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteWallet(wallet.id)}
                  className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Toplam {wallets.length} cüzdan • {wallets.filter(w => w.enabled).length} aktif
          </p>
        </div>
      )}
    </Card>
  );
};
