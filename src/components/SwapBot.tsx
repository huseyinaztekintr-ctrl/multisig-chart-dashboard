import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RefreshCw, ChevronDown, Play, Square, Eye, EyeOff, Lock, Unlock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import { getEnabledTokens } from './TokenManager';
import { getEnabledWallets, type MultisigWallet } from './WalletManager';
import CryptoJS from 'crypto-js';

interface SwapConfig {
  tokenX: string;
  tokenXAddress: string;
  tokenY: string;
  tokenYAddress: string;
  swapAmount: string;
  swapCount: number;
  intervalSeconds: number;
  privateKeys: string[];
  transferTargetAddress: string;
}

interface WalletBalances {
  tokenX: string;
  tokenY: string;
  walletAddress: string;
}

interface SwapStatus {
  isRunning: boolean;
  currentCount: number;
  lastSwapTime: string;
  nextSwapIn: number;
  currentDirection: 'X->Y' | 'Y->X';
  currentKeyIndex: number;
}

// Trader Joe Router V2.1 on Avalanche C-Chain
const ROUTER_ADDRESS = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
  'function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amounts)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];

const STORAGE_KEY_ENCRYPTED_PKS = 'swapbot-encrypted-pks';
const STORAGE_KEY_PASSWORD_HASH = 'swapbot-password-hash';

