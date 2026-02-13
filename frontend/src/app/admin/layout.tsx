'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import {
  LayoutDashboard, FolderOpen, Image, Star, Mail,
  LogOut, Menu, X, ChevronRight, Settings
} from 'lucide-react';

const sidebarLinks = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Categories', href: '/admin/categories', icon: FolderOpen },
  { label: 'Portfolio', href: '/admin/portfolio', icon: Image },
  { label: 'Reviews', href: '/admin/reviews', icon: Star },
  { label: 'Contacts', href: '/admin/contacts', icon: Mail },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout, hydrate } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrate();
    setHydrated(true);
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !isAuthenticated && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  // Login page - no sidebar
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen bg-primary flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-surface border-r border-white/5 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:z-auto`}
      >
        <div className="flex flex-col h-full">
          {/* Logo area */}
          <div className="p-6 border-b border-white/5">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-red to-accent-red flex items-center justify-center font-bold text-lg">
                D
              </div>
              <div>
                <span className="font-display font-bold text-sm">Smuzzie</span>
                <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Admin Panel</span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {sidebarLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-accent-red/10 text-accent-red border border-accent-red/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <link.icon size={18} />
                  {link.label}
                  {isActive && <ChevronRight size={14} className="ml-auto" />}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-accent-red/20 flex items-center justify-center text-accent-red text-sm font-bold">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{user?.name}</div>
                <div className="text-xs text-gray-500 truncate">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all w-full mt-1"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-primary/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
            <div className="flex-1" />
            <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              View Site →
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
