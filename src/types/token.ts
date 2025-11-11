export interface TokenPrice {
  usd: number;
  try: number;
  avax: number;
  btc: number;
  arena: number;
  order: number;
}

export interface TokenData {
  symbol: string;
  name: string;
  address: string;
  logo: string;
  price: TokenPrice;
  balance: number;
  value: TokenPrice;
}

export interface MultisigData {
  address: string;
  tokens: TokenData[];
  totalValue: TokenPrice;
}

export interface CirculatingSupply {
  total: number;
  nonCirculating: {
    lpPool: number;
    burned: number;
    orderLend: number;
    team: number;
  };
  circulating: number;
  circulatingValue: TokenPrice;
}
