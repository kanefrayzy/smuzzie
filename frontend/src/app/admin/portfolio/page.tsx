'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '@/lib/api';
import { PortfolioItem, Category } from '@/types';
import { formatDate, formatFileSize, getImageUrl } from '@/lib/utils';
import {
  Plus, Edit2, Trash2, Upload, Image as ImageIcon,
  Save, X, Star, Eye, EyeOff, Filter, CheckSquare, Square, MinusSquare, Film
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminPortfolioPage() {
  // ─── File validation constants ───
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'];
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Invalid file type: .${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid MIME type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${formatFileSize(file.size)}. Maximum: 500MB`;
    }
    return null;
  };

  const validateFiles = (files: File[]): string | null => {
    for (const file of files) {
      const error = validateFile(file);
      if (error) return `${file.name}: ${error}`;
    }
    return null;
  };

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [uploadForm, setUploadForm] = useState({
    category_id: '',
    title: '',
    description: '',
    is_featured: false,
    is_active: true,
  });
  const [editForm, setEditForm] = useState({
    category_id: '',
    title: '',
    description: '',
    is_featured: false,
    is_active: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<FileList | null>(null);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ uploaded: 0, total: 0, failed: 0 });
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        adminApi.getPortfolio({ per_page: 500 }),
        adminApi.getCategories(),
      ]);
      setItems(itemsRes.data.data || itemsRes.data);
      setCategories(catsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredItems = filterCategory === 'all'
    ? items
    : items.filter((i) => i.category_id === parseInt(filterCategory));

  // ─── Selection helpers ───
  const allFilteredIds = filteredItems.map(i => i.id);
  const allSelected = filteredItems.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = allFilteredIds.some(id => selectedIds.has(id));
  const selectedCount = allFilteredIds.filter(id => selectedIds.has(id)).length;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      // Deselect all in current filter
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Select all in current filter
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const idsToDelete = allFilteredIds.filter(id => selectedIds.has(id));
    if (idsToDelete.length === 0) return;
    if (!confirm(`Delete ${idsToDelete.length} selected items? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await adminApi.bulkDeletePortfolio(idsToDelete);
      toast.success(`${idsToDelete.length} items deleted!`);
      setItems(prev => prev.filter(item => !idsToDelete.includes(item.id)));
      setSelectedIds(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.delete(id));
        return next;
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSingleUpload = async () => {
    if (!selectedFile || !uploadForm.category_id) {
      toast.error('Please select a file and category');
      return;
    }
    // Local file validation
    const fileError = validateFile(selectedFile);
    if (fileError) {
      toast.error(fileError);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('category_id', uploadForm.category_id);
      formData.append('title', uploadForm.title || selectedFile.name);
      formData.append('description', uploadForm.description);
      formData.append('is_featured', uploadForm.is_featured ? '1' : '0');
      formData.append('is_active', uploadForm.is_active ? '1' : '0');

      await adminApi.createPortfolioItem(formData);
      toast.success('Item uploaded successfully!');
      setShowUpload(false);
      setSelectedFile(null);
      setUploadForm({ category_id: '', title: '', description: '', is_featured: false, is_active: true });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFiles || !bulkCategoryId) {
      toast.error('Please select files and a category');
      return;
    }
    // Local file validation
    const filesError = validateFiles(Array.from(bulkFiles));
    if (filesError) {
      toast.error(filesError);
      return;
    }
    setUploading(true);

    const allFiles = Array.from(bulkFiles);
    const BATCH_SIZE = 5;
    const total = allFiles.length;
    let uploaded = 0;
    let failed = 0;
    setUploadProgress({ uploaded: 0, total, failed: 0 });

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = allFiles.slice(i, i + BATCH_SIZE);
        const formData = new FormData();
        formData.append('category_id', bulkCategoryId);
        batch.forEach((file) => formData.append('images[]', file));

        try {
          await adminApi.bulkUpload(formData);
          uploaded += batch.length;
        } catch {
          failed += batch.length;
        }
        setUploadProgress({ uploaded, total, failed });
      }

      if (failed === 0) {
        toast.success(`${total} items uploaded successfully!`);
      } else {
        toast.success(`Uploaded ${uploaded} of ${total} (${failed} failed)`);
      }
      setShowBulkUpload(false);
      setBulkFiles(null);
      setBulkCategoryId('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk upload failed');
    } finally {
      setUploading(false);
      setUploadProgress({ uploaded: 0, total: 0, failed: 0 });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this portfolio item?')) return;
    try {
      await adminApi.deletePortfolioItem(id);
      toast.success('Item deleted!');
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      toast.error('Failed to delete item');
    }
  };

  const handleToggleFeatured = async (item: PortfolioItem) => {
    try {
      await adminApi.togglePortfolioField(item.id, { is_featured: !item.is_featured });
      toast.success(item.is_featured ? 'Unfeatured' : 'Featured!');
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_featured: !i.is_featured } : i));
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleToggleActive = async (item: PortfolioItem) => {
    try {
      await adminApi.togglePortfolioField(item.id, { is_active: !item.is_active });
      toast.success(item.is_active ? 'Hidden' : 'Visible!');
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
    } catch {
      toast.error('Failed to update');
    }
  };

  const startEdit = (item: PortfolioItem) => {
    setEditingItem(item);
    setEditForm({
      category_id: item.category_id.toString(),
      title: item.title,
      description: item.description || '',
      is_featured: item.is_featured,
      is_active: item.is_active,
    });
    setEditFile(null);
    setShowUpload(false);
    setShowBulkUpload(false);
  };

  const handleEditSave = async () => {
    if (!editingItem) return;
    // Validate replacement file if provided
    if (editFile) {
      const fileError = validateFile(editFile);
      if (fileError) {
        toast.error(fileError);
        return;
      }
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('category_id', editForm.category_id);
      formData.append('title', editForm.title);
      formData.append('description', editForm.description);
      formData.append('is_featured', editForm.is_featured ? '1' : '0');
      formData.append('is_active', editForm.is_active ? '1' : '0');
      if (editFile) {
        formData.append('image', editFile);
      }
      await adminApi.updatePortfolioItem(editingItem.id, formData);
      toast.success('Item updated!');
      setEditingItem(null);
      setEditFile(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Portfolio Items</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} total items</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setRegenLoading(true);
              try {
                const res = await adminApi.regenerateThumbnails();
                toast.success(res.data.message);
                if (res.data.processed > 0) fetchData();
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed');
              } finally {
                setRegenLoading(false);
              }
            }}
            disabled={regenLoading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-surface border border-white/5 text-gray-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-2 disabled:opacity-50"
            title="Regenerate video thumbnails (FFmpeg)"
          >
            {regenLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
            ) : (
              <Film size={14} />
            )}
            Regen Posters
          </button>
          <button
            onClick={() => { setShowBulkUpload(true); setShowUpload(false); }}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-surface border border-white/5 text-gray-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-2"
          >
            <Upload size={14} />
            Bulk Upload
          </button>
          <button
            onClick={() => { setShowUpload(true); setShowBulkUpload(false); }}
            className="btn-primary text-sm"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>
      </div>

      {/* Single upload form */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-6 border border-white/5 mb-6 overflow-hidden"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Upload New Item</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select
                value={uploadForm.category_id}
                onChange={(e) => setUploadForm({ ...uploadForm, category_id: e.target.value })}
                className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-red/50"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Title"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50"
              />
            </div>
            <textarea
              placeholder="Description (optional)"
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              className="mt-4 w-full bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-red/50 resize-none"
              rows={2}
            />

            {/* File drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-accent-red/30 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    const error = validateFile(file);
                    if (error) {
                      toast.error(error);
                      e.target.value = '';
                      return;
                    }
                  }
                  setSelectedFile(file);
                }}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <ImageIcon size={20} className="text-accent-red" />
                  <span className="text-sm text-white">{selectedFile.name}</span>
                  <span className="text-xs text-gray-500">({formatFileSize(selectedFile.size)})</span>
                </div>
              ) : (
                <div>
                  <Upload size={24} className="mx-auto text-gray-500 mb-2" />
                  <p className="text-sm text-gray-400">Click to select image, GIF, or MP4 video</p>
                  <p className="text-xs text-gray-600 mt-1">PNG, JPG, GIF, WebP, MP4 up to 500MB</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 mt-4">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={uploadForm.is_featured}
                  onChange={(e) => setUploadForm({ ...uploadForm, is_featured: e.target.checked })}
                  className="rounded"
                />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={uploadForm.is_active}
                  onChange={(e) => setUploadForm({ ...uploadForm, is_active: e.target.checked })}
                  className="rounded"
                />
                Active
              </label>
              <div className="flex-1" />
              <button
                onClick={handleSingleUpload}
                disabled={uploading}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Upload size={14} /> Upload</>
                )}
              </button>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk upload form */}
      <AnimatePresence>
        {showBulkUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-6 border border-white/5 mb-6 overflow-hidden"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Bulk Upload</h3>
            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="bg-surface border border-white/5 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-red/50 w-full sm:w-auto mb-4"
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>

            <div
              onClick={() => bulkInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-accent-red/30 transition-colors"
            >
              <input
                ref={bulkInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    const error = validateFiles(Array.from(files));
                    if (error) {
                      toast.error(error);
                      e.target.value = '';
                      return;
                    }
                  }
                  setBulkFiles(files);
                }}
                className="hidden"
              />
              {bulkFiles?.length ? (
                <p className="text-sm text-white">{bulkFiles.length} files selected</p>
              ) : (
                <div>
                  <Upload size={24} className="mx-auto text-gray-500 mb-2" />
                  <p className="text-sm text-gray-400">Click to select files</p>
                </div>
              )}
            </div>

            {/* Upload progress */}
            {uploading && uploadProgress.total > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    Uploading... {uploadProgress.uploaded} / {uploadProgress.total}
                    {uploadProgress.failed > 0 && (
                      <span className="text-red-400 ml-2">({uploadProgress.failed} failed)</span>
                    )}
                  </span>
                  <span className="text-white font-medium">
                    {Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-red rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.uploaded / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={handleBulkUpload}
                disabled={uploading}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Upload size={14} /> Upload All</>
                )}
              </button>
              <button onClick={() => setShowBulkUpload(false)} className="text-gray-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editingItem && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
            <motion.div
              className="relative w-full max-w-2xl bg-surface rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white">Edit Portfolio Item</h3>
                <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Current image preview */}
                <div className="flex items-start gap-4">
                  <div className="w-32 h-24 rounded-xl overflow-hidden bg-surface-dark flex-shrink-0">
                    {(editFile ? editFile.type.startsWith('video/') : editingItem.file_type === 'video') ? (
                      <video
                        src={editFile ? URL.createObjectURL(editFile) : getImageUrl(editingItem.image_url)}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <img
                        src={editFile ? URL.createObjectURL(editFile) : getImageUrl(editingItem.thumbnail_url)}
                        alt={editingItem.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-2">
                      {editingItem.file_type?.toUpperCase()} • {editingItem.width}×{editingItem.height} • {formatFileSize(editingItem.file_size)}
                    </p>
                    <button
                      onClick={() => editFileInputRef.current?.click()}
                      className="text-xs text-accent-red hover:text-accent-crimson transition-colors"
                    >
                      Replace file...
                    </button>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) {
                          const error = validateFile(file);
                          if (error) {
                            toast.error(error);
                            e.target.value = '';
                            return;
                          }
                        }
                        setEditFile(file);
                      }}
                      className="hidden"
                    />
                    {editFile && (
                      <p className="text-xs text-green-400 mt-1">New: {editFile.name}</p>
                    )}
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Category</label>
                    <select
                      value={editForm.category_id}
                      onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                      className="w-full bg-primary border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent-red/50"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full bg-primary border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent-red/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full bg-primary border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent-red/50 resize-none"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_featured}
                      onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })}
                      className="rounded border-white/20 bg-primary text-accent-red focus:ring-accent-red/30"
                    />
                    Featured
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      className="rounded border-white/20 bg-primary text-accent-red focus:ring-accent-red/30"
                    />
                    Active (visible)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Save size={14} /> Save Changes</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category filter + selection controls */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Filter size={14} className="text-gray-500 flex-shrink-0" />
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              filterCategory === 'all' ? 'bg-accent-red text-white' : 'bg-surface text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(c.id.toString())}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                filterCategory === c.id.toString() ? 'bg-accent-red text-white' : 'bg-surface text-gray-400 hover:text-white'
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* Select all toggle */}
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap bg-surface text-gray-400 hover:text-white border border-white/5 hover:border-white/20"
          title={allSelected ? 'Deselect All' : 'Select All'}
        >
          {allSelected ? <CheckSquare size={14} className="text-accent-red" /> : someSelected ? <MinusSquare size={14} className="text-accent-red" /> : <Square size={14} />}
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <motion.div
            key={item.id}
            layout
            className={`glass-card border overflow-hidden group cursor-pointer transition-all ${
              selectedIds.has(item.id)
                ? 'border-accent-red/60 ring-2 ring-accent-red/30'
                : 'border-white/5 hover:border-white/10'
            }`}
          >
            {/* Thumbnail */}
            <div className="relative aspect-[4/3] bg-surface-dark">
              {/* Selection checkbox */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                className={`absolute top-2 right-2 z-10 p-1 rounded-md transition-all ${
                  selectedIds.has(item.id)
                    ? 'bg-accent-red text-white shadow-lg shadow-accent-red/30'
                    : 'bg-black/50 text-white/50 opacity-0 group-hover:opacity-100 hover:bg-black/70 hover:text-white'
                }`}
              >
                {selectedIds.has(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              {item.file_type === 'video' ? (
                <video
                  src={getImageUrl(item.image_url)}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                  onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                />
              ) : (
                <img
                  src={getImageUrl(item.thumbnail_url)}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-1.5">
                {item.file_type === 'gif' && (
                  <span className="px-2 py-0.5 bg-accent-red/80 backdrop-blur-sm rounded text-[10px] font-bold">GIF</span>
                )}
                {item.file_type === 'video' && (
                  <span className="px-2 py-0.5 bg-purple-500/80 backdrop-blur-sm rounded text-[10px] font-bold">VIDEO</span>
                )}
                {item.is_featured && (
                  <span className="px-2 py-0.5 bg-yellow-500/80 backdrop-blur-sm rounded text-[10px] font-bold">★</span>
                )}
                {!item.is_active && (
                  <span className="px-2 py-0.5 bg-red-500/80 backdrop-blur-sm rounded text-[10px] font-bold">Hidden</span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="text-white font-semibold text-sm truncate">{item.title}</h3>
              <p className="text-gray-500 text-xs mt-1">{item.category?.name || 'Uncategorized'}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                <span className="text-[10px] text-gray-600">{formatDate(item.created_at)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                    title="Edit"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleToggleFeatured(item)}
                    className={`p-1.5 rounded-lg transition-all ${
                      item.is_featured ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-yellow-400'
                    }`}
                    title={item.is_featured ? 'Unfeature' : 'Feature'}
                  >
                    <Star size={12} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`p-1.5 rounded-lg transition-all ${
                      item.is_active ? 'text-green-400 bg-green-400/10' : 'text-gray-500 hover:text-green-400'
                    }`}
                    title={item.is_active ? 'Hide' : 'Show'}
                  >
                    {item.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🖼️</div>
          <p className="text-gray-400">No items found. Upload your first portfolio piece!</p>
        </div>
      )}

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 rounded-2xl bg-surface/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50"
          >
            <span className="text-sm text-gray-300">
              <span className="font-bold text-white">{selectedCount}</span> selected
            </span>
            <div className="w-px h-6 bg-white/10" />
            <button
              onClick={clearSelection}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border border-red-500/20 transition-all disabled:opacity-50"
            >
              {bulkDeleting ? (
                <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Delete Selected
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
