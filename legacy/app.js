const tokens = [
  { symbol: 'ETH', label: 'Ethereum', address: 'ETH', decimals: 18, isNative: true },
  { symbol: 'USDC', label: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, isNative: false },
  { symbol: 'DAI', label: 'Dai Stablecoin', address: '0x6B175474E89094C4Da98b954EedeAC495271d0F0', decimals: 18, isNative: false },
  { symbol: 'WBTC', label: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, isNative: false },
];

const fromToken = document.getElementById('fromToken');
const toToken = document.getElementById('toToken');
const amountInput = document.getElementById('amount');
const quoteValue = document.getElementById('quoteValue');
const quoteMeta = document.getElementById('quoteMeta');
const quoteDetails = document.getElementById('quoteDetails');
const status = document.getElementById('status');
const walletStatus = document.getElementById('walletStatus');
const swapForm = document.getElementById('swapForm');
const connectWalletButton = document.getElementById('connectWallet');
const executeSwapButton = document.getElementById('executeSwap');

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

let provider = null;
let signer = null;
let connectedAddress = null;
let currentQuote = null;

function populateTokens() {
  tokens.forEach((token) => {
    const optionFrom = document.createElement('option');
    optionFrom.value = token.symbol;
    optionFrom.textContent = `${token.symbol} · ${token.label}`;
    const optionTo = optionFrom.cloneNode(true);
    fromToken.appendChild(optionFrom);
    toToken.appendChild(optionTo);
  });

  fromToken.value = 'USDC';
  toToken.value = 'ETH';
}

function getToken(symbol) {
  return tokens.find((token) => token.symbol === symbol);
}

function setQuotePlaceholder() {
  quoteValue.textContent = '0.00';
  quoteMeta.textContent = 'Connect wallet and fetch a live quote.';
  quoteDetails.textContent = 'No quote yet.';
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function ensureMainnet() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
    });
  } catch (error) {
    if (error.code !== 4001) {
      status.textContent = 'Mainnet switch was skipped; the demo can still quote if your wallet is already on Ethereum.';
    }
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    status.textContent = 'Install MetaMask or another wallet to continue.';
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    signer = await provider.getSigner();
    connectedAddress = accounts[0];
    walletStatus.textContent = `Connected: ${shortenAddress(connectedAddress)}`;
    connectWalletButton.textContent = 'Wallet connected';
    status.textContent = 'Connected. You can fetch a live quote now.';
    await ensureMainnet();
  } catch (error) {
    status.textContent = `Connection failed: ${error.message}`;
  }
}

async function fetchQuote() {
  const amount = Number(amountInput.value || 0);
  const from = getToken(fromToken.value);
  const to = getToken(toToken.value);

  if (!from || !to || amount <= 0) {
    setQuotePlaceholder();
    status.textContent = 'Enter a valid amount to get a quote.';
    return;
  }

  status.textContent = 'Fetching a live quote from 0x...';

  try {
    const sellAmount = ethers.parseUnits(amount.toString(), from.decimals).toString();
    const sellToken = from.isNative ? 'ETH' : from.address;
    const buyToken = to.isNative ? 'ETH' : to.address;
    const url = `https://api.0x.org/swap/v1/quote?chainId=1&sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}&slippagePercentage=0.005`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Quote API error: ${response.status}`);
    }

    const quote = await response.json();
    const output = ethers.formatUnits(quote.buyAmount, to.decimals);

    quoteValue.textContent = `${Number(output).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to.symbol}`;
    quoteMeta.textContent = `Estimated gas: ${quote.estimatedGas || 'n/a'}`;
    quoteDetails.textContent = `Price impact: ${quote.estimatedPriceImpact ? `${Number(quote.estimatedPriceImpact).toFixed(2)}%` : 'n/a'} · Protocol routes: ${quote.protocols ? quote.protocols.length : 0}`;
    currentQuote = quote;
    status.textContent = `Live quote ready for ${from.symbol} → ${to.symbol}.`;
  } catch (error) {
    status.textContent = `Quote failed: ${error.message}`;
    setQuotePlaceholder();
  }
}

async function executeSwap() {
  if (!signer) {
    status.textContent = 'Connect your wallet first.';
    return;
  }

  if (!currentQuote) {
    status.textContent = 'Get a live quote before swapping.';
    return;
  }

  const from = getToken(fromToken.value);

  try {
    status.textContent = 'Preparing the swap transaction...';

    if (!from.isNative) {
      const tokenContract = new ethers.Contract(from.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(connectedAddress, currentQuote.allowanceTarget);
      if (allowance < BigInt(currentQuote.sellAmount)) {
        status.textContent = 'Approving token allowance...';
        const approvalTx = await tokenContract.approve(currentQuote.allowanceTarget, ethers.MaxUint256);
        await approvalTx.wait();
      }
    }

    const tx = await signer.sendTransaction({
      to: currentQuote.to,
      data: currentQuote.data,
      value: currentQuote.value ? BigInt(currentQuote.value) : 0n,
    });

    status.textContent = `Swap submitted. Hash: ${tx.hash}`;
    await tx.wait();
    status.textContent = `Swap confirmed. View it on Etherscan.`;
  } catch (error) {
    status.textContent = `Swap failed: ${error.message}`;
  }
}

populateTokens();
setQuotePlaceholder();

[fromToken, toToken, amountInput].forEach((element) => {
  element.addEventListener('input', () => {
    currentQuote = null;
    setQuotePlaceholder();
  });
  element.addEventListener('change', () => {
    currentQuote = null;
    setQuotePlaceholder();
  });
});

swapForm.addEventListener('submit', (event) => {
  event.preventDefault();
  fetchQuote();
});

connectWalletButton.addEventListener('click', connectWallet);
executeSwapButton.addEventListener('click', executeSwap);
