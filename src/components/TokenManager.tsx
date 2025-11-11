import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Coins, Plus, ChevronDown, ChevronUp, Copy, Pencil, Check, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export interface MultisigToken {
  id: string;
  symbol: string;
  name: string;
  address: string;
  logo: string;
  pairAddress: string | null;
  enabled: boolean;
}

const DEFAULT_TOKENS: MultisigToken[] = [
  {
    id: '1',
    symbol: 'ARENA',
    name: 'Arena Token',
    address: '0xB8d7710f7d8349A506b75dD184F05777c82dAd0C',
    logo: 'https://imgproxy-mainnet.routescan.io/GrDCmdCkaNUaM4ZYPunjryrcLAPfBKsWp05O1rogplQ/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYXJlbmF0b2tlbi4zNjQ5YjNhMThhMDQucG5n',
    pairAddress: '0x3c5f68d2f72debba4900c60f32eb8629876401f2',
    enabled: true,
  },
  {
    id: '2',
    symbol: 'ORDER',
    name: 'ORDER Token',
    address: '0x1BEd077195307229FcCBC719C5f2ce6416A58180',
    logo: 'https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw',
    pairAddress: '0x5147fff4794fd96c1b0e64dcca921ca0ee1cda8d',
    enabled: false,
  },
  {
    id: '3',
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    logo: 'https://imgproxy-mainnet.routescan.io/_CkjIoBgQPOtUj_iXbgW7Af947je2xGUJnwXLMxMhmI/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvdXNkLWNvaW4tdXNkYy1sb2dvLjNiNTk3MmMxNmE5Ny5zdmc',
    pairAddress: null,
    enabled: true,
  },
  {
    id: '4',
    symbol: 'DAI.e',
    name: 'Dai Stablecoin',
    address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
    logo: 'https://imgproxy-mainnet.routescan.io/KXBq5ADiOubzvjufqEJxvwpBmeoVsRnyuGnAz2ImGTo/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvREFJLjE1NjZhZDBiOWJiNi5wbmc',
    pairAddress: null,
    enabled: true,
  },
  {
    id: '5',
    symbol: 'GHO',
    name: 'GHO Stablecoin',
    address: '0xfc421aD3C883Bf9E7C4f42dE845C4e4405799e73',
    logo: 'https://imgproxy-mainnet.routescan.io/yFJ0mA8KRWqJDuC2mAHftCShVJszMOsICMj-zpKG8JI/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvZ2hvLmRiZjMyZTg1YTYzMi5qcGc',
    pairAddress: null,
    enabled: true,
  },
  {
    id: '6',
    symbol: 'BTC.b',
    name: 'Bitcoin (Bridged)',
    address: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
    logo: 'https://imgproxy-mainnet.routescan.io/OxAf5qYKdQQppZBG_QoYolSAdZMTGfprsooSFp8pPRg/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvYml0Y29pbmJfMzIuYTlhMmIxOGJhYjQ1LnBuZw',
    pairAddress: '0x8FEF4fE4970a5D6bFa7C65871a2EbFD0F42aa822',
    enabled: true,
  },
  {
    id: '7',
    symbol: 'WAVAX',
    name: 'Wrapped AVAX',
    address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png',
    pairAddress: '0x864d4e5ee7318e97483db7eb0912e09f161516ea',
    enabled: true,
  },
  {
    id: '8',
    symbol: 'USDT.e',
    name: 'Bridge Tether',
    address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    logo: 'https://imgproxy-mainnet.routescan.io/Fb6h0SafZL7XFjqRB7ZYmrh5K4UBcz3e3idexRqjLBA/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvdXNkdC10ZXRoZXItbG9nby5kNTdiN2RlYzYxN2IucG5n',
    pairAddress: null,
    enabled: true,
  },
  {
    id: '9',
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    logo: 'https://imgproxy-mainnet.routescan.io/Fb6h0SafZL7XFjqRB7ZYmrh5K4UBcz3e3idexRqjLBA/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvdXNkdC10ZXRoZXItbG9nby5kNTdiN2RlYzYxN2IucG5n',
    pairAddress: null,
    enabled: true,
  },
  {
    id: '10',
    symbol: 'EURC',
    name: 'Circle EURO',
    address: '0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD',
    logo: 'https://imgproxy-mainnet.routescan.io/MS8AU1mCVjdR9AeyiIdTJG_0PvIrnAKwi695D8XAzR4/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvY2lyY2xlZXVyY29pbnNud18zMi5iOTFlMzMyNGZiNTMucG5n',
    pairAddress: null,
    enabled: true,
  },
];

const STORAGE_KEY = 'multisig-tokens';

