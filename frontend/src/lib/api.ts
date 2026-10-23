import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      if (window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('/login')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Public API ───────────────────────────────────────────────

export const publicApi = {
  getCategories: () => api.get('/categories', { params: { active_only: true } }),
  getCategory: (id: number) => api.get(`/categories/${id}`),
  getPortfolio: (params?: Record<string, any>) => api.get('/portfolio', { params }),
  getPortfolioItem: (id: number) => api.get(`/portfolio/${id}`),
  getReviews: () => api.get('/reviews'),
  submitContact: (data: { name: string; email: string; subject: string; message: string }) =>
    api.post('/contact', data),

  // Banner builder
  getBannerTemplates: () => api.get('/banners/templates'),
  getBannerTemplate: (slug: string) => api.get(`/banners/templates/${encodeURIComponent(slug)}`),
  createBannerOrder: (data: FormData) =>
    api.post('/banners/orders', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getBannerOrder: (token: string) => api.get(`/banners/orders/${encodeURIComponent(token)}`),
  getPaymentAvailability: () => api.get('/banners/payments/availability'),
  getPaymentMethods: (token: string) => api.get(`/banners/orders/${encodeURIComponent(token)}/payment-methods`),
  selectPaymentMethod: (token: string, method: string) =>
    api.post(`/banners/orders/${encodeURIComponent(token)}/payment`, { method }),
};

// ─── Admin API ────────────────────────────────────────────────

export const adminApi = {
  // Auth
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/admin/auth/logout'),
  getMe: () => api.get('/admin/auth/me'),
  refreshToken: () => api.post('/admin/auth/refresh'),

  // Dashboard
  getDashboard: () => api.get('/admin/dashboard'),

  // Categories
  getCategories: () => api.get('/admin/categories'),
  createCategory: (data: FormData | Record<string, any>) => api.post('/admin/categories', data),
  updateCategory: (id: number, data: Record<string, any>) => api.put(`/admin/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete(`/admin/categories/${id}`),

  // Portfolio
  getPortfolio: (params?: Record<string, any>) => api.get('/admin/portfolio', { params: { ...params, include_inactive: true } }),
  createPortfolioItem: (data: FormData) =>
    api.post('/admin/portfolio', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updatePortfolioItem: (id: number, data: FormData) => {
    data.append('_method', 'PUT');
    return api.post(`/admin/portfolio/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  togglePortfolioField: (id: number, data: Record<string, any>) =>
    api.patch(`/admin/portfolio/${id}/toggle`, data),
  deletePortfolioItem: (id: number) => api.delete(`/admin/portfolio/${id}`),
  bulkDeletePortfolio: (ids: number[]) => api.post('/admin/portfolio/bulk-delete', { ids }),
  bulkUpload: (data: FormData) =>
    api.post('/admin/portfolio/bulk-upload', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  reorderPortfolio: (items: { id: number; sort_order: number }[]) =>
    api.post('/admin/portfolio/reorder', { items }),
  regenerateThumbnails: () =>
    api.post('/admin/portfolio/regenerate-thumbnails', { force: false }),

  // Reviews
  getReviews: () => api.get('/admin/reviews', { params: { include_inactive: true } }),
  createReview: (data: Record<string, any>) => api.post('/admin/reviews', data),
  updateReview: (id: number, data: Record<string, any>) => api.put(`/admin/reviews/${id}`, data),
  deleteReview: (id: number) => api.delete(`/admin/reviews/${id}`),

  // Contacts
  getContacts: (params?: Record<string, any>) => api.get('/admin/contacts', { params }),
  getContact: (id: number) => api.get(`/admin/contacts/${id}`),
  updateContactStatus: (id: number, status: string) => api.patch(`/admin/contacts/${id}/status`, { status }),
  deleteContact: (id: number) => api.delete(`/admin/contacts/${id}`),

  // Banner builder: fonts
  getBannerFonts: () => api.get('/admin/banner-fonts'),
  createBannerFont: (data: FormData) =>
    api.post('/admin/banner-fonts', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateBannerFont: (id: number, data: Record<string, any>) => api.put(`/admin/banner-fonts/${id}`, data),
  deleteBannerFont: (id: number) => api.delete(`/admin/banner-fonts/${id}`),

  // Banner builder: templates
  getBannerTemplates: () => api.get('/admin/banner-templates'),
  getBannerTemplate: (id: number) => api.get(`/admin/banner-templates/${id}`),
  createBannerTemplate: (data: Record<string, any>) => api.post('/admin/banner-templates', data),
  updateBannerTemplate: (id: number, data: Record<string, any>) => api.put(`/admin/banner-templates/${id}`, data),
  deleteBannerTemplate: (id: number) => api.delete(`/admin/banner-templates/${id}`),
  uploadBannerZoneImage: (id: number, data: FormData) =>
    api.post(`/admin/banner-templates/${id}/zone-image`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadBannerSource: (id: number, data: FormData, onUploadProgress?: (e: any) => void) =>
    api.post(`/admin/banner-templates/${id}/source`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  reprocessBannerTemplate: (id: number) => api.post(`/admin/banner-templates/${id}/reprocess`),
  testRenderBannerTemplate: (id: number) => api.post(`/admin/banner-templates/${id}/test-render`),
  getLatestTestRender: (id: number) => api.get(`/admin/banner-templates/${id}/test-render`),
  reorderBannerTemplates: (items: { id: number; sort_order: number }[]) =>
    api.post('/admin/banner-templates/reorder', { items }),

  // Banner builder: orders
  getBannerOrders: (params?: Record<string, any>) => api.get('/admin/banner-orders', { params }),
  getBannerOrder: (id: number) => api.get(`/admin/banner-orders/${id}`),
  markBannerOrderPaid: (id: number) => api.post(`/admin/banner-orders/${id}/mark-paid`),
  rerenderBannerOrder: (id: number) => api.post(`/admin/banner-orders/${id}/rerender`),
};
