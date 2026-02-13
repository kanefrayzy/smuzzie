'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await adminApi.login(email, password);
      setAuth(res.data.access_token, res.data.user);
      toast.success('Welcome back!');
      router.push('/admin');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' } }} />

      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-accent-red/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-accent-red/5 rounded-full blur-[150px]" />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent-red to-accent-red flex items-center justify-center font-bold text-2xl mb-4">
            D
          </div>
          <h1 className="text-2xl font-display font-bold">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-2">Sign in to manage your portfolio</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-card p-8 border border-white/5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface border border-white/5 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50 focus:ring-1 focus:ring-accent-red/30 transition-all"
                placeholder="admin@smuzzie.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-white/5 rounded-xl pl-11 pr-11 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50 focus:ring-1 focus:ring-accent-red/30 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>

      </motion.div>
    </div>
  );
}
