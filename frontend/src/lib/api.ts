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
  bulkUpload: (data: FormData) =>
    api.post('/admin/portfolio/bulk-upload', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  reorderPortfolio: (items: { id: number; sort_order: number }[]) =>
    api.post('/admin/portfolio/reorder', { items }),

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
};
