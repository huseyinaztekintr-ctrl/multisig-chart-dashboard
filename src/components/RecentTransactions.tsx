import { useEffect, useState, memo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight, Activity, Bell } from 'lucide-react';
import { getEnabledAddresses } from './AddressManager';
import { fetchDexScreenerPrice, getProvider } from '@/utils/blockchain';
import { getRecentLogsChunked } from '@/utils/ethLogs';
import { ethers } from 'ethers';

const ORDER_TOKEN = '0x1BEd077195307229FcCBC719C5f2ce6416A58180';
const ORDER_PAIR = '0x5147fff4794fd96c1b0e64dcca921ca0ee1cda8d';

// ERC20 Transfer event topic
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

interface Transfer {
  from: string;
  to: string;
  amount: string;
  blockNumber: number;
  timestamp: string;
  txHash: string;
  tokenDecimals: number;
}

const RecentTransactionsComponent = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonCirculatingAddresses, setNonCirculatingAddresses] = useState<Set<string>>(new Set());
  const [newTransferIds, setNewTransferIds] = useState<Set<string>>(new Set());
  const [orderPrice, setOrderPrice] = useState<number>(0);
  const previousTransfersRef = useRef<string[]>([]);

  useEffect(() => {
    const enabledAddresses = getEnabledAddresses();
    setNonCirculatingAddresses(new Set(enabledAddresses.map(addr => addr.toLowerCase())));
  }, []);

  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        // Try Routescan first
        let response = await fetch(
          `https://api.routescan.io/v2/network/mainnet/evm/43114/erc20-transfers?tokenAddress=${ORDER_TOKEN}&limit=10&count=true`
        );
        
        let data: any;
        let newTransfers: any[] = [];
        
        // If Routescan fails (rate limit, etc.), fallback to Avalanche Public RPC
        if (!response.ok) {
          console.log('Routescan failed, trying Avalanche RPC...');
          const provider = getProvider();
          const latest = await provider.getBlockNumber();
          const logs = await getRecentLogsChunked(
            provider,
            { address: ORDER_TOKEN, topics: [TRANSFER_TOPIC] },
            { toBlock: latest, chunkSize: 2000, limit: 10, maxChunks: 60 }
          );

          // Ensure we only take the latest 10 logs and sort them by block number descending
          const blocks = await Promise.all(logs.map((l: any) => provider.getBlock(l.blockNumber)));

          newTransfers = logs.map((log: any, idx: number) => {
            const from = '0x' + (log.topics?.[1]?.slice(26) || '').toLowerCase();
            const to = '0x' + (log.topics?.[2]?.slice(26) || '').toLowerCase();
            const block = blocks[idx];
            return {
              from,
              to,
              amount: log.data || '0x0',
              blockNumber: log.blockNumber,
              timestamp: new Date((block?.timestamp ?? 0) * 1000).toISOString(),
              txHash: log.transactionHash,
              tokenDecimals: 18,
            };
          });
          
          // Sort by block number descending (most recent first)
          newTransfers.sort((a, b) => b.blockNumber - a.blockNumber);
          newTransfers = newTransfers.slice(0, 5);
        } else {
          data = await response.json();
          newTransfers = (data.items || []).slice(0, 5);
        }
        
        // Detect new transfers
        if (!loading && previousTransfersRef.current.length > 0) {
          const previousIds = new Set(previousTransfersRef.current);
          const newIds = new Set<string>();
          
          newTransfers.forEach((transfer: Transfer, idx: number) => {
            const transferId = `${transfer.txHash}-${idx}`;
            if (!previousIds.has(transferId)) {
              newIds.add(transferId);
            }
          });
          
          if (newIds.size > 0) {
            setNewTransferIds(newIds);
            // Auto-remove highlight after 5 seconds
            setTimeout(() => {
              setNewTransferIds(new Set());
            }, 5000);
          }
        }
        
        // Store current transfer IDs for next comparison
        previousTransfersRef.current = newTransfers.map((t: Transfer, idx: number) => `${t.txHash}-${idx}`);
        setTransfers(newTransfers);
      } catch (error) {
        console.error('Error fetching transfers:', error);
      }
      setLoading(false);
    };

    const fetchOrderPrice = async () => {
      try {
        const { price } = await fetchDexScreenerPrice(ORDER_PAIR);
        setOrderPrice(price);
      } catch (error) {
        console.error('Error fetching ORDER price:', error);
      }
    };

    fetchTransfers();
    fetchOrderPrice();
    const interval = setInterval(() => {
      fetchTransfers();
      fetchOrderPrice();
    }, 45000); // Update every 45 seconds


    const handleAddressUpdate = () => {
      const enabledAddresses = getEnabledAddresses();
      setNonCirculatingAddresses(new Set(enabledAddresses.map(addr => addr.toLowerCase())));
    };
    window.addEventListener('addresses-updated', handleAddressUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('addresses-updated', handleAddressUpdate);
    };
  }, []);

  const getTransferType = (transfer: Transfer) => {
    const fromLower = transfer.from.toLowerCase();
    const toLower = transfer.to.toLowerCase();
    const fromNonCirculating = nonCirculatingAddresses.has(fromLower);
    const toNonCirculating = nonCirculatingAddresses.has(toLower);

    if (fromNonCirculating && toNonCirculating) {
      return { type: 'Dolaşım Dışı → Dolaşım Dışı', icon: Activity, color: 'text-blue-400' };
    } else if (fromNonCirculating) {
      return { type: 'Dolaşıma Eklendi', icon: ArrowUpRight, color: 'text-order-green' };
    } else if (toNonCirculating) {
      return { type: 'Dolaşımdan Çıktı', icon: ArrowDownLeft, color: 'text-red-400' };
    } else {
      return { type: 'Normal Transfer', icon: ArrowUpRight, color: 'text-muted-foreground' };
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string) => {
    try {
      // Support both decimal strings and hex (0x...) values
      const numAmount = amount?.startsWith('0x')
        ? Number(ethers.formatUnits(amount as any, 18))
        : parseFloat(amount) / 1e18;

      if (isNaN(numAmount)) return '0';
      return numAmount.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    } catch (e) {
      console.error('Error formatting amount:', amount, e);
      return '0';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp).getTime() / 1000;
      const now = Date.now() / 1000;
      const diff = now - date;
      
      if (isNaN(diff) || diff < 0) return 'Bilinmiyor';
      if (diff < 30) return 'Şimdi';
      if (diff < 60) return `${Math.floor(diff)}sn önce`;
      if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
      return `${Math.floor(diff / 86400)}g önce`;
    } catch (e) {
      return 'Bilinmiyor';
    }
  };

  const getCardColorClass = (idx: number, isNew: boolean) => {
    if (isNew) {
      return 'bg-gradient-to-r from-order-green/30 via-cyan-500/30 to-purple-500/30 border-order-green/70 shadow-lg shadow-order-green/50';
    }
    
    const colors = [
      'bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 hover:border-blue-500/50',
      'bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/50',
      'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-500/50',
      'bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30 hover:border-orange-500/50',
      'bg-gradient-to-br from-indigo-500/10 to-blue-600/10 border-indigo-500/30 hover:border-indigo-500/50',
    ];
    
    return colors[idx % colors.length];
  };

  return (
    <Card className="p-5 gradient-card border-primary/30 glow-order h-full flex flex-col min-h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-6 h-6 text-order-green animate-pulse-slow" />
        <h2 className="text-lg font-bold text-foreground">Son Transferler</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-auto">
          {transfers.map((transfer, idx) => {
            const transferInfo = getTransferType(transfer);
            const Icon = transferInfo.icon;
            const transferId = `${transfer.txHash}-${idx}`;
            const isNew = newTransferIds.has(transferId);
            
            return (
              <div
                key={transferId}
                className={`p-3 rounded-lg border transition-all duration-300 relative overflow-hidden ${
                  getCardColorClass(idx, isNew)
                } ${isNew ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
              >
                {isNew && (
                  <>
                    <div className="absolute top-2 right-2 animate-bounce">
                      <Bell className="w-4 h-4 text-order-green" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-order-green/20 via-transparent to-purple-500/20 animate-pulse pointer-events-none" />
                  </>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${transferInfo.color}`} />
                    <span className={`text-xs font-semibold ${transferInfo.color}`}>
                      {transferInfo.type}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(transfer.timestamp)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">From:</span>
                    <span className="text-foreground font-mono">
                      {formatAddress(transfer.from)}
                    </span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">To:</span>
                    <span className="text-foreground font-mono">
                      {formatAddress(transfer.to)}
                    </span>
                  </div>
                </div>
                
                <div className="mt-2 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-bold text-order-green">
                      {formatAmount(transfer.amount)} ORDER
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const num = transfer.amount?.startsWith('0x')
                          ? Number(ethers.formatUnits(transfer.amount as any, 18))
                          : parseFloat(transfer.amount) / 1e18;
                        return (num * orderPrice).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        });
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const RecentTransactions = memo(RecentTransactionsComponent);
