// Type definitions for Vendor Portal

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface Case {
  id: number;
  case_number: string;
  case_type: string;
  status: 'new' | 'in_progress' | 'completed' | 'awaiting_submission';
  assigned_date: string;
  due_date: string;
  location: string;
  description: string;
  priority?: string;
}

export interface Photo {
  id?: number;
  uri: string;
  fileName: string;
  type: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
}

export interface IncidentReport {
  case_id: number;
  observation: string;
  statement: string;
  date_time: string;
  location: string;
  latitude?: number;
  longitude?: number;
}

export interface ValidationWarning {
  type: 'error' | 'warning' | 'success';
  message: string;
  field?: string;
}

export interface CaseStatistics {
  new_cases: number;
  in_progress: number;
  completed: number;
  pending_submissions: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'reminder' | 'assignment' | 'update';
}
