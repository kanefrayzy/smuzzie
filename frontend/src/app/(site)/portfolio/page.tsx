'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import PortfolioGrid from '@/components/portfolio/PortfolioGrid';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { publicApi } from '@/lib/api';
import { PortfolioItem, Category } from '@/types';
import { Sparkles, Layers, Eye } from 'lucide-react';

export default function PortfolioPage() {
  return (
    <Suspense fallback={
      <div className="pt-24 pb-20 relative min-h-screen bg-[#060608] flex items-center justify-center">
        <div className="w-10 h-10 border border-accent-red/30 border-t-accent-red animate-spin" />
      </div>
    }>
      <PortfolioContent />
    </Suspense>
  );
}

function PortfolioContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [itemsRes, catsRes] = await Promise.all([
          publicApi.getPortfolio({ per_page: 500 }),
          publicApi.getCategories(),
        ]);
        setItems(itemsRes.data.data || itemsRes.data);
        setCategories(catsRes.data);
      } catch (error) {
        console.error('Failed to fetch portfolio data:', error);
        // Use demo data if API is not available
        setCategories([
          { id: 1, name: 'Logo Design', slug: 'logo-design', icon: '🎨', description: null, sort_order: 1, is_active: true, created_at: '', updated_at: '' },
          { id: 2, name: 'Thread Design', slug: 'thread-design', icon: '🧵', description: null, sort_order: 2, is_active: true, created_at: '', updated_at: '' },
          { id: 3, name: 'Signature Design', slug: 'signature-design', icon: '✍️', description: null, sort_order: 3, is_active: true, created_at: '', updated_at: '' },
          { id: 4, name: 'Ads Design', slug: 'ads-design', icon: '📢', description: null, sort_order: 4, is_active: true, created_at: '', updated_at: '' },
          { id: 5, name: 'Avatar Design', slug: 'avatar-design', icon: '👤', description: null, sort_order: 5, is_active: true, created_at: '', updated_at: '' },
          { id: 6, name: 'Custom Design', slug: 'custom-design', icon: '🎯', description: null, sort_order: 6, is_active: true, created_at: '', updated_at: '' },
          { id: 7, name: '3D Design', slug: '3d-design', icon: '🔮', description: null, sort_order: 7, is_active: true, created_at: '', updated_at: '' },
          { id: 8, name: 'CSS/Font Design', slug: 'css-font-design', icon: '🔤', description: null, sort_order: 8, is_active: true, created_at: '', updated_at: '' },
        ]);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="pt-24 pb-20 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[#060608]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />

      {/* Hero area */}
      <div className="relative overflow-hidden">
        {/* Red glow */}
        <div className="absolute top-0 left-1/3 w-[600px] h-[400px] bg-accent-red/[0.03] rounded-full blur-[150px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <ScrollReveal>
            {/* Badge */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px w-8 bg-accent-red/40" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60 flex items-center gap-1.5">
                <Sparkles size={10} />
                Our Works
              </span>
              <div className="h-px w-8 bg-accent-red/40" />
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-black tracking-tight">
              Our <span className="text-gradient animate-gradient-x" style={{ backgroundSize: '200% auto' }}>Portfolio</span>
            </h1>
            <p className="text-gray-500 text-base md:text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
              Explore our collection of premium designs — logos, avatars, 3D art, and more.
              <span className="text-white/60"> Hover over GIFs to see them animate.</span>
            </p>

            {/* Quick stats */}
            <motion.div
              className="flex items-center justify-center gap-6 mt-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 text-xs text-gray-600 font-mono tracking-wider">
                <Layers size={12} className="text-accent-red/50" />
                <span><strong className="text-white">{items.length || '500+'}</strong> PROJECTS</span>
              </div>
              <span className="text-accent-red/20">│</span>
              <div className="flex items-center gap-2 text-xs text-gray-600 font-mono tracking-wider">
                <Eye size={12} className="text-accent-red/50" />
                <span><strong className="text-white">{categories.length || '8'}</strong> CATEGORIES</span>
              </div>
            </motion.div>
          </ScrollReveal>
        </div>

        {/* Bottom line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/15 to-transparent" />
      </div>

      {/* Portfolio content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border border-accent-red/30 border-t-accent-red animate-spin" />
            <span className="text-gray-600 text-xs font-mono tracking-wider uppercase">Loading portfolio...</span>
          </div>
        ) : (
          <PortfolioGrid
            items={items}
            categories={categories}
            initialCategory={categoryParam || undefined}
          />
        )}
      </div>
    </div>
  );
}
