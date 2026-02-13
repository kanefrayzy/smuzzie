'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { publicApi } from '@/lib/api';
import { Review } from '@/types';

// Fallback reviews in case API fails or returns empty
const fallbackReviews: Review[] = [
  {
    id: 1,
    customer_name: 'xNightWolf',
    customer_avatar: '🧑‍💻',
    content: 'Absolutely incredible work! The logo design exceeded all my expectations. Professional, creative, and delivered on time. Will definitely come back for more!',
    rating: 5,
    is_active: true,
    sort_order: 1,
    created_at: '',
    updated_at: '',
  },
  {
    id: 2,
    customer_name: 'PixelQueen',
    customer_avatar: '👩‍🎨',
    content: 'Best designer I\'ve worked with. The attention to detail in the 3D design was phenomenal. Highly recommend to anyone looking for quality!',
    rating: 5,
    is_active: true,
    sort_order: 2,
    created_at: '',
    updated_at: '',
  },
  {
    id: 3,
    customer_name: 'DarkViper_',
    customer_avatar: '👨‍🎤',
    content: 'Outstanding thread designs that really captured the vibe I was going for. Quick turnaround and amazing communication throughout.',
    rating: 5,
    is_active: true,
    sort_order: 3,
    created_at: '',
    updated_at: '',
  },
  {
    id: 4,
    customer_name: 'CyberNova',
    customer_avatar: '👩‍💼',
    content: 'The custom avatar design was exactly what I needed for my brand. Creative, unique, and professional quality. Couldn\'t be happier!',
    rating: 4,
    is_active: true,
    sort_order: 4,
    created_at: '',
    updated_at: '',
  },
  {
    id: 5,
    customer_name: 'BlazeFrost',
    customer_avatar: '🧑‍🔬',
    content: 'Exceptional CSS/Font design work. The animations and styling were top-notch. Will definitely work together again on future projects!',
    rating: 5,
    is_active: true,
    sort_order: 5,
    created_at: '',
    updated_at: '',
  },
  {
    id: 6,
    customer_name: 'ShadowMint',
    customer_avatar: '👩‍🚀',
    content: 'The signature design looked amazing and really stood out. Great value for money and super fast delivery. A+ service!',
    rating: 5,
    is_active: true,
    sort_order: 6,
    created_at: '',
    updated_at: '',
  },
];

const avatarEmojis = ['🧑‍💻', '👩‍🎨', '👨‍🎤', '👩‍💼', '🧑‍🔬', '👩‍🚀', '🎮', '🎧', '🖥️', '⚡'];

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await publicApi.getReviews();
        const data = Array.isArray(res.data) ? res.data : res.data.data || [];
        // Only show active reviews
        const activeReviews = data.filter((r: Review) => r.is_active);
        setReviews(activeReviews.length > 0 ? activeReviews : fallbackReviews);
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
        setReviews(fallbackReviews);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  // Need at least a few items for the scrolling animation to work well
  const items = reviews.length >= 3
    ? [...reviews, ...reviews, ...reviews]
    : [...reviews, ...reviews, ...reviews, ...reviews, ...reviews, ...reviews];

  if (loading) {
    return (
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-primary" />
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-accent-red/30 border-t-accent-red animate-spin rounded-full" />
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-primary" />
      <div className="absolute inset-0 bg-grid-pattern opacity-100" />

      {/* Horizontal HUD lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-red/10 to-transparent" />

      <div className="relative z-10">
        <ScrollReveal>
          <div className="text-center mb-16 px-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-8 bg-accent-red/40" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent-red/60">Testimonials</span>
              <div className="h-px w-8 bg-accent-red/40" />
            </div>
            <h2 className="section-heading">
              What Our <span className="text-gradient">Clients Say</span>
            </h2>
            <p className="section-subheading">
              Real testimonials from satisfied customers around the world
            </p>
          </div>
        </ScrollReveal>

        {/* Scrolling reviews */}
        <div className="overflow-hidden relative">
          {/* Gradient fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-primary to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-primary to-transparent z-10" />

          <motion.div
            className="flex gap-5 w-max px-8"
            animate={{ x: ['0%', '-33.333%'] }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
          >
            {items.map((review, index) => (
              <div
                key={`review-${index}`}
                className="flex-shrink-0 w-80 md:w-96 p-6 border border-white/[0.06] hover:border-accent-red/20 bg-white/[0.01] transition-all duration-300 group"
                style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
              >
                {/* Quote icon */}
                <Quote size={20} className="text-accent-red/20 mb-4" />

                {/* Review text */}
                <p className="text-gray-400 text-sm leading-relaxed mb-6 line-clamp-4">
                  &ldquo;{review.content}&rdquo;
                </p>

                {/* Reviewer info */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.04]">
                  <div className="w-10 h-10 flex items-center justify-center bg-white/[0.03] border border-white/[0.06] text-lg"
                    style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
                  >
                    {review.customer_avatar || avatarEmojis[review.id % avatarEmojis.length]}
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">{review.customer_name}</h4>
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={10}
                          className={i < review.rating ? 'text-accent-gold fill-accent-gold' : 'text-gray-700'}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
