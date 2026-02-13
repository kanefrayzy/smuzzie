'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi } from '@/lib/api';
import { Category } from '@/types';
import { Plus, Edit2, Trash2, GripVertical, Save, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', icon: '', description: '', sort_order: 0, is_active: true });

  const fetchCategories = async () => {
    try {
      const res = await adminApi.getCategories();
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    try {
      await adminApi.createCategory(form);
      toast.success('Category created!');
      setShowCreate(false);
      setForm({ name: '', slug: '', icon: '', description: '', sort_order: 0, is_active: true });
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create category');
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await adminApi.updateCategory(id, form);
      toast.success('Category updated!');
      setEditingId(null);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update category');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure? This will delete all portfolio items in this category.')) return;
    try {
      await adminApi.deleteCategory(id);
      toast.success('Category deleted!');
      setCategories(prev => prev.filter(cat => cat.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || '',
      description: cat.description || '',
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' } }} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Categories</h1>
          <p className="text-gray-500 text-sm mt-1">Manage portfolio categories</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setEditingId(null); setForm({ name: '', slug: '', icon: '', description: '', sort_order: categories.length, is_active: true }); }}
          className="btn-primary text-sm"
        >
          <Plus size={16} />
          Add Category
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-card p-6 border border-white/5 mb-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">New Category</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50"
            />
            <input
              type="text"
              placeholder="Slug (auto-generated)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50"
            />
            <input
              type="text"
              placeholder="Icon (emoji)"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50"
            />
            <input
              type="number"
              placeholder="Sort Order"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50"
            />
          </div>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-4 w-full bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50 resize-none"
            rows={2}
          />
          <div className="flex items-center gap-4 mt-4">
            <button onClick={handleCreate} className="btn-primary text-sm">
              <Save size={14} /> Create
            </button>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
              <X size={14} /> Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Categories list */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <motion.div
            key={cat.id}
            layout
            className="glass-card p-5 border border-white/5 hover:border-white/10 transition-all"
          >
            {editingId === cat.id ? (
              /* Editing mode */
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="bg-surface border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent-red/50"
                  />
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="bg-surface border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent-red/50"
                  />
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="bg-surface border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent-red/50"
                  />
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                    className="bg-surface border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent-red/50"
                  />
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="rounded"
                    />
                    Active
                  </label>
                  <div className="flex-1" />
                  <button onClick={() => handleUpdate(cat.id)} className="btn-primary text-xs py-2 px-4">
                    <Save size={12} /> Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <div className="flex items-center gap-4">
                <GripVertical size={16} className="text-gray-600 cursor-grab" />
                <span className="text-2xl">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm">{cat.name}</h3>
                    {!cat.is_active && (
                      <span className="text-[10px] px-2 py-0.5 bg-red-400/10 text-red-400 rounded-full">Inactive</span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs font-mono">{cat.slug}</span>
                </div>
                <span className="text-xs text-gray-500 bg-surface px-3 py-1 rounded-full">
                  {cat.portfolio_items_count || 0} items
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-2 text-gray-400 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📁</div>
          <p className="text-gray-400">No categories yet. Create your first one!</p>
        </div>
      )}
    </div>
  );
}
