// Building blocks for Privacy / Terms section bodies (server-renderable, no client JS).

import React from 'react';
import Link from 'next/link';

const LINK_CLASS =
  'text-gray-200 underline decoration-accent-red/40 underline-offset-2 hover:text-white hover:decoration-accent-red transition-colors';

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.6em] h-px w-3 shrink-0 bg-accent-red/50" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Table on wide screens; on phones each row stacks into labelled lines (no sideways scrolling). */
export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-left text-[13px] border-collapse block sm:table">
      <thead className="sr-only sm:not-sr-only sm:table-header-group">
        <tr className="border-b border-accent-red/20">
          {head.map((h) => (
            <th key={h} scope="col" className="py-2 pr-4 font-mono text-[10px] tracking-[0.15em] uppercase text-accent-red/70 font-normal align-bottom">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block sm:table-row-group">
        {rows.map((row, i) => (
          <tr key={i} className="block sm:table-row border-b border-white/[0.05] align-top py-3 sm:py-0">
            {row.map((cell, j) => (
              <td key={j} className={`block sm:table-cell sm:py-2.5 sm:pr-4 ${j === 0 ? 'text-gray-200 mb-1 sm:mb-0' : 'mt-1 sm:mt-0'}`}>
                {j > 0 && (
                  <span className="sm:hidden block font-mono text-[9px] tracking-[0.15em] uppercase text-accent-red/60">
                    {head[j]}
                  </span>
                )}
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-gray-200">{children}</strong>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] text-gray-300 bg-white/[0.04] px-1.5 py-0.5">{children}</code>;
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={LINK_CLASS}>
        {children}
      </Link>
    );
  }
  const external = /^https?:/.test(href);
  return (
    <a href={href} className={LINK_CLASS} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}
