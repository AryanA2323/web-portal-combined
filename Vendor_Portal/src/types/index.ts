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
  category?: string;
  claim_number?: string;
  claimant_name?: string;
  insured_name?: string;
  client_code?: string;
  location?: string;
  incident_address?: string;
  incident_city?: string;
  incident_state?: string;
  incident_country?: string;
  incident_postal_code?: string;
  formatted_address?: string;
  latitude?: number;
  longitude?: number;
  assigned_vendor_id?: number;
  assigned_vendor?: string;
  client_id?: number;
  created_by_id?: number;
  resolved_at?: string;
  closed_at?: string;
  source?: string;
  workflow_type?: string;
  investigation_progress?: number;
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
