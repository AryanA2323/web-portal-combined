export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: VendorUser;
}

export interface VendorUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  company?: string;
  address?: string;
  role: string;
}

export interface Case {
  id: number;
  case_number: string;
  title: string;
  description: string;
  status: string;
  assigned_to: number;
  created_at: string;
  updated_at: string;
  priority?: string;
  location?: string;
}

export interface CasesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Case[];
}

export interface ApiError {
  message: string;
  status: number;
  details?: Record<string, any>;
}
