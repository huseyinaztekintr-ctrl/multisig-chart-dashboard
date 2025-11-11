import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronDown, Send, Copy, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import { getEnabledTokens } from './TokenManager';
import { getEnabledWallets } from './WalletManager';
import CryptoJS from 'crypto-js';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

const STORAGE_KEY_ENCRYPTED_PKS = 'swapbot-encrypted-pks';
const STORAGE_KEY_PASSWORD_HASH = 'swapbot-password-hash';

interface AirdropWallet {
  privateKey: string;
  address: string;
}

export const AirdropCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [wallets, setWallets] = useState<AirdropWallet[]>([]);
  const [availableTokens, setAvailableTokens] = useState<any[]>([]);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState<number>(0);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [sourceBalance, setSourceBalance] = useState<string>('');
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [mode, setMode] = useState<'airdrop' | 'withdraw'>('airdrop');
  const [targetAddress, setTargetAddress] = useState<string>('');
  const [multisigWallets, setMultisigWallets] = useState<any[]>([]);
  const [percentAmount, setPercentAmount] = useState<string>('');

  useEffect(() => {
    const loadTokens = () => {
      const tokens = getEnabledTokens();
      setAvailableTokens([
        { id: 'native', symbol: 'AVAX', address: 'NATIVE', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png' },
        ...tokens
      ]);
    };
    
    loadTokens();
    
    const handleTokensUpdate = () => loadTokens();
    window.addEventListener('tokens-updated', handleTokensUpdate);
    
    return () => {
      window.removeEventListener('tokens-updated', handleTokensUpdate);
    };
  }, []);

  useEffect(() => {
    const loadMultisigWallets = () => {
      const wallets = getEnabledWallets();
      setMultisigWallets(wallets);
      if (wallets.length > 0 && !targetAddress) {
        setTargetAddress(wallets[0].address);
      }
    };
    
    loadMultisigWallets();
    
    const handleWalletsUpdate = () => loadMultisigWallets();
    window.addEventListener('wallets-updated', handleWalletsUpdate);
    
    return () => {
      window.removeEventListener('wallets-updated', handleWalletsUpdate);
    };
  }, []);

  const hashPassword = (pwd: string): string => {
    return CryptoJS.SHA256(pwd).toString();
  };

  const decryptPrivateKey = (encryptedKey: string, pwd: string): string | null => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedKey, pwd);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || null;
    } catch {
      return null;
    }
  };

  const loadWallets = () => {
    if (!password) {
      toast.error('Şifre giriniz');
      return;
    }

    const savedPasswordHash = localStorage.getItem(STORAGE_KEY_PASSWORD_HASH);
    const savedEncryptedKeys = localStorage.getItem(STORAGE_KEY_ENCRYPTED_PKS);
    
    if (!savedPasswordHash || !savedEncryptedKeys) {
      toast.error('Kaydedilmiş key bulunamadı');
      return;
    }

    const enteredPasswordHash = hashPassword(password);
    
    if (enteredPasswordHash !== savedPasswordHash) {
      toast.error('Yanlış şifre!');
      return;
    }

    try {
      const encryptedKeysArray = JSON.parse(savedEncryptedKeys);
      const decryptedKeys = encryptedKeysArray.map((encKey: string) => 
        decryptPrivateKey(encKey, password)
      ).filter(Boolean) as string[];
      
      if (decryptedKeys.length === 0) {
        toast.error('Key çözümlenemedi');
        return;
      }

      const walletsData: AirdropWallet[] = decryptedKeys.map(key => {
        const wallet = new ethers.Wallet(key);
        return {
          privateKey: key,
          address: wallet.address
        };
      });

      setWallets(walletsData);
      toast.success(`${walletsData.length} cüzdan yüklendi`);
    } catch (error) {
      toast.error('Key çözümlenemedi');
    }
  };

  const fetchBalance = async () => {
    if (!selectedTokenAddress || wallets.length === 0) {
      setSourceBalance('');
      return;
    }

    setIsFetchingBalance(true);
    try {
      const provider = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
      const sourceAddress = wallets[selectedSourceIndex].address;

      if (selectedTokenAddress === 'NATIVE') {
        const balance = await provider.getBalance(sourceAddress);
        setSourceBalance(ethers.formatEther(balance));
      } else {
        const tokenContract = new ethers.Contract(selectedTokenAddress, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(sourceAddress);
        const decimals = await tokenContract.decimals();
        setSourceBalance(ethers.formatUnits(balance, decimals));
      }
    } catch (error) {
      console.error('Balance fetch error:', error);
      setSourceBalance('Error');
    } finally {
      setIsFetchingBalance(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [selectedTokenAddress, selectedSourceIndex, wallets]);

  const handleTokenChange = (symbol: string) => {
    if (symbol === 'AVAX') {
      setSelectedToken('AVAX');
      setSelectedTokenAddress('NATIVE');
    } else {
      const token = availableTokens.find(t => t.symbol === symbol);
      if (token) {
        setSelectedToken(symbol);
        setSelectedTokenAddress(token.address);
      }
    }
  };

  const copyAddress = () => {
    if (wallets[selectedSourceIndex]) {
      navigator.clipboard.writeText(wallets[selectedSourceIndex].address);
      toast.success('Adres kopyalandı');
    }
  };

  const performWithdraw = async () => {
    if (!selectedToken || !amount || !targetAddress) {
      toast.error('Token, miktar ve hedef adres giriniz');
      return;
    }

    if (!ethers.isAddress(targetAddress)) {
      toast.error('Geçersiz hedef adres');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Geçerli bir miktar giriniz');
      return;
    }

    setIsAirdropping(true);

    try {
      const provider = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
      const sourceWallet = new ethers.Wallet(wallets[selectedSourceIndex].privateKey, provider);

      if (selectedTokenAddress === 'NATIVE') {
        toast.info(`${amount} AVAX gönderiliyor...`);
        const tx = await sourceWallet.sendTransaction({
          to: targetAddress,
          value: ethers.parseEther(amount)
        });
        await tx.wait();
        toast.success(`${amount} AVAX başarıyla gönderildi!`);
      } else {
        const tokenContract = new ethers.Contract(selectedTokenAddress, ERC20_ABI, sourceWallet);
        const decimals = await tokenContract.decimals();
        const amountInWei = ethers.parseUnits(amount, decimals);

        toast.info(`${amount} ${selectedToken} gönderiliyor...`);
        const tx = await tokenContract.transfer(targetAddress, amountInWei);
        await tx.wait();
        toast.success(`${amount} ${selectedToken} başarıyla gönderildi!`);
      }
      
      // Refresh balance after withdraw
      fetchBalance();
    } catch (error: any) {
      console.error('Withdraw error:', error);
      toast.error(`Withdraw hatası: ${error.message}`);
    } finally {
      setIsAirdropping(false);
    }
  };

  const performAirdrop = async () => {
    if (wallets.length < 2) {
      toast.error('En az 2 cüzdan gerekli');
      return;
    }

    if (!selectedToken || !amount) {
      toast.error('Token ve miktar giriniz');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Geçerli bir miktar giriniz');
      return;
    }

    setIsAirdropping(true);

    try {
      const provider = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
      const sourceWallet = new ethers.Wallet(wallets[selectedSourceIndex].privateKey, provider);
      const targetWallets = wallets.filter((_, index) => index !== selectedSourceIndex);

      if (selectedTokenAddress === 'NATIVE') {
        // Native AVAX airdrop
        toast.info(`${targetWallets.length} cüzdana ${amount} AVAX gönderiliyor...`);
        
        let successCount = 0;
        let failedWallets: string[] = [];
        
        for (const [index, targetWallet] of targetWallets.entries()) {
          try {
            const tx = await sourceWallet.sendTransaction({
              to: targetWallet.address,
              value: ethers.parseEther(amount)
            });
            await tx.wait();
            successCount++;
            toast.success(`${index + 1}/${targetWallets.length} - ${targetWallet.address.slice(0, 10)}... ✓`);
          } catch (error: any) {
            console.error(`Transfer error to ${targetWallet.address}:`, error);
            failedWallets.push(targetWallet.address);
            toast.error(`${index + 1}/${targetWallets.length} - ${targetWallet.address.slice(0, 10)}... Hata`);
          }
        }

        if (failedWallets.length > 0) {
          toast.warning(`${failedWallets.length} cüzdana gönderilemedi`);
        }
        toast.success(`Airdrop tamamlandı! ${successCount}/${targetWallets.length} başarılı`);
      } else {
        // ERC20 token airdrop
        const tokenContract = new ethers.Contract(selectedTokenAddress, ERC20_ABI, sourceWallet);
        const decimals = await tokenContract.decimals();
        const amountInWei = ethers.parseUnits(amount, decimals);

        toast.info(`${targetWallets.length} cüzdana ${amount} ${selectedToken} gönderiliyor...`);
        
        let successCount = 0;
        let failedWallets: string[] = [];
        
        for (const [index, targetWallet] of targetWallets.entries()) {
          try {
            const tx = await tokenContract.transfer(targetWallet.address, amountInWei);
            await tx.wait();
            successCount++;
            toast.success(`${index + 1}/${targetWallets.length} - ${targetWallet.address.slice(0, 10)}... ✓`);
          } catch (error: any) {
            console.error(`Transfer error to ${targetWallet.address}:`, error);
            failedWallets.push(targetWallet.address);
            toast.error(`${index + 1}/${targetWallets.length} - ${targetWallet.address.slice(0, 10)}... Hata`);
          }
        }

        if (failedWallets.length > 0) {
          toast.warning(`${failedWallets.length} cüzdana gönderilemedi`);
        }
        toast.success(`Airdrop tamamlandı! ${successCount}/${targetWallets.length} başarılı`);
      }
    } catch (error: any) {
      console.error('Airdrop error:', error);
      toast.error(`Airdrop hatası: ${error.message}`);
    } finally {
      setIsAirdropping(false);
    }
  };

  const selectedTokenData = availableTokens.find(t => t.symbol === selectedToken);

  return (
    <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-orange-400" />
            <h3 className="text-sm font-semibold text-foreground">
              Multi-Wallet Airdrop
            </h3>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-4 space-y-3">
            {/* Password & Load Wallets */}
            {wallets.length === 0 ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  SwapBot'tan Cüzdanları Yükle
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Şifre giriniz"
                    className="h-8 text-xs bg-background/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadWallets();
                      }
                    }}
                  />
                  <Button
                    onClick={loadWallets}
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                  >
                    Yükle
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  ℹ️ SwapBot'ta kaydettiğiniz private key'leri kullanır
                </p>
              </div>
            ) : (
              <>
                {/* Wallet Count Info */}
                <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded">
                  <p className="text-xs text-orange-400 font-semibold">
                    ✓ {wallets.length} cüzdan yüklendi
                  </p>
                </div>

                {/* Mode Tabs */}
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'airdrop' | 'withdraw')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="airdrop" className="text-xs" disabled={isAirdropping}>
                      <Send className="w-3 h-3 mr-1" />
                      Airdrop
                    </TabsTrigger>
                    <TabsTrigger value="withdraw" className="text-xs" disabled={isAirdropping}>
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      Withdraw
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="airdrop" className="space-y-3 mt-3">
                    {/* Source Wallet Selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        Kaynak Cüzdan
                      </label>
                      <div className="flex gap-2">
                        <Select
                          value={selectedSourceIndex.toString()}
                          onValueChange={(value) => setSelectedSourceIndex(parseInt(value))}
                          disabled={isAirdropping}
                        >
                          <SelectTrigger className="h-9 text-xs bg-background/50 flex-1">
                            <SelectValue>
                              <span className="font-mono text-[10px]">
                                #{selectedSourceIndex + 1} - {wallets[selectedSourceIndex]?.address.slice(0, 10)}...{wallets[selectedSourceIndex]?.address.slice(-6)}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                            {wallets.map((wallet, index) => (
                              <SelectItem key={index} value={index.toString()} className="cursor-pointer hover:bg-accent">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold">#{index + 1}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {wallet.address.slice(0, 10)}...{wallet.address.slice(-6)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={copyAddress}
                          size="sm"
                          variant="outline"
                          className="h-9 px-3"
                          disabled={isAirdropping}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Bu cüzdandan diğer {wallets.length - 1} cüzdana gönderilecek
                      </p>
                    </div>

                    {/* Token Selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Token</label>
                      <Select 
                        value={selectedToken} 
                        onValueChange={handleTokenChange}
                        disabled={isAirdropping}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background/50">
                          <SelectValue placeholder="Token seçin">
                            {selectedTokenData && (
                              <div className="flex items-center gap-2">
                                <img src={selectedTokenData.logo} alt={selectedTokenData.symbol} className="w-4 h-4 rounded-full" />
                                {selectedTokenData.symbol}
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                          {availableTokens.map((token) => (
                            <SelectItem key={token.id} value={token.symbol} className="cursor-pointer hover:bg-accent">
                              <div className="flex items-center gap-2">
                                <img src={token.logo} alt={token.symbol} className="w-4 h-4 rounded-full" />
                                {token.symbol}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedToken && (
                        <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                          <p className="text-[10px] text-blue-400">
                            💰 Bakiye: {isFetchingBalance ? 'Yükleniyor...' : `${parseFloat(sourceBalance).toFixed(6)} ${selectedToken}`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        Miktar (Her cüzdana)
                      </label>
                      <Input
                        type="number"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.0"
                        className="h-9 text-xs bg-background/50"
                        disabled={isAirdropping}
                      />
                    </div>

                    {/* Airdrop Button */}
                    <Button
                      onClick={performAirdrop}
                      disabled={isAirdropping || !selectedToken || !amount || wallets.length < 2}
                      className="w-full h-9 text-xs bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      {isAirdropping ? 'Gönderiliyor...' : `${wallets.length - 1} Cüzdana Airdrop Yap`}
                    </Button>

                    {/* Info */}
                    <div className="p-2 bg-blue-500/10 rounded border border-blue-500/30">
                      <p className="text-[10px] text-blue-400">
                        ℹ️ Her cüzdana {amount || '0'} {selectedToken || 'token'} gönderilecek. Toplam: {((parseFloat(amount) || 0) * (wallets.length - 1)).toFixed(6)} {selectedToken}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="withdraw" className="space-y-3 mt-3">
                    {/* Source Wallet Selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        Cüzdan Seç
                      </label>
                      <div className="flex gap-2">
                        <Select
                          value={selectedSourceIndex.toString()}
                          onValueChange={(value) => setSelectedSourceIndex(parseInt(value))}
                          disabled={isAirdropping}
                        >
                          <SelectTrigger className="h-9 text-xs bg-background/50 flex-1">
                            <SelectValue>
                              <span className="font-mono text-[10px]">
                                #{selectedSourceIndex + 1} - {wallets[selectedSourceIndex]?.address.slice(0, 10)}...{wallets[selectedSourceIndex]?.address.slice(-6)}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                            {wallets.map((wallet, index) => (
                              <SelectItem key={index} value={index.toString()} className="cursor-pointer hover:bg-accent">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold">#{index + 1}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {wallet.address.slice(0, 10)}...{wallet.address.slice(-6)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={copyAddress}
                          size="sm"
                          variant="outline"
                          className="h-9 px-3"
                          disabled={isAirdropping}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Token Selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Token</label>
                      <Select 
                        value={selectedToken} 
                        onValueChange={handleTokenChange}
                        disabled={isAirdropping}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background/50">
                          <SelectValue placeholder="Token seçin">
                            {selectedTokenData && (
                              <div className="flex items-center gap-2">
                                <img src={selectedTokenData.logo} alt={selectedTokenData.symbol} className="w-4 h-4 rounded-full" />
                                {selectedTokenData.symbol}
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                          {availableTokens.map((token) => (
                            <SelectItem key={token.id} value={token.symbol} className="cursor-pointer hover:bg-accent">
                              <div className="flex items-center gap-2">
                                <img src={token.logo} alt={token.symbol} className="w-4 h-4 rounded-full" />
                                {token.symbol}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedToken && (
                        <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                          <p className="text-[10px] text-blue-400">
                            💰 Bakiye: {isFetchingBalance ? 'Yükleniyor...' : `${parseFloat(sourceBalance).toFixed(6)} ${selectedToken}`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Target Address Selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <img 
                          src="https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png" 
                          alt="Safe"
                          className="w-3 h-3"
                        />
                        Hedef Adres (Multisig)
                      </label>
                      <Select
                        value={targetAddress}
                        onValueChange={setTargetAddress}
                        disabled={isAirdropping}
                      >
                        <SelectTrigger className="h-12 text-xs bg-background/50 border-corporate-blue/30">
                          <SelectValue placeholder="Multisig cüzdan seçin">
                            {targetAddress && multisigWallets.length > 0 && (
                              <div className="flex items-center gap-2">
                                <img 
                                  src="https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png" 
                                  alt="Safe"
                                  className="w-6 h-6"
                                />
                                <div className="flex flex-col items-start">
                                  <span className="text-sm font-bold text-foreground">
                                    {multisigWallets.find(w => w.address === targetAddress)?.label}
                                  </span>
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {targetAddress.slice(0, 10)}...{targetAddress.slice(-6)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                          {multisigWallets.map((wallet) => (
                            <SelectItem 
                              key={wallet.address} 
                              value={wallet.address} 
                              className="cursor-pointer hover:bg-accent py-3"
                            >
                              <div className="flex items-center gap-3">
                                <img 
                                  src="https://s2.coinmarketcap.com/static/img/coins/200x200/21585.png" 
                                  alt="Safe"
                                  className="w-7 h-7 flex-shrink-0"
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-foreground">{wallet.label}</span>
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {wallet.address.slice(0, 16)}...{wallet.address.slice(-8)}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {multisigWallets.length === 0 && (
                        <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                          <p className="text-[10px] text-yellow-400">
                            ⚠️ Wallet Manager'dan multisig cüzdan ekleyin
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        Miktar
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="any"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setPercentAmount('');
                          }}
                          placeholder="0.0"
                          className="h-9 text-xs bg-background/50 flex-1"
                          disabled={isAirdropping}
                        />
                        <Button
                          onClick={() => {
                            if (sourceBalance && sourceBalance !== 'Error') {
                              setAmount(sourceBalance);
                              setPercentAmount('100');
                            }
                          }}
                          size="sm"
                          variant="outline"
                          className="h-9 px-3 text-xs"
                          disabled={isAirdropping || !sourceBalance || sourceBalance === 'Error'}
                        >
                          MAX
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        {['25', '50', '75', '100'].map((percent) => (
                          <Button
                            key={percent}
                            onClick={() => {
                              if (sourceBalance && sourceBalance !== 'Error') {
                                const balanceNum = parseFloat(sourceBalance);
                                const percentNum = parseFloat(percent);
                                const calculatedAmount = (balanceNum * percentNum / 100).toString();
                                setAmount(calculatedAmount);
                                setPercentAmount(percent);
                              }
                            }}
                            size="sm"
                            variant={percentAmount === percent ? "default" : "outline"}
                            className="h-7 px-2 text-[10px] flex-1"
                            disabled={isAirdropping || !sourceBalance || sourceBalance === 'Error'}
                          >
                            {percent}%
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Withdraw Button */}
                    <Button
                      onClick={performWithdraw}
                      disabled={isAirdropping || !selectedToken || !amount || !targetAddress}
                      className="w-full h-9 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      {isAirdropping ? 'Gönderiliyor...' : 'Withdraw Yap'}
                    </Button>

                    {/* Info */}
                    <div className="p-2 bg-purple-500/10 rounded border border-purple-500/30">
                      <p className="text-[10px] text-purple-400">
                        ℹ️ Seçili cüzdandan {amount || '0'} {selectedToken || 'token'} çekilecek
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