export const SwapBot = () => {
  const [multisigWallets, setMultisigWallets] = useState<MultisigWallet[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showPrivateKeys, setShowPrivateKeys] = useState<boolean[]>([]);
  const [newPrivateKey, setNewPrivateKey] = useState('');
  const [phraseKey, setPhraseKey] = useState('');
  const [config, setConfig] = useState<SwapConfig>({
    tokenX: '',
    tokenXAddress: '',
    tokenY: '',
    tokenYAddress: '',
    swapAmount: '',
    swapCount: 100,
    intervalSeconds: 30,
    privateKeys: [],
    transferTargetAddress: '',
  });
  
  // Password protection states
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [showViewKeyDialog, setShowViewKeyDialog] = useState(false);
  const [viewPassword, setViewPassword] = useState('');
  const [decryptedKey, setDecryptedKey] = useState('');
  const [status, setStatus] = useState<SwapStatus>({
    isRunning: false,
    currentCount: 0,
    lastSwapTime: '-',
    nextSwapIn: 0,
    currentDirection: 'X->Y',
    currentKeyIndex: 0,
  });
  const [availableTokens, setAvailableTokens] = useState<any[]>([]);
  const [balances, setBalances] = useState<WalletBalances>({
    tokenX: '0',
    tokenY: '0',
    walletAddress: '',
  });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [gasPrice, setGasPrice] = useState<string>('0');
  const [isGasHigh, setIsGasHigh] = useState(false);
  
  const swapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSwapAmountRef = useRef<string>('');

  // Load enabled tokens, wallets and check for saved encrypted key
  useEffect(() => {
    const loadTokens = () => {
      const tokens = getEnabledTokens();
      setAvailableTokens(tokens);
    };
    
    const loadWallets = () => {
      const wallets = getEnabledWallets();
      setMultisigWallets(wallets);
    };
    
    loadTokens();
    loadWallets();
    
    const handleTokensUpdate = () => loadTokens();
    const handleWalletsUpdate = () => loadWallets();
    
    window.addEventListener('tokens-updated', handleTokensUpdate);
    window.addEventListener('wallets-updated', handleWalletsUpdate);
    
    // Check if password is set
    const savedPasswordHash = localStorage.getItem(STORAGE_KEY_PASSWORD_HASH);
    const savedEncryptedKeys = localStorage.getItem(STORAGE_KEY_ENCRYPTED_PKS);
    setIsPasswordSet(!!savedPasswordHash && !!savedEncryptedKeys);
    
    return () => {
      window.removeEventListener('tokens-updated', handleTokensUpdate);
      window.removeEventListener('wallets-updated', handleWalletsUpdate);
    };
  }, []);

  // Load wallet balances - uses first private key for display
  const loadWalletBalances = async () => {
    if (config.privateKeys.length === 0 || !config.tokenXAddress || !config.tokenYAddress) {
      return;
    }

    try {
      setIsLoadingBalances(true);
      const provider = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
      const wallet = new ethers.Wallet(config.privateKeys[0], provider);
      
      const tokenXContract = new ethers.Contract(config.tokenXAddress, ERC20_ABI, provider);
      const tokenYContract = new ethers.Contract(config.tokenYAddress, ERC20_ABI, provider);

      const [balanceX, balanceY, decimalsX, decimalsY] = await Promise.all([
        tokenXContract.balanceOf(wallet.address),
        tokenYContract.balanceOf(wallet.address),
        tokenXContract.decimals(),
        tokenYContract.decimals(),
      ]);

      setBalances({
        tokenX: ethers.formatUnits(balanceX, decimalsX),
        tokenY: ethers.formatUnits(balanceY, decimalsY),
        walletAddress: wallet.address,
      });
    } catch (error) {
      console.error('Balance load error:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  // Reload balances when config changes
  useEffect(() => {
    loadWalletBalances();
  }, [config.privateKeys, config.tokenXAddress, config.tokenYAddress]);

  // Monitor gas price
  useEffect(() => {
    const checkGasPrice = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
        const feeData = await provider.getFeeData();
        if (feeData.gasPrice) {
          const gasPriceInNanoAvax = parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei'));
          setGasPrice(gasPriceInNanoAvax.toFixed(2));
          setIsGasHigh(gasPriceInNanoAvax >= 2);
        }
      } catch (error) {
        console.error('Gas price check error:', error);
      }
    };

    checkGasPrice();
    const interval = setInterval(checkGasPrice, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Hash password using SHA256
  const hashPassword = (pwd: string): string => {
    return CryptoJS.SHA256(pwd).toString();
  };

  // Encrypt private key
  const encryptPrivateKey = (key: string, pwd: string): string => {
    return CryptoJS.AES.encrypt(key, pwd).toString();
  };

  // Decrypt private key
  const decryptPrivateKey = (encryptedKey: string, pwd: string): string | null => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedKey, pwd);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || null;
    } catch {
      return null;
    }
  };

  // Save encrypted private keys with password
  const saveEncryptedKeys = () => {
    if (config.privateKeys.length === 0) {
      toast.error('En az bir private key giriniz');
      return;
    }

    if (!password) {
      toast.error('Şifre giriniz');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }

    if (password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı');
      return;
    }

    // Encrypt all keys and save
    const encryptedKeys = config.privateKeys.map(key => encryptPrivateKey(key, password));
    const passwordHash = hashPassword(password);
    
    localStorage.setItem(STORAGE_KEY_ENCRYPTED_PKS, JSON.stringify(encryptedKeys));
    localStorage.setItem(STORAGE_KEY_PASSWORD_HASH, passwordHash);
    
    setIsPasswordSet(true);
    setShowPasswordDialog(false);
    setPassword('');
    setConfirmPassword('');
    
    toast.success(`${config.privateKeys.length} private key şifrelenerek kaydedildi`);
  };

  // View encrypted keys with password
  const viewEncryptedKeys = () => {
    if (!viewPassword) {
      toast.error('Şifre giriniz');
      return;
    }

    const savedPasswordHash = localStorage.getItem(STORAGE_KEY_PASSWORD_HASH);
    const savedEncryptedKeys = localStorage.getItem(STORAGE_KEY_ENCRYPTED_PKS);
    
    if (!savedPasswordHash || !savedEncryptedKeys) {
      toast.error('Kaydedilmiş key bulunamadı');
      return;
    }

    const enteredPasswordHash = hashPassword(viewPassword);
    
    if (enteredPasswordHash !== savedPasswordHash) {
      toast.error('Yanlış şifre!');
      setViewPassword('');
      return;
    }

    try {
      const encryptedKeysArray = JSON.parse(savedEncryptedKeys);
      const decryptedKeys = encryptedKeysArray.map((encKey: string) => 
        decryptPrivateKey(encKey, viewPassword)
      ).filter(Boolean) as string[];
      
      if (decryptedKeys.length === 0) {
        toast.error('Key çözümlenemedi');
        return;
      }

      setDecryptedKey(decryptedKeys.join('\n'));
      setConfig(prev => ({ ...prev, privateKeys: decryptedKeys }));
      setShowPrivateKeys(new Array(decryptedKeys.length).fill(false));
      toast.success(`${decryptedKeys.length} key başarıyla yüklendi`);
    } catch (error) {
      toast.error('Key çözümlenemedi');
    }
  };

  // Load keys for bot execution
  const loadKeysForExecution = (): boolean => {
    if (config.privateKeys.length > 0) {
      return true; // Already loaded in memory
    }

    const savedEncryptedKeys = localStorage.getItem(STORAGE_KEY_ENCRYPTED_PKS);
    if (!savedEncryptedKeys) {
      toast.error('Private key kaydedilmemiş');
      return false;
    }

    toast.error('Private key şifreli. Önce görüntüleyip yükleyin.');
    return false;
  };

  // Clear password and encrypted keys
  const clearEncryptedKeys = () => {
    if (window.confirm('Kaydedilmiş şifreli key\'leri silmek istediğinize emin misiniz?')) {
      localStorage.removeItem(STORAGE_KEY_ENCRYPTED_PKS);
      localStorage.removeItem(STORAGE_KEY_PASSWORD_HASH);
      setIsPasswordSet(false);
      setConfig(prev => ({ ...prev, privateKeys: [] }));
      setDecryptedKey('');
      setShowPrivateKeys([]);
      toast.info('Şifreli key\'ler silindi');
    }
  };

  // Get address from private key
  const getAddressFromPrivateKey = (privateKey: string): string => {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return wallet.address;
    } catch {
      return 'Invalid Key';
    }
  };

  // Add private key to list
  const addPrivateKey = () => {
    if (!newPrivateKey.trim()) {
      toast.error('Private key giriniz');
      return;
    }
    
    if (!newPrivateKey.startsWith('0x')) {
      toast.error('Private key 0x ile başlamalı');
      return;
    }

    if (config.privateKeys.includes(newPrivateKey)) {
      toast.error('Bu key zaten listede');
      return;
    }

    setConfig(prev => ({ 
      ...prev, 
      privateKeys: [...prev.privateKeys, newPrivateKey] 
    }));
    setShowPrivateKeys(prev => [...prev, false]);
    setNewPrivateKey('');
    toast.success('Private key eklendi');
  };

  // Add phrase key and derive 100 wallets
  const addPhraseKey = async () => {
    if (!phraseKey.trim()) {
      toast.error('Phrase key giriniz');
      return;
    }

    const words = phraseKey.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      toast.error('Phrase key 12 veya 24 kelime olmalı');
      return;
    }

    try {
      toast.info('Phrase key\'den 100 cüzdan türetiliyor...');
      
      const mnemonic = ethers.Mnemonic.fromPhrase(phraseKey.trim());
      const newKeys: string[] = [];
      
      for (let i = 0; i < 100; i++) {
        const path = `m/44'/60'/0'/0/${i}`;
        const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, path);
        newKeys.push(wallet.privateKey);
      }

      // Filter out duplicates
      const uniqueKeys = newKeys.filter(key => !config.privateKeys.includes(key));
      
      if (uniqueKeys.length === 0) {
        toast.error('Bu phrase key\'in tüm cüzdanları zaten listede');
        return;
      }

      setConfig(prev => ({ 
        ...prev, 
        privateKeys: [...prev.privateKeys, ...uniqueKeys] 
      }));
      setShowPrivateKeys(prev => [...prev, ...new Array(uniqueKeys.length).fill(false)]);
      setPhraseKey('');
      toast.success(`${uniqueKeys.length} adet cüzdan eklendi (toplam: ${config.privateKeys.length + uniqueKeys.length})`);
    } catch (error: any) {
      console.error('Phrase key error:', error);
      toast.error('Geçersiz phrase key: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  // Remove private key from list
  const removePrivateKey = (index: number) => {
    setConfig(prev => ({ 
      ...prev, 
      privateKeys: prev.privateKeys.filter((_, i) => i !== index) 
    }));
    setShowPrivateKeys(prev => prev.filter((_, i) => i !== index));
    toast.info('Private key silindi');
  };

  const handleTokenXChange = (symbol: string) => {
    const token = availableTokens.find(t => t.symbol === symbol);
    if (token) {
      setConfig(prev => ({
        ...prev,
        tokenX: symbol,
        tokenXAddress: token.address,
      }));
    }
  };

  const handleTokenYChange = (symbol: string) => {
    const token = availableTokens.find(t => t.symbol === symbol);
    if (token) {
      setConfig(prev => ({
        ...prev,
        tokenY: symbol,
        tokenYAddress: token.address,
      }));
    }
  };

  const startCountdown = (intervalSeconds: number) => {
    setStatus(prev => ({ ...prev, nextSwapIn: intervalSeconds }));
    
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    countdownIntervalRef.current = setInterval(() => {
      setStatus(prev => {
        const newValue = prev.nextSwapIn - 1;
        if (newValue < 0) return prev;
        return { ...prev, nextSwapIn: newValue };
      });
    }, 1000);
  };

  const executeSwap = async (fromToken: string, toToken: string, amount: string, direction: 'X->Y' | 'Y->X', keyIndex: number) => {
    try {
      if (config.privateKeys.length === 0) {
        toast.error('Private key girilmedi');
        return null;
      }

      const currentKey = config.privateKeys[keyIndex];
      const provider = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
      const wallet = new ethers.Wallet(currentKey, provider);
      
      console.log(`🔑 Swap için cüzdan #${keyIndex + 1} kullanılıyor:`, wallet.address.slice(0, 10) + '...');
      
      const fromTokenContract = new ethers.Contract(fromToken, ERC20_ABI, wallet);
      const toTokenContract = new ethers.Contract(toToken, ERC20_ABI, wallet);
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);

      // Get decimals
      const fromDecimals = await fromTokenContract.decimals();
      const toDecimals = await toTokenContract.decimals();
      const amountIn = ethers.parseUnits(amount, fromDecimals);

      // Check balance
      const balance = await fromTokenContract.balanceOf(wallet.address);
      if (balance < amountIn) {
        const fromTokenName = direction === 'X->Y' ? config.tokenX : config.tokenY;
        toast.error(`Yetersiz ${fromTokenName} bakiyesi`);
        return null;
      }

      // Check and approve if needed
      const allowance = await fromTokenContract.allowance(wallet.address, ROUTER_ADDRESS);
      if (allowance < amountIn) {
        toast.info('Token onayı yapılıyor...');
        const approveTx = await fromTokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
        toast.success('Token onaylandı');
      }

      // Get expected output
      const path = [fromToken, toToken];
      const amountsOut = await router.getAmountsOut(amountIn, path);
      const amountOutMin = (amountsOut[1] * 95n) / 100n; // 5% slippage

      // Record balance before swap to compute exact received amount
      console.log('🔍 Swap detayları:', {
        direction,
        fromToken,
        toToken,
        fromTokenName: direction === 'X->Y' ? config.tokenX : config.tokenY,
        toTokenName: direction === 'X->Y' ? config.tokenY : config.tokenX,
        swapAmount: amount
      });
      
      const beforeToBalance = await toTokenContract.balanceOf(wallet.address);
      console.log('📊 Swap öncesi hedef token bakiyesi:', ethers.formatUnits(beforeToBalance, toDecimals));

      // Execute swap
      const fromTokenName = direction === 'X->Y' ? config.tokenX : config.tokenY;
      const toTokenName = direction === 'X->Y' ? config.tokenY : config.tokenX;
      toast.info(`Cüzdan #${keyIndex + 1}: ${amount} ${fromTokenName} → ${toTokenName} (${direction})`);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      const swapTx = await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        wallet.address,
        deadline
      );
      
      await swapTx.wait();

      // Compute actual received amount using balance delta
      const afterToBalance = await toTokenContract.balanceOf(wallet.address);
      const receivedAmountBigInt = afterToBalance - beforeToBalance;
      console.log('📊 Swap sonrası hedef token bakiyesi:', ethers.formatUnits(afterToBalance, toDecimals));
      console.log('💰 Alınan miktar:', ethers.formatUnits(receivedAmountBigInt, toDecimals), toTokenName);
      
      if (receivedAmountBigInt <= 0n) {
        toast.error('Swap sonrası alınan miktar tespit edilemedi');
        return null;
      }
      const receivedAmount = ethers.formatUnits(receivedAmountBigInt, toDecimals);
      
      // Transfer received tokens to target address if specified
      // Only transfer when we receive Token Y (not Token X)
      const shouldTransfer = config.transferTargetAddress && direction === 'X->Y';
      
      if (shouldTransfer) {
        try {
          console.log('📤 Transfer başlıyor:', {
            token: toTokenName,
            tokenAddress: toToken,
            amount: receivedAmount,
            to: config.transferTargetAddress
          });
          toast.info(`${receivedAmount} ${toTokenName} transfer yapılıyor...`);
          const transferTx = await toTokenContract.transfer(config.transferTargetAddress, receivedAmountBigInt);
          await transferTx.wait();
          console.log('✅ Transfer başarılı:', transferTx.hash);
          toast.success(`Cüzdan #${keyIndex + 1} - Swap ve transfer başarılı! ${receivedAmount} ${toTokenName}`);
        } catch (transferError: any) {
          console.error('❌ Transfer error:', transferError);
          toast.error(`Transfer hatası: ${transferError.message || 'Bilinmeyen hata'}`);
          // Don't return null - continue bot even if transfer fails
        }
      } else {
        const transferNote = config.transferTargetAddress && direction === 'Y->X' 
          ? ` (Transfer yok: ${toTokenName} Token X)` 
          : '';
        toast.success(`Cüzdan #${keyIndex + 1} - ${direction} başarılı! Alınan: ${receivedAmount} ${toTokenName}${transferNote}`);
      }

      // Reload balances after successful swap
      loadWalletBalances();
      
      return receivedAmount;
    } catch (error: any) {
      console.error('Swap error:', error);
      toast.error(`Swap hatası: ${error.message || 'Bilinmeyen hata'}`);
      return null;
    }
  };

  const scheduleNextSwap = (nextKeyIndex: number) => {
    swapTimeoutRef.current = setTimeout(() => {
      performSwapCycle(nextKeyIndex);
    }, config.intervalSeconds * 1000);
  };

  const performSwapCycle = async (keyIndexToUse?: number) => {
    // Check gas price before executing swap
    if (isGasHigh) {
      toast.warning(`⛽ Gas çok yüksek (${gasPrice} nAVAX), bekleniyor...`);
      startCountdown(config.intervalSeconds);
      scheduleNextSwap(keyIndexToUse ?? 0);
      return;
    }

    const isXtoY = status.currentDirection === 'X->Y';
    const fromToken = isXtoY ? config.tokenXAddress : config.tokenYAddress;
    const toToken = isXtoY ? config.tokenYAddress : config.tokenXAddress;
    const direction = status.currentDirection;
    
    // Use provided keyIndex or start from 0
    const currentKeyIndex = (keyIndexToUse ?? 0) % config.privateKeys.length;
    const nextKeyIndex = (currentKeyIndex + 1) % config.privateKeys.length;
    
    // When transfer is enabled, always use initial swap amount
    // Otherwise, use the received amount from previous swap
    const amountToSwap = config.transferTargetAddress 
      ? config.swapAmount 
      : (status.currentCount === 0 ? config.swapAmount : lastSwapAmountRef.current);
    
    const receivedAmount = await executeSwap(fromToken, toToken, amountToSwap, direction, currentKeyIndex);
    
    if (receivedAmount !== null) {
      const newCount = status.currentCount + 1;
      
      // When transfer is enabled, keep the same direction (X->Y only)
      // Otherwise, alternate direction for normal ping-pong swaps
      const newDirection = config.transferTargetAddress 
        ? 'X->Y'  // Always X->Y when transferring
        : (isXtoY ? 'Y->X' : 'X->Y');  // Alternate normally
      
      // Store the received amount for next swap (only used when no transfer)
      if (!config.transferTargetAddress) {
        lastSwapAmountRef.current = receivedAmount;
      }
      
      setStatus(prev => ({
        ...prev,
        currentCount: newCount,
        lastSwapTime: new Date().toLocaleTimeString('tr-TR'),
        currentDirection: newDirection,
        currentKeyIndex: nextKeyIndex,
      }));

      // Check if we've completed all swaps
      if (newCount >= config.swapCount * 2) {
        stopBot();
        toast.success('Tüm swap işlemleri tamamlandı!');
        lastSwapAmountRef.current = config.swapAmount; // Reset for next bot run
        return;
      }

      // Schedule next swap with the next key index
      startCountdown(config.intervalSeconds);
      scheduleNextSwap(nextKeyIndex);
    } else {
      stopBot();
      lastSwapAmountRef.current = config.swapAmount; // Reset on error
    }
  };

  const startBot = () => {
    if (!config.tokenX || !config.tokenY || !config.swapAmount) {
      toast.error('Lütfen token seçimi ve swap miktarını doldurun');
      return;
    }

    if (!loadKeysForExecution()) {
      return;
    }
    
    if (config.privateKeys.length === 0) {
      toast.error('En az bir private key giriniz');
      return;
    }

    if (config.tokenX === config.tokenY) {
      toast.error('Token X ve Token Y farklı olmalı');
      return;
    }

    if (parseFloat(config.swapAmount) <= 0) {
      toast.error('Swap miktarı 0\'dan büyük olmalı');
      return;
    }

    if (config.swapCount <= 0 || config.intervalSeconds <= 0) {
      toast.error('Swap sayısı ve interval 0\'dan büyük olmalı');
      return;
    }

    // Validate transfer address format if provided
    if (config.transferTargetAddress && !ethers.isAddress(config.transferTargetAddress)) {
      toast.error('Geçersiz hedef cüzdan adresi');
      return;
    }

    // Reset the amount reference to initial value
    lastSwapAmountRef.current = config.swapAmount;

    setStatus({
      isRunning: true,
      currentCount: 0,
      lastSwapTime: '-',
      nextSwapIn: 0,
      currentDirection: 'X->Y',
      currentKeyIndex: 0,
    });

    // Start first swap immediately
    performSwapCycle();

    toast.success(`Swap bot başlatıldı! ${config.privateKeys.length} cüzdan ile çalışıyor.`);
  };

  const stopBot = () => {
    if (swapTimeoutRef.current) {
      clearTimeout(swapTimeoutRef.current);
      swapTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setStatus(prev => ({ ...prev, isRunning: false, nextSwapIn: 0 }));
    toast.info('Swap bot durduruldu');
  };

  useEffect(() => {
    return () => {
      if (swapTimeoutRef.current) clearTimeout(swapTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const tokenXData = availableTokens.find(t => t.symbol === config.tokenX);
  const tokenYData = availableTokens.find(t => t.symbol === config.tokenY);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/50 ring-2 ring-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.4)] backdrop-blur-sm">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <img 
              src="https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw"
              alt="ORDER"
              className="w-5 h-5 rounded-full"
            />
            <h3 className="font-semibold text-sm text-foreground">ORDER SwapBot</h3>
            <RefreshCw className={`w-4 h-4 text-purple-400 ml-1 ${status.isRunning ? 'animate-spin' : ''}`} />
            {status.isRunning && (
              <div className="flex items-center gap-2 ml-auto mr-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 rounded border border-blue-500/40">
                  <span className="text-xs font-semibold text-blue-400">
                    Cüzdan #{status.currentKeyIndex + 1}/{config.privateKeys.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded border border-green-500/40">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-green-400">
                    {status.currentCount}/{config.swapCount * 2}
                  </span>
                </div>
                <div className="px-2 py-1 bg-purple-500/20 rounded border border-purple-500/40">
                  <span className="text-xs font-semibold text-purple-400">
                    {status.nextSwapIn}s
                  </span>
                </div>
              </div>
            )}
            <ChevronDown className={`w-4 h-4 text-purple-400 ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="space-y-3 mt-3">
            {/* Gas Price Monitor */}
            <div className={`p-2 rounded border ${isGasHigh ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-semibold">⛽ Gas Price:</span>
                  <span className={`font-bold ${isGasHigh ? 'text-red-400' : 'text-green-400'}`}>
                    {gasPrice} nAVAX
                  </span>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isGasHigh ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {isGasHigh ? '⏸️ DURAKLAT' : '✓ ÇALIŞ'}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {isGasHigh ? '⚠️ Gas 2 nAVAX üzerinde, bot beklemede' : '✓ Gas 2 nAVAX altında, bot çalışabilir'}
              </p>
            </div>

            {/* Status Display */}
            {status.isRunning && (
              <div className="p-2 bg-background/30 rounded border border-purple-500/30">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Yön:</span>
                    <span className="ml-1 font-bold text-purple-400">{status.currentDirection}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Son Swap:</span>
                    <span className="ml-1 font-bold text-foreground">{status.lastSwapTime}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Target Selection */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                <Send className="w-3 h-3" />
                Transfer Hedef Cüzdan (Opsiyonel)
              </label>
              <Select
                value={config.transferTargetAddress || "NONE"}
                onValueChange={(value) => setConfig(prev => ({ ...prev, transferTargetAddress: value === "NONE" ? "" : value }))}
                disabled={status.isRunning}
              >
                <SelectTrigger className="h-9 text-xs bg-background/50">
                  <SelectValue placeholder="Hedef seçin veya boş bırakın">
                    {config.transferTargetAddress ? (
                      <span className="font-mono text-[10px]">
                        {multisigWallets.find(w => w.address === config.transferTargetAddress)?.label || 
                         `${config.transferTargetAddress.slice(0, 6)}...${config.transferTargetAddress.slice(-4)}`}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Transfer Yok</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg z-[100]">
                  <SelectItem value="NONE" className="cursor-pointer hover:bg-accent">
                    <span className="text-xs text-muted-foreground">Transfer Yok</span>
                  </SelectItem>
                  {multisigWallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.address} className="cursor-pointer hover:bg-accent">
                      <div className="flex items-center gap-2">
                        {wallet.logo && (
                          <img src={wallet.logo} alt={wallet.label} className="w-4 h-4 rounded-full" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold">{wallet.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                ℹ️ Sadece Token Y (sağdaki) alındığında transfer edilir
              </p>
            </div>

            {/* Wallet Balances Display */}
            {balances.walletAddress && (
              <div className="p-2 bg-background/30 rounded border border-purple-500/30">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-semibold">Cüzdan Bakiyesi:</span>
                    <span className="font-mono text-[10px] text-foreground">
                      {balances.walletAddress.slice(0, 6)}...{balances.walletAddress.slice(-4)}
                    </span>
                  </div>
                  {config.tokenX && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        {tokenXData && <img src={tokenXData.logo} alt={tokenXData.symbol} className="w-3 h-3 rounded-full" />}
                        {config.tokenX}:
                      </span>
                      <span className="font-semibold text-purple-400">
                        {isLoadingBalances ? '...' : parseFloat(balances.tokenX).toFixed(6)}
                      </span>
                    </div>
                  )}
                  {config.tokenY && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        {tokenYData && <img src={tokenYData.logo} alt={tokenYData.symbol} className="w-3 h-3 rounded-full" />}
                        {config.tokenY}:
                      </span>
                      <span className="font-semibold text-pink-400">
                        {isLoadingBalances ? '...' : parseFloat(balances.tokenY).toFixed(6)}
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={loadWalletBalances}
                    disabled={isLoadingBalances || config.privateKeys.length === 0}
                    size="sm"
                    variant="outline"
                    className="w-full h-6 text-[10px] mt-1"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingBalances ? 'animate-spin' : ''}`} />
                    Bakiyeyi Yenile
                  </Button>
                </div>
              </div>
            )}

            {/* Token Selection */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Token Seçimi</label>
              <div className="grid grid-cols-2 gap-2">
                <Select 
                  value={config.tokenX} 
                  onValueChange={handleTokenXChange}
                  disabled={status.isRunning}
                >
                  <SelectTrigger className="h-9 text-xs bg-background/50">
                    <SelectValue placeholder="Token X">
                      {tokenXData && (
                        <div className="flex items-center gap-2">
                          <img src={tokenXData.logo} alt={tokenXData.symbol} className="w-4 h-4 rounded-full" />
                          {tokenXData.symbol}
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

                <Select 
                  value={config.tokenY} 
                  onValueChange={handleTokenYChange}
                  disabled={status.isRunning}
                >
                  <SelectTrigger className="h-9 text-xs bg-background/50">
                    <SelectValue placeholder="Token Y">
                      {tokenYData && (
                        <div className="flex items-center gap-2">
                          <img src={tokenYData.logo} alt={tokenYData.symbol} className="w-4 h-4 rounded-full" />
                          {tokenYData.symbol}
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
              </div>
            </div>

            {/* Swap Configuration */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Swap Ayarları</label>
              <Input
                type="number"
                step="0.000001"
                value={config.swapAmount}
                onChange={(e) => setConfig(prev => ({ ...prev, swapAmount: e.target.value }))}
                placeholder="Swap Miktarı (Token X bazlı)"
                className="h-8 text-xs bg-background/50"
                disabled={status.isRunning}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="number"
                    value={config.swapCount}
                    onChange={(e) => setConfig(prev => ({ ...prev, swapCount: parseInt(e.target.value) || 0 }))}
                    placeholder="Swap Sayısı"
                    className="h-8 text-xs bg-background/50"
                    disabled={status.isRunning}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Toplam: {config.swapCount * 2} swap
                  </p>
                </div>
                <div>
                  <Input
                    type="number"
                    value={config.intervalSeconds}
                    onChange={(e) => setConfig(prev => ({ ...prev, intervalSeconds: parseInt(e.target.value) || 0 }))}
                    placeholder="Interval (saniye)"
                    className="h-8 text-xs bg-background/50"
                    disabled={status.isRunning}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {config.intervalSeconds >= 60 
                      ? `${Math.floor(config.intervalSeconds / 60)}dk ${config.intervalSeconds % 60}s` 
                      : `${config.intervalSeconds}s`}
                  </p>
                </div>
              </div>
            </div>

            {/* Private Keys Management */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                Private Keys ({config.privateKeys.length})
                {isPasswordSet && <Lock className="w-3 h-3 text-green-500" />}
              </label>
              
              {!isPasswordSet ? (
                <>
                  {/* Add Phrase Key Input */}
                  <div className="space-y-2 p-2 bg-purple-500/5 border border-purple-500/20 rounded">
                    <label className="text-xs text-purple-400 font-semibold">
                      🔑 Phrase Key (12 veya 24 kelime)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={phraseKey}
                        onChange={(e) => setPhraseKey(e.target.value)}
                        placeholder="word1 word2 word3 ... (12 veya 24 kelime)"
                        className="h-8 text-xs bg-background/50 font-mono"
                        disabled={status.isRunning}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addPhraseKey();
                          }
                        }}
                      />
                      <Button
                        onClick={addPhraseKey}
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs border-purple-500/50 hover:bg-purple-500/10"
                        disabled={status.isRunning}
                      >
                        100 Cüzdan Türet
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Phrase key girerseniz otomatik olarak 100 alt hesap türetilir (m/44'/60'/0'/0/0 - m/44'/60'/0'/0/99)
                    </p>
                  </div>

                  {/* Add New Key Input */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        type={showPrivateKeys[config.privateKeys.length] ? "text" : "password"}
                        value={newPrivateKey}
                        onChange={(e) => setNewPrivateKey(e.target.value)}
                        placeholder="0x... (Yeni private key)"
                        className="h-8 text-xs bg-background/50 pr-8 font-mono"
                        disabled={status.isRunning}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addPrivateKey();
                          }
                        }}
                      />
                      <button
                        onClick={() => setShowPrivateKeys(prev => {
                          const newArr = [...prev];
                          newArr[config.privateKeys.length] = !newArr[config.privateKeys.length];
                          return newArr;
                        })}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        type="button"
                      >
                        {showPrivateKeys[config.privateKeys.length] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button
                      onClick={addPrivateKey}
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={status.isRunning}
                    >
                      Ekle
                    </Button>
                  </div>
                  
                  {/* List of Private Keys */}
                  {config.privateKeys.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {config.privateKeys.map((key, index) => {
                        const address = getAddressFromPrivateKey(key);
                        return (
                          <div key={index} className="flex flex-col gap-1 p-1.5 bg-background/30 rounded border border-border/30">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-semibold">#{index + 1}</span>
                              <Input
                                type={showPrivateKeys[index] ? "text" : "password"}
                                value={key}
                                className="h-6 text-[10px] bg-background/50 font-mono flex-1"
                                disabled
                              />
                              <button
                                onClick={() => setShowPrivateKeys(prev => {
                                  const newArr = [...prev];
                                  newArr[index] = !newArr[index];
                                  return newArr;
                                })}
                                className="text-muted-foreground hover:text-foreground"
                                type="button"
                              >
                                {showPrivateKeys[index] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                              <Button
                                onClick={() => removePrivateKey(index)}
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                disabled={status.isRunning}
                              >
                                ×
                              </Button>
                            </div>
                            <div className="ml-8 text-[10px] font-mono text-muted-foreground">
                              {address}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <Button
                    onClick={() => setShowPasswordDialog(true)}
                    disabled={config.privateKeys.length === 0 || status.isRunning}
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs border-green-500/50 hover:bg-green-500/10"
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    Şifrele ve Kaydet ({config.privateKeys.length} key)
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-green-500" />
                      <span className="text-green-400 font-semibold">{config.privateKeys.length || '?'} key şifreli kaydedildi</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {config.privateKeys.length > 0 ? `${config.privateKeys.length} key bellekte yüklü ✓` : 'Key görüntülemek için şifre girin'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => setShowViewKeyDialog(true)}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-purple-500/50 hover:bg-purple-500/10"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Görüntüle
                    </Button>
                    <Button
                      onClick={clearEncryptedKeys}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-red-500/50 hover:bg-red-500/10 text-red-400"
                    >
                      <Unlock className="w-3 h-3 mr-1" />
                      Temizle
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-yellow-500/80">
                ℹ️ Her swap farklı cüzdanla yapılır (sırayla döner)
              </p>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-2">
              {!status.isRunning ? (
                <Button
                  onClick={startBot}
                  className="flex-1 h-8 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Başlat
                </Button>
              ) : (
                <Button
                  onClick={stopBot}
                  variant="destructive"
                  className="flex-1 h-8 text-xs"
                >
                  <Square className="w-3 h-3 mr-1" />
                  Durdur
                </Button>
              )}
            </div>

            {/* Info */}
            <div className="p-2 bg-blue-500/10 rounded border border-blue-500/30">
              <p className="text-[10px] text-blue-400">
                ℹ️ Bot X→Y ve Y→X dönüşümlü çalışır. Her swap farklı cüzdan kullanır. {config.swapCount} swap = {config.swapCount * 2} işlem
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Card>

      {/* Password Setup Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-500" />
              Private Key Şifrele
            </DialogTitle>
            <DialogDescription>
              Private key'inizi şifrelemek için bir şifre belirleyin. Bu şifre ile key'iniz AES-256 ile şifrelenecek ve tarayıcıda güvenli şekilde saklanacak.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground">Şifre</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Şifre Tekrar</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Şifreyi tekrar girin"
                className="mt-1"
              />
            </div>
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-500/90">
              ⚠️ Bu şifreyi unutursanız private key'inize erişemezsiniz!
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPassword('');
                  setConfirmPassword('');
                }}
                variant="outline"
                className="flex-1"
              >
                İptal
              </Button>
              <Button
                onClick={saveEncryptedKeys}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                <Lock className="w-4 h-4 mr-1" />
                Şifrele
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Key Dialog */}
      <Dialog open={showViewKeyDialog} onOpenChange={(open) => {
        setShowViewKeyDialog(open);
        if (!open) {
          setViewPassword('');
          setDecryptedKey('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-500" />
              Private Key Görüntüle
            </DialogTitle>
            <DialogDescription>
              Şifrelenmiş private key'i görüntülemek için şifrenizi girin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground">Şifre</label>
              <Input
                type="password"
                value={viewPassword}
                onChange={(e) => setViewPassword(e.target.value)}
                placeholder="Şifrenizi girin"
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    viewEncryptedKeys();
                  }
                }}
              />
            </div>
            {decryptedKey && (
              <div>
                <label className="text-xs text-muted-foreground">Private Keys</label>
                <div className="mt-1 p-2 bg-muted/30 rounded border border-border font-mono text-xs break-all whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {decryptedKey}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowViewKeyDialog(false);
                  setViewPassword('');
                  setDecryptedKey('');
                }}
                variant="outline"
                className="flex-1"
              >
                Kapat
              </Button>
              <Button
                onClick={viewEncryptedKeys}
                disabled={!viewPassword}
                className="flex-1 bg-purple-500 hover:bg-purple-600"
              >
                <Eye className="w-4 h-4 mr-1" />
                Görüntüle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
};