const UNISWAP = 'https://raw.githubusercontent.com/uniswap/assets/master/blockchains';
const TRUST = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const NATIVE_ETH = `${TRUST}/ethereum/info/logo.png`;
const CGCB = 'https://coin-images.coingecko.com/coins/images';

const SOURCES = {
  8453: {
    ETH: NATIVE_ETH,
    WETH: `${UNISWAP}/base/assets/0x4200000000000000000000000000000000000006/logo.png`,
    USDC: `${UNISWAP}/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png`,
    USDT: `${TRUST}/base/assets/0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2/logo.png`,
    DAI: `${TRUST}/base/assets/0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb/logo.png`,
    cbBTC: `${CGCB}/40143/thumb/cbbtc.webp?1726136727`,
    AERO: `${TRUST}/base/assets/0x940181a94A35A4569E4529A3CDfB74e38FD98631/logo.png`,
    BRETT: `${TRUST}/base/assets/0x532f27101965dd16442E59d40670FaF5eBB142E4/logo.png`,
    DEGEN: `${TRUST}/base/assets/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed/logo.png`,
  },
  42161: {
    ETH: NATIVE_ETH,
    WETH: `${UNISWAP}/arbitrum/assets/0x82aF49447D8a07e3bd95BD0d56f35241523fBab1/logo.png`,
    USDC: `${UNISWAP}/arbitrum/assets/0xaf88d065e77c8cC2239327C5EDb3A432268e5831/logo.png`,
    USDT: `${UNISWAP}/arbitrum/assets/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9/logo.png`,
    DAI: `${UNISWAP}/arbitrum/assets/0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1/logo.png`,
    WBTC: `${UNISWAP}/arbitrum/assets/0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f/logo.png`,
    ARB: `${UNISWAP}/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png`,
    UNI: `${UNISWAP}/arbitrum/assets/0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0/logo.png`,
    PEPE: `${CGCB}/29850/thumb/pepe-token.jpeg?1696528776`,
    GMX: `${UNISWAP}/arbitrum/assets/0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a/logo.png`,
    MAGIC: `${TRUST}/arbitrum/assets/0x539bdE0d7Dbd336b79148AA742883198BBF60342/logo.png`,
    PENDLE: `${TRUST}/arbitrum/assets/0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8/logo.png`,
    USDe: `${CGCB}/33613/thumb/usde.png?1733810059`,
  },
};

export function tokenLogoUrl(token, chainId) {
  return SOURCES[chainId]?.[token.symbol] || null;
}
