'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi } from '@/lib/api';
import { Review } from '@/types';
import { formatDate } from '@/lib/utils';
import { Plus, Edit2, Trash2, Star, Save, X, Eye, EyeOff } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    customer_name: '',
    customer_avatar: '',
    content: '',
    rating: 5,
    is_active: true,
    sort_order: 0,
  });

  const fetchReviews = async () => {
    try {
      const res = await adminApi.getReviews();
      setReviews(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleCreate = async () => {
    try {
      await adminApi.createReview(form);
      toast.success('Review created!');
      setShowCreate(false);
      resetForm();
      fetchReviews();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await adminApi.updateReview(id, form);
      toast.success('Review updated!');
      setEditingId(null);
      fetchReviews();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this review?')) return;
    try {
      await adminApi.deleteReview(id);
      toast.success('Review deleted!');
      setReviews(prev => prev.filter(review => review.id !== id));
    } catch {
      toast.error('Failed');
    }
  };

  const resetForm = () => {
    setForm({ customer_name: '', customer_avatar: '', content: '', rating: 5, is_active: true, sort_order: 0 });
  };

  const startEdit = (r: Review) => {
    setEditingId(r.id);
    setForm({
      customer_name: r.customer_name,
      customer_avatar: r.customer_avatar || '',
      content: r.content,
      rating: r.rating,
      is_active: r.is_active,
      sort_order: r.sort_order,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
      </div>
    );
  }

  const ReviewForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Customer Name"
          value={form.customer_name}
          onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
          className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50"
        />
        <input
          type="text"
          placeholder="Avatar (emoji or URL)"
          value={form.customer_avatar}
          onChange={(e) => setForm({ ...form, customer_avatar: e.target.value })}
          className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400 whitespace-nowrap">Rating:</label>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setForm({ ...form, rating: n })}
              className={`p-1 ${n <= form.rating ? 'text-yellow-400' : 'text-gray-600'}`}
            >
              <Star size={18} className={n <= form.rating ? 'fill-yellow-400' : ''} />
            </button>
          ))}
        </div>
      </div>
      <textarea
        placeholder="Review content"
        value={form.content}
        onChange={(e) => setForm({ ...form, content: e.target.value })}
        className="w-full bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50 resize-none"
        rows={3}
      />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active
        </label>
        <div className="flex-1" />
        <button onClick={onSubmit} className="btn-primary text-sm">
          <Save size={14} /> {submitLabel}
        </button>
        <button
          onClick={() => { setShowCreate(false); setEditingId(null); }}
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' } }} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Reviews</h1>
          <p className="text-gray-500 text-sm mt-1">Manage customer testimonials</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); resetForm(); }}
          className="btn-primary text-sm"
        >
          <Plus size={16} />
          Add Review
        </button>
      </div>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-card p-6 border border-white/5 mb-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">New Review</h3>
          <ReviewForm onSubmit={handleCreate} submitLabel="Create" />
        </motion.div>
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <motion.div
            key={review.id}
            layout
            className="glass-card p-5 border border-white/5"
          >
            {editingId === review.id ? (
              <ReviewForm onSubmit={() => handleUpdate(review.id)} submitLabel="Save" />
            ) : (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-lg flex-shrink-0">
                  {review.customer_avatar || '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm">{review.customer_name}</h3>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={10} className={i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                      ))}
                    </div>
                    {!review.is_active && (
                      <span className="text-[10px] px-2 py-0.5 bg-red-400/10 text-red-400 rounded-full">Hidden</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-2 line-clamp-2">{review.content}</p>
                  <span className="text-[10px] text-gray-600 mt-2 block">{formatDate(review.created_at)}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(review)} className="p-2 text-gray-400 hover:text-accent-red hover:bg-accent-red/10 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(review.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {reviews.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">⭐</div>
          <p className="text-gray-400">No reviews yet. Add your first testimonial!</p>
        </div>
      )}
    </div>
  );
}
