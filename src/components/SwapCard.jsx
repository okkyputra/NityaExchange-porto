import { useEffect, useMemo, useState } from 'react';
import { maxUint256, parseUnits } from 'viem';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import {
  getBalance,
  getPublicClient,
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from 'wagmi/actions';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { config, chains, EXPLORER_URLS, UNISWAP } from '../wagmi';
import { erc20Abi, swapRouterAbi } from '../abi';
import { CHAIN_TOKENS, DEFAULT_PAIR } from '../tokens';
import {
  applySlippage,
  deadlineFromNow,
  formatTokenAmount,
  getBestQuote,
  isNative,
} from '../lib/swap';
import TokenSelect from './TokenSelect';

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', bps: 10 },
  { label: '0.5%', bps: 50 },
  { label: '1%', bps: 100 },
];

function getErrorMessage(error) {
  const message = error?.shortMessage || error?.message || 'Transaction failed';
  return message.length > 160 ? `${message.slice(0, 160)}…` : message;
}

export default function SwapCard() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  const [chainId, setChainId] = useState(chains[0].id);
  const [fromSymbol, setFromSymbol] = useState(DEFAULT_PAIR[chains[0].id].from);
  const [toSymbol, setToSymbol] = useState(DEFAULT_PAIR[chains[0].id].to);
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50);

  const [balanceIn, setBalanceIn] = useState(null);
  const [balanceOut, setBalanceOut] = useState(null);
  const [allowance, setAllowance] = useState(null);

  const [route, setRoute] = useState(null);
  const [quoteOut, setQuoteOut] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [routeError, setRouteError] = useState(null);

  const [step, setStep] = useState('idle');
  const [approvalHash, setApprovalHash] = useState(null);
  const [swapHash, setSwapHash] = useState(null);
  const [txError, setTxError] = useState(null);

  useEffect(() => {
    if (walletChainId) setChainId(walletChainId);
  }, [walletChainId]);

  useEffect(() => {
    const def = DEFAULT_PAIR[chainId] ?? DEFAULT_PAIR[chains[0].id];
    setFromSymbol(def.from);
    setToSymbol(def.to);
    setAmount('');
    setRoute(null);
    setQuoteOut(null);
    setStep('idle');
  }, [chainId]);

  const fromToken = useMemo(
    () => (CHAIN_TOKENS[chainId] ?? []).find((t) => t.symbol === fromSymbol),
    [chainId, fromSymbol],
  );
  const toToken = useMemo(
    () => (CHAIN_TOKENS[chainId] ?? []).find((t) => t.symbol === toSymbol),
    [chainId, toSymbol],
  );

  const amountIn = useMemo(() => {
    if (!fromToken || !amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return null;
    }
    try {
      return parseUnits(amount, fromToken.decimals);
    } catch {
      return null;
    }
  }, [fromToken, amount]);

  const handleChainChange = (id) => {
    setChainId(id);
    if (isConnected) switchChain({ chainId: id });
  };

  const handleFromChange = (symbol) => {
    if (symbol === toSymbol) setToSymbol(fromSymbol);
    setFromSymbol(symbol);
  };

  const handleToChange = (symbol) => {
    if (symbol === fromSymbol) setFromSymbol(toSymbol);
    setToSymbol(symbol);
  };

  const flip = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!address || !fromToken || !toToken) {
        setBalanceIn(null);
        setBalanceOut(null);
        return;
      }
      try {
        const fromBalance = isNative(fromToken)
          ? (await getBalance(config, { address, chainId })).value
          : await readContract(config, {
              chainId,
              address: fromToken.address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address],
            });
        if (!cancelled) setBalanceIn(fromBalance);
      } catch {
        /* ignore */
      }
      try {
        const toBalance = isNative(toToken)
          ? (await getBalance(config, { address, chainId })).value
          : await readContract(config, {
              chainId,
              address: toToken.address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address],
            });
        if (!cancelled) setBalanceOut(toBalance);
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [address, chainId, fromToken, toToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!address || !fromToken || isNative(fromToken)) {
        setAllowance(null);
        return;
      }
      try {
        const value = await readContract(config, {
          chainId,
          address: fromToken.address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, UNISWAP[chainId].swapRouter],
        });
        if (!cancelled) setAllowance(value);
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [address, chainId, fromToken]);

  useEffect(() => {
    let cancelled = false;
    setLoadingQuote(true);
    setRouteError(null);
    const timer = setTimeout(async () => {
      if (!fromToken || !toToken || !amountIn) {
        if (!cancelled) {
          setRoute(null);
          setQuoteOut(null);
          setLoadingQuote(false);
        }
        return;
      }
      try {
        const client = getPublicClient(config, { chainId });
        const result = await getBestQuote(client, chainId, fromToken, toToken, amountIn);
        if (cancelled) return;
        if (!result) {
          setRoute(null);
          setQuoteOut(null);
          setRouteError('No liquid route found for this pair');
          return;
        }
        setRoute({
          addresses: result.addresses,
          fees: result.fees,
          hops: result.hops,
          feePath: result.feePath,
          inIsNative: result.inIsNative,
          outIsNative: result.outIsNative,
        });
        setQuoteOut(result.output);
      } catch {
        if (!cancelled) {
          setRoute(null);
          setQuoteOut(null);
          setRouteError('Could not fetch a quote right now');
        }
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chainId, fromToken, toToken, amountIn]);

  const needsApproval = Boolean(
    address && fromToken && !isNative(fromToken) && allowance != null && amountIn && allowance < amountIn,
  );
  const insufficientBalance = Boolean(
    address && fromToken && amountIn && balanceIn != null && amountIn > balanceIn,
  );

  const outputText = quoteOut && toToken ? formatTokenAmount(quoteOut, toToken.decimals) : null;
  const minOutText =
    route && quoteOut && toToken
      ? formatTokenAmount(applySlippage(quoteOut, slippageBps), toToken.decimals)
      : null;

  const routeInfo = route
    ? `${route.hops === 1 ? 'Direct pool' : 'Via WETH'} · ${route.fees.map((f) => `${f / 10000}%`).join(' → ')}`
    : '—';

  const handleSwap = async () => {
    if (!address || !route || !quoteOut || !fromToken) return;
    const router = UNISWAP[chainId].swapRouter;
    const amountOutMin = applySlippage(quoteOut, slippageBps);
    try {
      if (needsApproval) {
        setStep('approving');
        const hash = await writeContract(config, {
          chainId,
          address: fromToken.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [router, maxUint256],
        });
        setApprovalHash(hash);
        await waitForTransactionReceipt(config, { hash });
      }

      setStep('swapping');
      const base = { chainId, address: router, abi: swapRouterAbi };
      let hash;
      if (route.inIsNative) {
        hash = await writeContract(config, {
          ...base,
          functionName: 'swapExactETHForTokens',
          args: [amountOutMin, route.addresses, address, deadlineFromNow()],
          value: amountIn,
        });
      } else if (route.outIsNative) {
        hash = await writeContract(config, {
          ...base,
          functionName: 'swapExactTokensForETH',
          args: [amountIn, amountOutMin, route.addresses, address, deadlineFromNow()],
        });
      } else {
        hash = await writeContract(config, {
          ...base,
          functionName: 'exactInput',
          args: [
            {
              path: route.feePath,
              recipient: address,
              deadline: deadlineFromNow(),
              amountIn,
              amountOutMinimum: amountOutMin,
            },
          ],
        });
      }
      setSwapHash(hash);
      await waitForTransactionReceipt(config, { hash });
      setStep('success');
    } catch (error) {
      setStep('error');
      setTxError(getErrorMessage(error));
    }
  };

  const explorer = EXPLORER_URLS[chainId];
  const chainName = UNISWAP[chainId].name;

  let buttonLabel = 'Swap';
  let buttonDisabled = false;
  let buttonAction = handleSwap;

  if (!isConnected) {
    buttonLabel = 'Connect wallet';
    buttonAction = () => openConnectModal?.();
  } else if (loadingQuote) {
    buttonLabel = 'Fetching quote…';
    buttonDisabled = true;
  } else if (routeError) {
    buttonLabel = 'No route available';
    buttonDisabled = true;
  } else if (!amountIn) {
    buttonLabel = 'Enter an amount';
    buttonDisabled = true;
  } else if (insufficientBalance) {
    buttonLabel = `Insufficient ${fromToken?.symbol} balance`;
    buttonDisabled = true;
  } else if (!isNative(fromToken) && allowance == null) {
    buttonLabel = 'Checking allowance…';
    buttonDisabled = true;
  } else if (step === 'approving') {
    buttonLabel = 'Approving…';
    buttonDisabled = true;
  } else if (step === 'swapping') {
    buttonLabel = 'Swapping…';
    buttonDisabled = true;
  } else if (needsApproval) {
    buttonLabel = `Approve ${fromToken.symbol} & swap`;
  }

  return (
    <div className="swap-card">
      <div className="swap-network-row">
        <span>Network</span>
        <select
          className="chain-select"
          value={chainId}
          onChange={(event) => handleChainChange(Number(event.target.value))}
          aria-label="Select network"
        >
          {chains.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
      </div>

      <div className="token-field">
        <label>You pay</label>
        <div className="token-input-line">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0.0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <TokenSelect chainId={chainId} value={fromSymbol} onChange={handleFromChange} />
        </div>
        <div className="token-meta">
          {address && balanceIn != null && fromToken ? (
            <span>
              Balance: {formatTokenAmount(balanceIn, fromToken.decimals, 4)} {fromToken.symbol}
              <button
                type="button"
                className="max-btn"
                onClick={() => setAmount(formatTokenAmount(balanceIn, fromToken.decimals, 8))}
              >
                MAX
              </button>
            </span>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="flip-wrap">
        <button type="button" className="flip-btn" onClick={flip} aria-label="Swap direction">
          ⇅
        </button>
      </div>

      <div className="token-field">
        <label>You receive</label>
        <div className="token-input-line">
          <input type="text" readOnly placeholder="0.0" value={outputText ?? ''} />
          <TokenSelect chainId={chainId} value={toSymbol} onChange={handleToChange} />
        </div>
        <div className="token-meta">
          {address && balanceOut != null && toToken ? (
            <span>
              Balance: {formatTokenAmount(balanceOut, toToken.decimals, 4)} {toToken.symbol}
            </span>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="quote-box">
        <div className="quote-row">
          <span>Route</span>
          <span>{routeInfo}</span>
        </div>
        <div className="quote-row">
          <span>Expected output</span>
          <strong>
            {outputText ? `${outputText} ${toToken?.symbol}` : '—'}
          </strong>
        </div>
        <div className="quote-row">
          <span>Minimum received</span>
          <span>{minOutText ? `${minOutText} ${toToken?.symbol}` : '—'}</span>
        </div>
        <div className="quote-row">
          <span>Slippage</span>
          <span className="slippage-group">
            {SLIPPAGE_OPTIONS.map((option) => (
              <button
                key={option.bps}
                type="button"
                className={slippageBps === option.bps ? 'slippage-btn active' : 'slippage-btn'}
                onClick={() => setSlippageBps(option.bps)}
              >
                {option.label}
              </button>
            ))}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary full-width"
        onClick={buttonAction}
        disabled={buttonDisabled}
      >
        {buttonLabel}
      </button>

      <div className="status" role="status">
        {routeError && <span className="status-error">{routeError}</span>}
        {step === 'success' && swapHash && (
          <span>
            Swap complete.{' '}
            <a href={`${explorer}/tx/${swapHash}`} target="_blank" rel="noreferrer">
              View on {chainName} explorer
            </a>
          </span>
        )}
        {step === 'approving' && approvalHash && (
          <span>
            Approving…{' '}
            <a href={`${explorer}/tx/${approvalHash}`} target="_blank" rel="noreferrer">
              View transaction
            </a>
          </span>
        )}
        {step === 'swapping' && swapHash && (
          <span>
            Swapping…{' '}
            <a href={`${explorer}/tx/${swapHash}`} target="_blank" rel="noreferrer">
              View transaction
            </a>
          </span>
        )}
        {step === 'error' && <span className="status-error">{txError}</span>}
        {step === 'idle' && !routeError && (
          <span>Powered by Uniswap V3 routing on {chainName}.</span>
        )}
      </div>
    </div>
  );
}
