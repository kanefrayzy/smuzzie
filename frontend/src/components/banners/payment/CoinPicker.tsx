'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import type { PaymentMethod } from '@/types/banners';
import CryptoIcon from './CryptoIcon';

interface CoinGroup {
  coin: string;
  name: string;
  icon: string;
  methods: PaymentMethod[];
}

function groupByCoin(methods: PaymentMethod[]): CoinGroup[] {
  const groups: CoinGroup[] = [];
  for (const m of methods) {
    let g = groups.find((x) => x.coin === m.coin);
    if (!g) {
      g = { coin: m.coin, name: m.coin_name, icon: m.icon, methods: [] };
      groups.push(g);
    }
    g.methods.push(m);
  }
  return groups;
}

/**
 * Two steps: the coin, then (for coins on several networks, like USDT) the network.
 * Coins on one network go straight to the address. Order follows the backend config.
 */
export default function CoinPicker({
  methods, onPick, busyKey, initialCoin,
}: {
  methods: PaymentMethod[];
  onPick: (key: string) => void;
  /** Method being requested right now */
  busyKey: string | null;
  initialCoin?: string;
}) {
  const groups = useMemo(() => groupByCoin(methods), [methods]);
  const [coin, setCoin] = useState<string | null>(() =>
    initialCoin && groups.some((g) => g.coin === initialCoin && g.methods.length > 1) ? initialCoin : null
  );
  const selected = groups.find((g) => g.coin === coin) || null;
  const busy = busyKey !== null;

  const chooseCoin = (g: CoinGroup) => {
    if (g.methods.length === 1) {
      if (g.methods[0].available) onPick(g.methods[0].key);
      return;
    }
    setCoin(g.coin === coin ? null : g.coin);
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="font-mono text-[11px] tracking-[0.2em] uppercase text-gray-400 mb-3">1 · Choose a coin</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {groups.map((g) => {
            const usable = g.methods.some((m) => m.available);
            const single = g.methods.length === 1 ? g.methods[0] : null;
            const active = g.coin === coin;
            return (
              <button
                key={g.coin}
                type="button"
                onClick={() => chooseCoin(g)}
                disabled={!usable || busy}
                aria-pressed={single ? undefined : active}
                aria-expanded={single ? undefined : active}
                className={`relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 disabled:cursor-not-allowed ${
                  active
                    ? 'border-accent-red/60 bg-accent-red/10'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                } ${!usable ? 'opacity-40' : ''}`}
              >
                <CryptoIcon name={g.icon} label={g.coin} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white leading-tight">{g.coin}</span>
                  <span className="block text-[11px] text-gray-500 truncate">
                    {!usable
                      ? single?.unavailable_reason || 'Not available'
                      : g.methods.length > 1
                        ? `${g.methods.length} networks`
                        : g.name}
                  </span>
                </span>
                {single && busyKey === single.key && <Loader2 size={14} className="animate-spin text-gray-400" aria-label="Loading" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      {selected && selected.methods.length > 1 && (
        <fieldset>
          <legend className="font-mono text-[11px] tracking-[0.2em] uppercase text-gray-400 mb-3">
            2 · {selected.coin} network
          </legend>
          <p className="text-xs text-gray-500 -mt-1 mb-3">Pick the network your wallet or exchange will send from. It has to match exactly.</p>
          <div className="space-y-2">
            {selected.methods.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onPick(m.key)}
                disabled={!m.available || busy}
                className="w-full flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-accent-red/40 hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CryptoIcon name={m.network_icon || m.icon} kind={m.network_icon ? 'network' : 'coin'} label={m.network} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-white">{m.network_name}</span>
                  <span className="block text-[11px] text-gray-500">
                    {m.available ? (m.approx_amount ? `≈ ${m.approx_amount} ${m.coin}` : m.network) : m.unavailable_reason}
                  </span>
                </span>
                {busyKey === m.key ? (
                  <Loader2 size={16} className="animate-spin text-gray-400" aria-label="Loading" />
                ) : (
                  <ChevronRight size={16} className="text-gray-500" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
