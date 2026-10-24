'use client';

const ROW_A = ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Node.js', 'Vercel', 'Cloudflare'];
const ROW_B = ['Laravel', 'PHP', 'MySQL', 'PostgreSQL', 'Redis', 'Stripe', 'Crypto payments', 'Docker', 'nginx'];

function Row({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div
        className={`flex w-max gap-3 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}
        style={{ ['--marquee-duration' as string]: '40s' }}
      >
        {doubled.map((t, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length}
            className="px-5 py-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] font-mono text-sm text-gray-400 whitespace-nowrap"
          >
            <span className="text-accent-red/70">›</span> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DevStack() {
  return (
    <section id="stack" className="relative py-20 md:py-28 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10">
        <div className="font-mono text-xs tracking-[0.2em] text-accent-red mb-4">{'// stack'}</div>
        <h2 className="font-mono font-bold tracking-tight text-3xl md:text-5xl text-white">Modern, boring, reliable.</h2>
        <p className="mt-5 text-gray-500 max-w-xl mx-auto">Proven tools, picked per project. No lock-in: the code is yours.</p>
      </div>
      <div className="space-y-3">
        <Row items={ROW_A} />
        <Row items={ROW_B} reverse />
      </div>
    </section>
  );
}
