import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getEnabledWallets } from './WalletManager';
import { getProvider } from '@/utils/blockchain';
import { getRecentLogsChunked } from '@/utils/ethLogs';
import { ethers } from 'ethers';
interface Transaction {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
}

interface WalletActivity {
  address: string;
  label: string;
  transaction: Transaction | null;
  loading: boolean;
}

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const toTopicAddress = (addr: string) => '0x' + '0'.repeat(24) + addr.toLowerCase().replace(/^0x/, '');

export const MultisigLastActivity = () => {
  const [activities, setActivities] = useState<WalletActivity[]>([]);

  useEffect(() => {
    const fetchActivities = async () => {
      const wallets = getEnabledWallets();
      
      // Initialize with loading state
      setActivities(
        wallets.map(wallet => ({
          address: wallet.address,
          label: wallet.label,
          transaction: null,
          loading: true,
        }))
      );

      // Fetch transactions for each wallet
      const results = await Promise.all(
        wallets.map(async (wallet) => {
          try {
            // Try Routescan API first
            let response = await fetch(
              `https://api.routescan.io/v2/network/mainnet/evm/43114/transactions?fromAddresses=${wallet.address}&toAddresses=${wallet.address}&sort=desc&limit=1&count=true`
            );
            
            let data: any;
            // If Routescan fails or rate limited, fallback to Avalanche Public RPC
            if (!response.ok) {
              console.log(`Routescan failed for ${wallet.label}, trying Avalanche RPC...`);

              const provider = getProvider();
              const latest = await provider.getBlockNumber();
              const addrTopic = toTopicAddress(wallet.address);

              // Fetch latest logs in safe chunks (≤2048 blocks per request)
              const [logsFrom, logsTo] = await Promise.all([
                getRecentLogsChunked(provider, { topics: [TRANSFER_TOPIC, addrTopic] }, { toBlock: latest, chunkSize: 2000, limit: 1, maxChunks: 60 }),
                getRecentLogsChunked(provider, { topics: [TRANSFER_TOPIC, null, addrTopic] }, { toBlock: latest, chunkSize: 2000, limit: 1, maxChunks: 60 }),
              ]);

              const logs = [...logsFrom, ...logsTo];

              if (logs.length > 0) {
                // Pick the newest log by blockNumber and logIndex
                const latestLog = logs
                  .sort((a: any, b: any) =>
                    a.blockNumber === b.blockNumber
                      ? (a.logIndex ?? 0) - (b.logIndex ?? 0)
                      : a.blockNumber - b.blockNumber
                  )
                  .at(-1);

                const [tx, block] = await Promise.all([
                  provider.getTransaction(latestLog.transactionHash),
                  provider.getBlock(latestLog.blockNumber),
                ]);

                data = {
                  items: [
                    {
                      hash: latestLog.transactionHash,
                      timestamp: new Date((block?.timestamp ?? 0) * 1000).toISOString(),
                      from: tx?.from ?? '0x',
                      to: tx?.to ?? '0x',
                      methodId: tx?.data ? tx.data.substring(0, 10) : '',
                      value: latestLog.data ?? '0x0',
                      input: tx?.data || '0x',
                    },
                  ],
                };
              } else {
                data = { items: [] };
              }
            } else {
              data = await response.json();
            }

            const items = data.items || data.result?.items || data.data?.items || data.transactions || [];
            const item = items[0];

            let txn: Transaction | null = null;
            if (item) {
              const hash = item.hash || item.transactionHash || item.txHash || item.id || '';
              const tsRaw = item.timestamp || item.blockTimestamp || item.timeStamp || item.blockTime || item.time || 0;

              let tsStr: string;
              if (typeof tsRaw === 'number') {
                tsStr = new Date((tsRaw > 1e12 ? tsRaw : tsRaw * 1000)).toISOString();
              } else if (typeof tsRaw === 'string' && /^\d+$/.test(tsRaw)) {
                const n = parseInt(tsRaw, 10);
                tsStr = new Date((n > 1e12 ? n : n * 1000)).toISOString();
              } else {
                tsStr = tsRaw || new Date().toISOString();
              }

              txn = hash
                ? {
                    hash,
                    timestamp: tsStr,
                    from: item.from || item.fromAddress || item.sender || '',
                    to: item.to || item.toAddress || item.recipient || '',
                  }
                : null;
            }

            return {
              address: wallet.address,
              label: wallet.label,
              transaction: txn,
              loading: false,
            };
          } catch (error) {
            console.error(`Error fetching activity for ${wallet.label}:`, error);
            return {
              address: wallet.address,
              label: wallet.label,
              transaction: null,
              loading: false,
            };
          }
        })
      );

      // Sort wallets by most recent transaction first
      results.sort((a, b) => {
        const ta = a.transaction ? Date.parse(a.transaction.timestamp) : 0;
        const tb = b.transaction ? Date.parse(b.transaction.timestamp) : 0;
        return tb - ta;
      });

      setActivities(results);
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 45000); // Refresh every 45 seconds

    // Listen for wallet updates
    const handleWalletUpdate = () => {
      fetchActivities();
    };

    window.addEventListener('wallets-updated', handleWalletUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('wallets-updated', handleWalletUpdate);
    };
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffSecs < 30) return 'Şimdi';
    if (diffMins < 1) return `${diffSecs}sn önce`;
    if (diffMins < 60) return `${diffMins}dk önce`;
    if (diffHours < 24) return `${diffHours}sa önce`;
    return `${diffDays}g önce`;
  };

  const getCardColorClass = (idx: number) => {
    const colors = [
      'bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 hover:border-blue-500/50',
      'bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/50',
      'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-500/50',
      'bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30 hover:border-orange-500/50',
      'bg-gradient-to-br from-indigo-500/10 to-blue-600/10 border-indigo-500/30 hover:border-indigo-500/50',
    ];
    
    return colors[idx % colors.length];
  };

  const openTransaction = (hash: string) => {
    window.open(`https://43114.routescan.io/tx/${hash}`, '_blank');
  };

  if (activities.length === 0) return null;

  return (
    <Card className="shadow-lg border-border/50 bg-card/30 backdrop-blur-sm">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" />
          Son Aktivite
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {activities.map((activity, idx) => (
            <div
              key={activity.address}
              onClick={() => activity.transaction && openTransaction(activity.transaction.hash)}
              className={`
                flex-shrink-0 w-[130px] p-2 rounded-md border transition-all
                ${activity.transaction ? `${getCardColorClass(idx)} cursor-pointer` : 'bg-muted/20 border-border/40'}
              `}
            >
              <p className="text-xs font-medium text-foreground truncate mb-0.5">
                {activity.label}
              </p>
              {activity.loading ? (
                <p className="text-[10px] text-muted-foreground">Yükleniyor...</p>
              ) : activity.transaction ? (
                <>
                  <div className="flex items-center gap-1 mb-0.5">
                    {(() => {
                      const isOutgoing = activity.transaction.from.toLowerCase() === activity.address.toLowerCase();
                      
                      return (
                        <span className={`text-[10px] font-semibold ${isOutgoing ? 'text-red-500' : 'text-green-500'}`}>
                          {isOutgoing ? 'ÇIKTI' : 'GELDİ'}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                      {formatTime(activity.transaction.timestamp)}
                    </p>
                    <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">İşlem yok</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
