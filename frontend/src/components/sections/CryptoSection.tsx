'use client';

import React from 'react';
import { motion } from 'framer-motion';
import ScrollReveal from '@/components/ui/ScrollReveal';

const cryptos = [
  { name: 'Bitcoin', symbol: 'BTC', logo: '/images/crypto/bitcoin-btc-logo.svg' },
  { name: 'Ethereum', symbol: 'ETH', logo: '/images/crypto/ethereum-eth-logo.svg' },
  { name: 'Litecoin', symbol: 'LTC', logo: '/images/crypto/litecoin-ltc-logo.svg' },
  { name: 'Tether', symbol: 'USDT', logo: '/images/crypto/tether-usdt-logo.svg' },
  { name: 'Solana', symbol: 'SOL', logo: '/images/crypto/solana-sol-logo.svg' },
];

export default function CryptoSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />

      {/* HUD lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-8 bg-accent-red/40" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Payment</span>
              <div className="h-px w-8 bg-accent-red/40" />
            </div>
            <h2 className="section-heading">
              Supported <span className="text-gradient">Cryptocurrencies</span>
            </h2>
            <p className="section-subheading">
              Secure transactions using your preferred digital currency
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {cryptos.map((crypto, index) => (
            <ScrollReveal key={crypto.symbol} delay={index * 0.08}>
              <motion.div
                className="p-5 text-center border border-white/[0.06] hover:border-accent-red/20 bg-white/[0.01] transition-all duration-300 cursor-default group"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                {/* Crypto logo */}
                <div className="flex justify-center mb-3">
                  <img
                    src={crypto.logo}
                    alt={crypto.name}
                    className="w-10 h-10 group-hover:scale-110 transition-transform"
                  />
                </div>

                <h3 className="text-white font-semibold text-sm mb-0.5">{crypto.name}</h3>
                <span className="text-gray-600 text-[10px] font-mono tracking-wider">{crypto.symbol}</span>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <p className="text-center text-gray-600 text-xs mt-10 font-mono tracking-wider uppercase">
            All transactions encrypted · Additional currencies upon request
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
