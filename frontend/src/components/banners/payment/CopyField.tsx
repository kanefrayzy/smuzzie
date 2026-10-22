'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** A value the buyer has to copy exactly (amount, address, memo) with a copy button. */
export default function CopyField({
  label, value, suffix, large = false, highlight = false,
}: {
  label: string;
  value: string;
  /** Shown after the value but not copied (e.g. the coin ticker) */
  suffix?: string;
  large?: boolean;
  highlight?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(value);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div>
      <span className="block text-xs text-gray-400 mb-1.5">{label}</span>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-white/[0.03] pl-3 pr-1.5 py-1.5 ${
          highlight ? 'border-amber-400/40' : 'border-white/[0.08]'
        }`}
      >
        <span className={`flex-1 min-w-0 font-mono text-white break-all select-all ${large ? 'text-lg sm:text-xl font-semibold' : 'text-sm'}`}>
          {value}
          {suffix && <span className="text-gray-400 font-normal"> {suffix}</span>}
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 h-9 px-3 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {state === 'copied' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span aria-hidden="true">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Select it' : 'Copy'}</span>
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'copied' ? `${label} copied` : state === 'failed' ? 'Copy failed, select the text instead' : ''}
      </span>
    </div>
  );
}
