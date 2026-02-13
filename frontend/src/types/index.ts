export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  portfolio_items_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItem {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  thumbnail_url: string;
  image_url: string;
  gif_url: string | null;
  local_path: string | null;
  width: number | null;
  height: number | null;
  file_type: 'image' | 'gif' | 'video';
  file_size: number | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  tags: string[] | null;
  category?: Category;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: number;
  customer_name: string;
  customer_avatar: string | null;
  content: string;
  rating: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContactSubmission {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_categories: number;
  total_items: number;
  active_items: number;
  featured_items: number;
  total_reviews: number;
  new_contacts: number;
  total_contacts: number;
  categories_breakdown: Category[];
  recent_items: PortfolioItem[];
  recent_contacts: ContactSubmission[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}
