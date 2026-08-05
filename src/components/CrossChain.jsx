import { useEffect, useMemo, useState } from 'react';
import { encodeFunctionData, maxUint256, parseUnits } from 'viem';
import { useAccount, useChainId, usePublicClient, useSwitchChain } from 'wagmi';
import { waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { config, chains, UNISWAP } from '../wagmi';
import { erc20Abi, swapRouterAbi, spokePoolAbi } from '../abi';
import { CHAIN_TOKENS } from '../tokens';
import { applySlippage, deadlineFromNow, formatTokenAmount, isNative } from '../lib/swap';
import { planCrossChain, freshBridgeQuote, findToken } from '../lib/crosschain';

function getErrorText(error) {
  return error?.shortMessage || error?.message || 'Transaction failed';
}

export default function CrossChain() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [fromChainId, setFromChainId] = useState(chains[0].id);
  const [toChainId, setToChainId] = useState(chains[1].id);
  const [fromSymbol, setFromSymbol] = useState('ETH');
  const [toSymbol, setToSymbol] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [execStep, setExecStep] = useState('idle');
  const [execError, setExecError] = useState(null);
  const [bridgeDone, setBridgeDone] = useState(false);
  const [bridgeLanded, setBridgeLanded] = useState(false);
  const [bridgeLandedAmount, setBridgeLandedAmount] = useState(null);
  const [hashes, setHashes] = useState([]);

  const publicClientFrom = usePublicClient({ chainId: fromChainId });
  const publicClientTo = usePublicClient({ chainId: toChainId });

  const fromToken = useMemo(() => findToken(fromChainId, fromSymbol), [fromChainId, fromSymbol]);
  const toToken = useMemo(() => findToken(toChainId, toSymbol), [toChainId, toSymbol]);
  const amountIn = useMemo(() => {
    if (!amount || !fromToken) return null;
    try {
      return parseUnits(amount, fromToken.decimals);
    } catch {
      return null;
    }
  }, [amount, fromToken]);

  useEffect(() => {
    if (!fromChainId || !toChainId) return;
    setFromSymbol(fromChainId === 8453 ? 'ETH' : 'ETH');
    setToSymbol(toChainId === 8453 ? 'USDC' : 'USDC');
    setRoute(null);
    setBridgeDone(false);
    setBridgeLanded(false);
    setBridgeLandedAmount(null);
    setHashes([]);
    setExecStep('idle');
    setExecError(null);
  }, [fromChainId, toChainId]);

  useEffect(() => {
    if (!bridgeDone || !route || !address || !publicClientTo) return;
    let baseline = 0n;
    let stopped = false;
    let timer;
    const check = async () => {
      try {
        const balance = await publicClientTo.readContract({
          address: route.bridgeAsset.to.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        });
        if (balance > baseline) {
          setBridgeLanded(true);
          setBridgeLandedAmount(balance - baseline);
          return;
        }
      } catch {
        /* ignore transient read errors */
      }
      if (!stopped) timer = setTimeout(check, 12000);
    };
    publicClientTo
      .readContract({
        address: route.bridgeAsset.to.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
      .then((b) => {
        baseline = b;
        if (!stopped) check();
      })
      .catch(() => {
        if (!stopped) check();
      });
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [bridgeDone, route, address, publicClientTo]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRoute(true);
    setRouteError(null);
    const timer = setTimeout(async () => {
      if (!amountIn || !fromToken || !toToken || !publicClientFrom || !publicClientTo) {
        if (!cancelled) {
          setRoute(null);
          setLoadingRoute(false);
        }
        return;
      }
      try {
        const result = await planCrossChain({
          publicClientFrom,
          publicClientTo,
          fromChainId,
          toChainId,
          fromToken,
          toToken,
          amountIn,
        });
        if (cancelled) return;
        if (result?.sameChain) {
          setRoute(null);
          setRouteError('Pick two different networks to bridge.');
          return;
        }
        if (result?.error) {
          setRoute(null);
          setRouteError(result.error);
          return;
        }
        setRoute(result);
      } catch {
        if (!cancelled) {
          setRoute(null);
          setRouteError('Could not fetch a cross-chain route right now');
        }
      } finally {
        if (!cancelled) setLoadingRoute(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amountIn, fromToken, toToken, fromChainId, toChainId, publicClientFrom, publicClientTo]);

  const executeOrigin = async () => {
    if (!address || !route) return;
    try {
      if (chainId !== fromChainId) await switchChain({ chainId: fromChainId });
      const router = UNISWAP[fromChainId].swapRouter;
      const fromAsset = route.bridgeAsset.from;

      if (route.legIn) {
        setExecStep('swapping');
        if (!isNative(fromToken)) {
          const approveHash = await writeContract(config, {
            chainId: fromChainId,
            address: fromToken.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [router, maxUint256],
          });
          await waitForTransactionReceipt(config, { hash: approveHash });
          setHashes((h) => [...h, approveHash]);
        }
        const swapData = [
          encodeFunctionData({
            abi: swapRouterAbi,
            functionName: 'exactInput',
            args: [
              {
                path: route.legIn.feePath,
                recipient: address,
                amountIn,
                amountOutMinimum: applySlippage(route.legIn.output, 100),
              },
            ],
          }),
        ];
        const swapHash = await writeContract(config, {
          chainId: fromChainId,
          address: router,
          abi: swapRouterAbi,
          functionName: 'multicall',
          args: [deadlineFromNow(), swapData],
          value: isNative(fromToken) ? amountIn : 0n,
        });
        await waitForTransactionReceipt(config, { hash: swapHash });
        setHashes((h) => [...h, swapHash]);
      }

      setExecStep('approving-bridge');
      const quote = await freshBridgeQuote(route);
      const approveBridgeHash = await writeContract(config, {
        chainId: fromChainId,
        address: fromAsset.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [quote.spokePoolAddress, quote.inputAmount],
      });
      await waitForTransactionReceipt(config, { hash: approveBridgeHash });
      setHashes((h) => [...h, approveBridgeHash]);

      setExecStep('depositing');
      const depositHash = await writeContract(config, {
        chainId: fromChainId,
        address: quote.spokePoolAddress,
        abi: spokePoolAbi,
        functionName: 'depositV3',
        args: [
          address,
          address,
          quote.inputToken.address,
          quote.outputToken.address,
          quote.inputAmount,
          quote.outputAmount,
          toChainId,
          quote.exclusiveRelayer,
          quote.quoteTimestamp,
          quote.fillDeadline,
          quote.exclusivityDeadline,
          '0x',
        ],
        value: 0n,
      });
      await waitForTransactionReceipt(config, { hash: depositHash });
      setHashes((h) => [...h, depositHash]);
      setBridgeDone(true);
      setExecStep('success');
    } catch (error) {
      setExecStep('error');
      setExecError(getErrorText(error));
    }
  };

  const executeDestination = async () => {
    if (!address || !route || !route.legOut) return;
    try {
      if (chainId !== toChainId) await switchChain({ chainId: toChainId });
      const router = UNISWAP[toChainId].swapRouter;
      const inToken = route.bridgeAsset.to;
      setExecStep('swapping');
      const approveHash = await writeContract(config, {
        chainId: toChainId,
        address: inToken.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [router, maxUint256],
      });
      await waitForTransactionReceipt(config, { hash: approveHash });
      const swapData = [
        encodeFunctionData({
          abi: swapRouterAbi,
          functionName: 'exactInput',
          args: [
            {
              path: route.legOut.feePath,
              recipient: address,
              amountIn: bridgeLandedAmount ?? route.bridgeOut,
              amountOutMinimum: applySlippage(route.legOut.output, 100),
            },
          ],
        }),
      ];
      const swapHash = await writeContract(config, {
        chainId: toChainId,
        address: router,
        abi: swapRouterAbi,
        functionName: 'multicall',
        args: [deadlineFromNow(), swapData],
        value: 0n,
      });
      await waitForTransactionReceipt(config, { hash: swapHash });
      setHashes((h) => [...h, swapHash]);
      setExecStep('done');
    } catch (error) {
      setExecStep('error');
      setExecError(getErrorText(error));
    }
  };

  const busy =
    execStep === 'swapping' || execStep === 'approving-bridge' || execStep === 'depositing';

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Cross-chain swap</h3>
          <span className="panel-sub">Route a swap over Across + Uniswap V3</span>
        </div>
      </div>

      <div className="xc-fields">
        <div className="xc-field">
          <label>From</label>
          <div className="xc-select-row">
            <select
              className="chain-select"
              value={fromChainId}
              onChange={(e) => setFromChainId(Number(e.target.value))}
            >
              {chains.map((c) => (
                <option key={c.id} value={c.id}>
                  {UNISWAP[c.id].name}
                </option>
              ))}
            </select>
            <select
              className="token-select"
              value={fromSymbol}
              onChange={(e) => setFromSymbol(e.target.value)}
            >
              {(CHAIN_TOKENS[fromChainId] || []).map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
          <input
            className="xc-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="xc-arrow">→</div>

        <div className="xc-field">
          <label>To</label>
          <div className="xc-select-row">
            <select
              className="chain-select"
              value={toChainId}
              onChange={(e) => setToChainId(Number(e.target.value))}
            >
              {chains.map((c) => (
                <option key={c.id} value={c.id}>
                  {UNISWAP[c.id].name}
                </option>
              ))}
            </select>
            <select
              className="token-select"
              value={toSymbol}
              onChange={(e) => setToSymbol(e.target.value)}
            >
              {(CHAIN_TOKENS[toChainId] || []).map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
          <input
            className="xc-amount"
            type="text"
            placeholder="0.0"
            readOnly
            value={route ? formatTokenAmount(route.finalOut, toToken.decimals) : ''}
          />
        </div>
      </div>

      {loadingRoute && <p className="panel-empty">Routing across chains…</p>}
      {routeError && <p className="status-error">{routeError}</p>}

      {route && !loadingRoute && !routeError && (
        <div className="xc-route">
          <div className="xc-route-title">
            <span>Route</span>
            <strong>
              {formatTokenAmount(route.amountIn, fromToken.decimals)} {fromToken.symbol} →{' '}
              {formatTokenAmount(route.finalOut, toToken.decimals)} {toToken.symbol}
            </strong>
          </div>

          {route.legIn && (
            <div className="xc-step">
              <span className="xc-step-n">1</span>
              <div>
                <strong>
                  Swap {fromToken.symbol} → {route.bridgeAsset.from.symbol}
                </strong>
                <span>
                  On {UNISWAP[fromChainId].name} ·{' '}
                  {route.legIn.hops === 1 ? 'direct pool' : 'via WETH'} · get{' '}
                  {formatTokenAmount(route.bridgeIn, route.bridgeAsset.from.decimals)}{' '}
                  {route.bridgeAsset.from.symbol}
                </span>
              </div>
            </div>
          )}

          <div className="xc-step">
            <span className="xc-step-n">{route.legIn ? 2 : 1}</span>
            <div>
              <strong>
                Bridge {route.bridgeAsset.from.symbol} → {route.bridgeAsset.to.symbol} via Across
              </strong>
              <span>
                {formatTokenAmount(route.bridgeIn, route.bridgeAsset.from.decimals)} →{' '}
                {formatTokenAmount(route.bridgeOut, route.bridgeAsset.to.decimals)}{' '}
                {route.bridgeAsset.to.symbol} · fee{' '}
                {formatTokenAmount(route.relayFeeTotal, route.bridgeAsset.from.decimals)}{' '}
                {route.bridgeAsset.from.symbol} ·~ {route.estimatedFillTimeSec}s
              </span>
            </div>
          </div>

          {route.legOut && (
            <div className="xc-step">
              <span className="xc-step-n">{route.legIn ? 3 : 2}</span>
              <div>
                <strong>
                  Swap {route.bridgeAsset.to.symbol} → {toToken.symbol}
                </strong>
                <span>
                  On {UNISWAP[toChainId].name} · get{' '}
                  {formatTokenAmount(route.finalOut, toToken.decimals)} {toToken.symbol}
                </span>
              </div>
            </div>
          )}

          {execStep === 'error' && <p className="status-error">{execError}</p>}
          {hashes.length > 0 && (
            <p className="panel-sub">Tx: {hashes.map((h) => `${h.slice(0, 8)}…`).join(', ')}</p>
          )}

          {!bridgeDone ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={executeOrigin}
              disabled={!address || busy}
            >
              {!address
                ? 'Connect wallet'
                : busy
                  ? {
                      swapping: 'Swapping…',
                      'approving-bridge': 'Approving bridge…',
                      depositing: 'Depositing…',
                    }[execStep]
                  : 'Start bridge'}
            </button>
          ) : route.legOut ? (
            <div className="xc-dest">
              <p className="panel-sub">
                Bridge in transit (~{route.estimatedFillTimeSec}s). Swap on{' '}
                {UNISWAP[toChainId].name} when it lands.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={executeDestination}
                disabled={!address || busy}
              >
                {execStep === 'done' ? 'Done' : `Swap on ${UNISWAP[toChainId].name}`}
              </button>
            </div>
          ) : (
            <p className="panel-sub">
              Bridge submitted — {toToken.symbol} is arriving on {UNISWAP[toChainId].name}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