export const useMultisigTokens = () => {
  const [tokens, setTokens] = useState<MultisigToken[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_TOKENS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    // Trigger custom event for other components to update
    window.dispatchEvent(new CustomEvent('tokens-updated'));
  }, [tokens]);

  return { tokens, setTokens };
};

export const getEnabledTokens = (): MultisigToken[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const tokens: MultisigToken[] = stored ? JSON.parse(stored) : DEFAULT_TOKENS;
  return tokens.filter(token => token.enabled);
};

export const TokenManager = () => {
  const { tokens, setTokens } = useMultisigTokens();
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLogo, setNewLogo] = useState('');
  const [newPairAddress, setNewPairAddress] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSymbol, setEditSymbol] = useState('');
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editPairAddress, setEditPairAddress] = useState('');
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    symbol: string; 
    name: string; 
    address: string; 
    logo: string; 
    pairAddress: string;
    fdv: number;
    marketCap: number;
    liquidity: number;
    volume24h: number;
    priceUsd: number;
    priceChange24h: number;
    score: number;
  }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fuzzy search function for better matching
  const fuzzyMatch = (query: string, target: string): number => {
    if (!query || !target) return 0;
    
    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Exact match gets highest score
    if (targetLower === queryLower) return 100;
    
    // Starts with query gets high score
    if (targetLower.startsWith(queryLower)) return 90;
    
    // Contains query gets medium score
    if (targetLower.includes(queryLower)) return 70;
    
    // Character by character fuzzy matching
    let score = 0;
    let queryIndex = 0;
    
    for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
      if (targetLower[i] === queryLower[queryIndex]) {
        score += 50 / queryLower.length; // Distribute points across query length
        queryIndex++;
      }
    }
    
    // Bonus for consecutive matches
    let consecutive = 0;
    let maxConsecutive = 0;
    queryIndex = 0;
    
    for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
      if (targetLower[i] === queryLower[queryIndex]) {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
        queryIndex++;
      } else {
        consecutive = 0;
      }
    }
    
    score += (maxConsecutive / queryLower.length) * 20;
    
    return Math.min(score, 99); // Cap at 99 to keep exact matches highest
  };

  // Enhanced search function with fuzzy matching and liquidity data
  const searchTokens = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search both DexScreener and a fallback for better coverage
      const [dexResponse] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`)
      ]);
      
      const dexData = await dexResponse.json();
      
      if (dexData.pairs && dexData.pairs.length > 0) {
        // Filter for Avalanche pairs and add fuzzy matching scores
        const avalanchePairs = dexData.pairs
          .filter((pair: any) => pair.chainId === 'avalanche')
          .map((pair: any) => {
            const symbolScore = fuzzyMatch(query, pair.baseToken?.symbol || '');
            const nameScore = fuzzyMatch(query, pair.baseToken?.name || '');
            const maxScore = Math.max(symbolScore, nameScore);
            
            return {
              symbol: pair.baseToken?.symbol || '',
              name: pair.baseToken?.name || '',
              address: pair.baseToken?.address || '',
              logo: `https://dd.dexscreener.com/ds-data/tokens/avalanche/${pair.baseToken?.address}.png`,
              pairAddress: pair.pairAddress || '',
              fdv: pair.fdv || 0,
              marketCap: pair.marketCap || 0,
              liquidity: pair.liquidity?.usd || 0,
              volume24h: pair.volume?.h24 || 0,
              priceUsd: parseFloat(pair.priceUsd) || 0,
              priceChange24h: pair.priceChange?.h24 || 0,
              score: maxScore
            };
          })
          .filter((token: any) => token.score > 0) // Only show tokens with some match
          .sort((a: any, b: any) => {
            // Sort by score first, then by liquidity for ties
            if (b.score !== a.score) return b.score - a.score;
            return b.liquidity - a.liquidity;
          })
          .slice(0, 15); // Show top 15 results

        setSearchResults(avalanchePairs);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Token search error:', error);
      setSearchResults([]);
      toast.error('Token arama hatası');
    } finally {
      setIsSearching(false);
    }
  };

  // Add token from search results
  const addTokenFromSearch = (searchToken: typeof searchResults[0]) => {
    const newToken: MultisigToken = {
      id: Date.now().toString(),
      symbol: searchToken.symbol,
      name: searchToken.name,
      address: searchToken.address,
      logo: searchToken.logo,
      pairAddress: searchToken.pairAddress,
      enabled: true,
    };

    setTokens(prev => [...prev, newToken]);
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`${searchToken.symbol} token eklendi ve chart güncellenecek!`);
  };

  const handleAddToken = () => {
    if (!newSymbol.trim() || !newAddress.trim() || !newName.trim()) {
      toast.error('Lütfen sembol, isim ve adres girin');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(newAddress)) {
      toast.error('Geçersiz token adresi');
      return;
    }

    if (newPairAddress && !/^0x[a-fA-F0-9]{40}$/.test(newPairAddress)) {
      toast.error('Geçersiz pair adresi');
      return;
    }

    const newToken: MultisigToken = {
      id: Date.now().toString(),
      symbol: newSymbol.trim().toUpperCase(),
      name: newName.trim(),
      address: newAddress.trim(),
      logo: newLogo.trim() || 'https://via.placeholder.com/32',
      pairAddress: newPairAddress.trim() || null,
      enabled: true,
    };

    setTokens([...tokens, newToken]);
    setNewSymbol('');
    setNewName('');
    setNewAddress('');
    setNewLogo('');
    setNewPairAddress('');
    toast.success('Token eklendi');
  };

  const handleToggle = (id: string) => {
    setTokens(tokens.map(token => 
      token.id === id ? { ...token, enabled: !token.enabled } : token
    ));
  };

  const handleStartEdit = (token: MultisigToken) => {
    setEditingId(token.id);
    setEditSymbol(token.symbol);
    setEditName(token.name);
    setEditAddress(token.address);
    setEditLogo(token.logo);
    setEditPairAddress(token.pairAddress || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditSymbol('');
    setEditName('');
    setEditAddress('');
    setEditLogo('');
    setEditPairAddress('');
  };

  const handleUpdateToken = () => {
    if (!editSymbol.trim() || !editAddress.trim() || !editName.trim()) {
      toast.error('Lütfen sembol, isim ve adres girin');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(editAddress)) {
      toast.error('Geçersiz token adresi');
      return;
    }

    if (editPairAddress && !/^0x[a-fA-F0-9]{40}$/.test(editPairAddress)) {
      toast.error('Geçersiz pair adresi');
      return;
    }

    setTokens(tokens.map(token => 
      token.id === editingId ? {
        ...token,
        symbol: editSymbol.trim().toUpperCase(),
        name: editName.trim(),
        address: editAddress.trim(),
        logo: editLogo.trim() || token.logo,
        pairAddress: editPairAddress.trim() || null,
      } : token
    ));

    handleCancelEdit();
    toast.success('Token güncellendi');
  };

  const enabledCount = tokens.filter(t => t.enabled).length;

  return (
    <Card className="p-4 gradient-card border-corporate-blue/30">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-corporate-blue" />
          <h3 className="text-sm font-bold text-foreground">Multisig Token'ları</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {enabledCount}/{tokens.length}
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
          {/* Token Search */}
          <div className="p-3 border border-border rounded-lg bg-muted/20">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              🔍 Fuzzy Token Ara & Ekle
              <span className="text-xs bg-order-green/20 text-order-green px-2 py-0.5 rounded-full">Smart Search</span>
            </h4>
            <div className="space-y-2">
              <Input
                placeholder="1 harf bile yeter! (w → WETH, a → AVAX, u → USDC)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 1) { // 1 harf yeter!
                    searchTokens(e.target.value);
                  } else {
                    setSearchResults([]);
                  }
                }}
                className="text-sm border-order-green/30 focus:border-order-green"
              />
              {isSearching && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 border-2 border-order-green/30 border-t-order-green rounded-full animate-spin" />
                  Avalanche ağında akıllı arama yapılıyor...
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="max-h-96 overflow-y-auto space-y-1 border border-border rounded p-2 bg-background/50">
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 hover:bg-order-green/5 rounded cursor-pointer border border-transparent hover:border-order-green/30 transition-all group"
                      onClick={() => addTokenFromSearch(result)}
                    >
                      <div className="relative">
                        <img 
                          src={result.logo} 
                          alt={result.symbol} 
                          className="w-8 h-8 rounded-full border-2 border-order-green/20 group-hover:border-order-green/50 transition-all" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/32x32/3D8D5D/ffffff?text=' + result.symbol.charAt(0);
                          }}
                        />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-order-green rounded-full flex items-center justify-center">
                          <Plus className="w-2 h-2 text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-foreground">{result.symbol}</p>
                          <div className="flex items-center gap-1">
                            {result.score >= 90 && <span className="text-xs bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded">Tam Eşleşme</span>}
                            {result.score >= 70 && result.score < 90 && <span className="text-xs bg-blue-500/20 text-blue-600 px-1.5 py-0.5 rounded">Yakın</span>}
                            {result.score > 0 && result.score < 70 && <span className="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded">Benzer</span>}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">{result.name}</p>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Fiyat:</span>
                              <span className="font-medium text-foreground">
                                ${result.priceUsd.toFixed(result.priceUsd < 1 ? 6 : 2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">24h:</span>
                              <span className={`font-medium ${result.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {result.priceChange24h >= 0 ? '+' : ''}{result.priceChange24h.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Likidite:</span>
                              <span className="font-medium text-order-green">
                                ${result.liquidity >= 1000000 
                                  ? (result.liquidity / 1000000).toFixed(1) + 'M'
                                  : result.liquidity >= 1000 
                                    ? (result.liquidity / 1000).toFixed(1) + 'K'
                                    : result.liquidity.toFixed(0)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Volume:</span>
                              <span className="font-medium text-corporate-blue">
                                ${result.volume24h >= 1000000 
                                  ? (result.volume24h / 1000000).toFixed(1) + 'M'
                                  : result.volume24h >= 1000 
                                    ? (result.volume24h / 1000).toFixed(1) + 'K'
                                    : result.volume24h.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {(result.marketCap > 0 || result.fdv > 0) && (
                          <div className="mt-1 pt-1 border-t border-border/30">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {result.marketCap > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">MCap:</span>
                                  <span className="font-medium text-purple-400">
                                    ${result.marketCap >= 1000000 
                                      ? (result.marketCap / 1000000).toFixed(1) + 'M'
                                      : result.marketCap >= 1000 
                                        ? (result.marketCap / 1000).toFixed(1) + 'K'
                                        : result.marketCap.toFixed(0)}
                                  </span>
                                </div>
                              )}
                              {result.fdv > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">FDV:</span>
                                  <span className="font-medium text-orange-400">
                                    ${result.fdv >= 1000000 
                                      ? (result.fdv / 1000000).toFixed(1) + 'M'
                                      : result.fdv >= 1000 
                                        ? (result.fdv / 1000).toFixed(1) + 'K'
                                        : result.fdv.toFixed(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-order-green group-hover:scale-110 transition-transform">
                        <Plus className="w-5 h-5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery.length >= 1 && searchResults.length === 0 && !isSearching && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  🤔 "{searchQuery}" için Avalanche'da token bulunamadı
                  <br />
                  <span className="text-xs">Farklı bir anahtar kelime deneyin</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Token List */}
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="p-2 bg-muted/20 rounded-lg border border-border/30 hover:border-corporate-blue/40 transition-colors"
              >
                {editingId === token.id ? (
                  // Edit Mode
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Sembol"
                        value={editSymbol}
                        onChange={(e) => setEditSymbol(e.target.value)}
                        className="h-7 text-xs"
                      />
                      <Input
                        placeholder="İsim"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                    <Input
                      placeholder="Token Adresi"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="h-7 font-mono text-xs"
                    />
                    <Input
                      placeholder="Logo URL"
                      value={editLogo}
                      onChange={(e) => setEditLogo(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <Input
                      placeholder="Pair Adresi (opsiyonel)"
                      value={editPairAddress}
                      onChange={(e) => setEditPairAddress(e.target.value)}
                      className="h-7 font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdateToken}
                        className="flex-1 h-7 text-xs"
                        size="sm"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Kaydet
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        size="sm"
                      >
                        <X className="w-3 h-3 mr-1" />
                        İptal
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={token.enabled}
                      onCheckedChange={() => handleToggle(token.id)}
                    />
                    <img src={token.logo} alt={token.symbol} className="w-5 h-5 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-xs">{token.symbol} - {token.name}</p>
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {token.address.slice(0, 10)}...{token.address.slice(-8)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(token.address);
                            toast.success('Token adresi kopyalandı');
                          }}
                          className="h-6 w-6 p-0 hover:bg-muted"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      {token.pairAddress && (
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-muted-foreground/70 font-mono truncate">
                            Pair: {token.pairAddress.slice(0, 8)}...{token.pairAddress.slice(-6)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(token.pairAddress!);
                              toast.success('Pair adresi kopyalandı');
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
                      onClick={() => handleStartEdit(token)}
                      className="h-7 w-7 p-0 hover:bg-muted"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add New Token Form */}
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center gap-1 mb-2">
              <Plus className="w-3 h-3 text-corporate-blue" />
              <span className="text-xs font-semibold text-foreground">Yeni Token</span>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Sembol (Örn: USDT)"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="İsim (Örn: Tether USD)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Input
                placeholder="Token Adresi (0x...)"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="h-8 font-mono text-xs"
              />
              <Input
                placeholder="Logo URL (opsiyonel)"
                value={newLogo}
                onChange={(e) => setNewLogo(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Pair Adresi (opsiyonel, DexScreener için)"
                value={newPairAddress}
                onChange={(e) => setNewPairAddress(e.target.value)}
                className="h-8 font-mono text-xs"
              />
              <Button
                onClick={handleAddToken}
                className="w-full h-7 text-xs"
                size="sm"
              >
                <Plus className="w-3 h-3 mr-1" />
                Ekle
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
