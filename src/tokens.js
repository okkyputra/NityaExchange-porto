export const CHAIN_TOKENS = {
  8453: [
    { symbol: 'ETH', name: 'Ether', address: null, decimals: 18 },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      decimals: 6,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      decimals: 18,
    },
    {
      symbol: 'cbBTC',
      name: 'Coinbase Wrapped BTC',
      address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      decimals: 8,
    },
    {
      symbol: 'AERO',
      name: 'Aerodrome',
      address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
      decimals: 18,
    },
    {
      symbol: 'BRETT',
      name: 'Brett',
      address: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
      decimals: 18,
    },
    {
      symbol: 'DEGEN',
      name: 'Degen',
      address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
      decimals: 18,
    },
  ],
  42161: [
    { symbol: 'ETH', name: 'Ether', address: null, decimals: 18 },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      decimals: 6,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      decimals: 6,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped BTC',
      address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      decimals: 8,
    },
    {
      symbol: 'ARB',
      name: 'Arbitrum',
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      decimals: 18,
    },
    {
      symbol: 'UNI',
      name: 'Uniswap',
      address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
      decimals: 18,
    },
    {
      symbol: 'PEPE',
      name: 'Pepe',
      address: '0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00',
      decimals: 18,
    },
    {
      symbol: 'GMX',
      name: 'GMX',
      address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
      decimals: 18,
    },
    {
      symbol: 'MAGIC',
      name: 'MAGIC',
      address: '0x539bdE0d7Dbd336b79148AA742883198BBF60342',
      decimals: 18,
    },
    {
      symbol: 'PENDLE',
      name: 'Pendle',
      address: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8',
      decimals: 18,
    },
    {
      symbol: 'USDe',
      name: 'USDe',
      address: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34',
      decimals: 18,
    },
  ],
};

export const DEFAULT_PAIR = {
  8453: { from: 'ETH', to: 'USDC' },
  42161: { from: 'ETH', to: 'USDC' },
};
