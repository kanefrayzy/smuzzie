'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi } from '@/lib/api';
import { DashboardStats } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  FolderOpen, Image, Star, Mail, TrendingUp,
  Eye, Sparkles, Clock
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await adminApi.getDashboard();
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Categories', value: stats?.total_categories || 0, icon: FolderOpen, color: 'text-accent-red bg-accent-red/10' },
    { label: 'Total Items', value: stats?.total_items || 0, icon: Image, color: 'text-accent-red bg-accent-red/10' },
    { label: 'Active Items', value: stats?.active_items || 0, icon: Eye, color: 'text-green-400 bg-green-400/10' },
    { label: 'Featured', value: stats?.featured_items || 0, icon: Sparkles, color: 'text-yellow-400 bg-yellow-400/10' },
    { label: 'Reviews', value: stats?.total_reviews || 0, icon: Star, color: 'text-orange-400 bg-orange-400/10' },
    { label: 'New Contacts', value: stats?.new_contacts || 0, icon: Mail, color: 'text-red-400 bg-red-400/10' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your portfolio management</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            className="glass-card p-5 border border-white/5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
              <card.icon size={18} />
            </div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            <div className="text-xs text-gray-500 mt-1">{card.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories breakdown */}
        <div className="glass-card p-6 border border-white/5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FolderOpen size={18} className="text-accent-red" />
            Categories
          </h2>
          <div className="space-y-3">
            {stats?.categories_breakdown?.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-sm text-gray-300">{cat.name}</span>
                </div>
                <span className="text-xs text-gray-500 bg-surface px-3 py-1 rounded-full">
                  {(cat as any).portfolio_items_count || 0} items
                </span>
              </div>
            ))}
          </div>
          <Link href="/admin/categories" className="block text-accent-red text-sm mt-4 hover:text-accent-red transition-colors">
            Manage Categories →
          </Link>
        </div>

        {/* Recent contacts */}
        <div className="glass-card p-6 border border-white/5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Mail size={18} className="text-accent-red" />
            Recent Contacts
          </h2>
          <div className="space-y-3">
            {stats?.recent_contacts?.length ? (
              stats.recent_contacts.map((contact) => (
                <div key={contact.id} className="py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium">{contact.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      contact.status === 'new' ? 'bg-red-400/10 text-red-400' :
                      contact.status === 'read' ? 'bg-yellow-400/10 text-yellow-400' :
                      'bg-green-400/10 text-green-400'
                    }`}>
                      {contact.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{contact.subject}</p>
                  <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {formatDate(contact.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No contacts yet</p>
            )}
          </div>
          <Link href="/admin/contacts" className="block text-accent-red text-sm mt-4 hover:text-accent-red transition-colors">
            View All Contacts →
          </Link>
        </div>
      </div>
    </div>
  );
}
