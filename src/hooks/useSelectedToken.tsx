import { useState, useEffect } from 'react';

export interface SelectedMultisigToken {
  id: string;
  symbol: string;
  name: string;
  address: string;
  logo: string;
  pairAddress: string | null;
  maxSupply: number;
  enabled: boolean;
}

const SELECTED_TOKEN_STORAGE_KEY = 'selected-multisig-token';

// Default ORDER token configuration
export const DEFAULT_SELECTED_TOKEN: SelectedMultisigToken = {
  id: '2',
  symbol: 'ORDER',
  name: 'ORDER Token',
  address: '0x1BEd077195307229FcCBC719C5f2ce6416A58180',
  logo: 'https://imgproxy-mainnet.routescan.io/wjTZbb293__lBlOaQHRI0yK40KScu1PN6oCjFYV2l14/pr:thumb_32/aHR0cHM6Ly9jbXMtY2RuLmF2YXNjYW4uY29tL2NtczIvcHlyYW1pZGxpcXVpZGl0eW9yZGVyLjA5NWFjNDdlNjc5YS53ZWJw',
  pairAddress: '0x5147fff4794fd96c1b0e64dcca921ca0ee1cda8d',
  maxSupply: 10000000000, // 10B ORDER tokens - CORRECT TOTAL SUPPLY
  enabled: true,
};

export const useSelectedToken = () => {
  const [selectedToken, setSelectedToken] = useState<SelectedMultisigToken>(() => {
    const saved = localStorage.getItem(SELECTED_TOKEN_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Fix ORDER max supply if it's incorrectly set to 100M
      if (parsed.symbol === 'ORDER' && parsed.maxSupply === 100000000) {
        console.log('🔄 Migrating ORDER max supply from 100M to 10B');
        parsed.maxSupply = 10000000000;
        localStorage.setItem(SELECTED_TOKEN_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
    return DEFAULT_SELECTED_TOKEN;
  });

  useEffect(() => {
    localStorage.setItem(SELECTED_TOKEN_STORAGE_KEY, JSON.stringify(selectedToken));
    // Trigger custom event for other components to update
    window.dispatchEvent(new CustomEvent('selected-token-changed', { 
      detail: selectedToken 
    }));
  }, [selectedToken]);

  return { selectedToken, setSelectedToken };
};

// Helper function to get current selected token from localStorage
export const getCurrentSelectedToken = (): SelectedMultisigToken => {
  const saved = localStorage.getItem(SELECTED_TOKEN_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    // Migration: Fix ORDER max supply if it's incorrectly set to 100M
    if (parsed.symbol === 'ORDER' && parsed.maxSupply === 100000000) {
      console.log('🔄 Migrating ORDER max supply from 100M to 10B in getCurrentSelectedToken');
      parsed.maxSupply = 10000000000;
      localStorage.setItem(SELECTED_TOKEN_STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  }
  return DEFAULT_SELECTED_TOKEN;
};