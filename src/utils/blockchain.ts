import { ethers } from 'ethers';

// Prefer a Vite env var (VITE_AVALANCHE_RPC) or a serverless proxy endpoint to avoid CORS and rate limits.
// In production, set VITE_AVALANCHE_RPC to a provider URL (QuickNode/Chainstack) in Netlify environment.
const AVALANCHE_RPC = import.meta.env.VITE_AVALANCHE_RPC || '/.netlify/functions/avalanche-rpc';
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

export const getProvider = () => {
  return new ethers.JsonRpcProvider(AVALANCHE_RPC);
};

export const getTokenBalance = async (tokenAddress: string, walletAddress: string): Promise<number> => {
  try {
    const provider = getProvider();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    // Fetch balance and decimals in parallel
    const [balance, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals()
    ]);
    
    return Number(ethers.formatUnits(balance, decimals));
  } catch (error) {
    console.error(`Error fetching balance for ${tokenAddress}:`, error);
    return 0;
  }
};

export const fetchDexScreenerPrice = async (pairAddress: string): Promise<{ price: number; change24h: number }> => {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/avalanche/${pairAddress}`);
    const data = await response.json();
    return {
      price: data.pair?.priceUsd ? parseFloat(data.pair.priceUsd) : 0,
      change24h: data.pair?.priceChange?.h24 || 0
    };
  } catch (error) {
    console.error(`Error fetching price for ${pairAddress}:`, error);
    return { price: 0, change24h: 0 };
  }
};

export const fetchDexScreenerPriceByToken = async (tokenAddress: string): Promise<{ price: number; change24h: number }> => {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    
    // Filter for Avalanche pairs and sort by liquidity
    const avalanchePairs = data.pairs?.filter((pair: any) => pair.chainId === 'avalanche') || [];
    
    if (avalanchePairs.length === 0) {
      return { price: 0, change24h: 0 };
    }
    
    // Sort by liquidity (USD) and take the highest
    const bestPair = avalanchePairs.sort((a: any, b: any) => {
      const aLiq = parseFloat(a.liquidity?.usd || '0');
      const bLiq = parseFloat(b.liquidity?.usd || '0');
      return bLiq - aLiq;
    })[0];
    
    return {
      price: bestPair?.priceUsd ? parseFloat(bestPair.priceUsd) : 0,
      change24h: bestPair?.priceChange?.h24 || 0
    };
  } catch (error) {
    console.error(`Error fetching price for token ${tokenAddress}:`, error);
    return { price: 0, change24h: 0 };
  }
};

export const fetchUSDTRYRate = async (): Promise<number> => {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    return data.rates?.TRY || 0;
  } catch (error) {
    console.error('Error fetching USD/TRY rate:', error);
    return 0;
  }
};

export const fetchHolderCount = async (tokenAddress: string): Promise<number> => {
  try {
    const response = await fetch(
      `https://api.routescan.io/v2/network/mainnet/evm/43114/erc20/${tokenAddress}/holders?count=true&limit=1`
    );
    const data = await response.json();
    return data.total || 0;
  } catch (error) {
    console.error(`Error fetching holder count for ${tokenAddress}:`, error);
    return 0;
  }
};
