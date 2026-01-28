// Demo data for development and testing

import type { Case, CaseStatistics, Photo, IncidentReport } from '../types';

export const DEMO_CASES: Case[] = [
  {
    id: 1,
    case_number: 'CASE-2026-001',
    case_type: 'collision',
    status: 'new',
    assigned_date: '2026-01-15T10:30:00Z',
    due_date: '2026-01-25T23:59:59Z',
    location: 'Downtown Plaza, Main Street',
    description: 'Vehicle collision at intersection. Front-end damage to both vehicles. No injuries reported.',
    priority: 'high',
  },
  {
    id: 2,
    case_number: 'CASE-2026-002',
    case_type: 'water_leak',
    status: 'in_progress',
    assigned_date: '2026-01-12T14:20:00Z',
    due_date: '2026-01-22T23:59:59Z',
    location: 'Residential Complex, Apartment 304',
    description: 'Water leak from ceiling causing damage to flooring and furniture. Tenant requesting urgent inspection.',
    priority: 'medium',
  },
  {
    id: 3,
    case_number: 'CASE-2026-003',
    case_type: 'fire_damage',
    status: 'in_progress',
    assigned_date: '2026-01-10T09:15:00Z',
    due_date: '2026-01-20T23:59:59Z',
    location: 'Commercial Building, 5th Floor',
    description: 'Fire damage assessment required for insurance claim. Smoke and structural damage to office space.',
    priority: 'high',
  },
  {
    id: 4,
    case_number: 'CASE-2026-004',
    case_type: 'theft',
    status: 'awaiting_submission',
    assigned_date: '2026-01-08T11:00:00Z',
    due_date: '2026-01-18T23:59:59Z',
    location: 'Retail Store, Shopping Mall',
    description: 'Investigation of theft incident. Multiple items reported missing. CCTV footage available.',
    priority: 'medium',
  },
  {
    id: 5,
    case_number: 'CASE-2026-005',
    case_type: 'accident',
    status: 'completed',
    assigned_date: '2026-01-05T08:30:00Z',
    due_date: '2026-01-15T23:59:59Z',
    location: 'Industrial Site, Warehouse B',
    description: 'Workplace accident investigation completed. Minor injury, equipment malfunction identified.',
    priority: 'low',
  },
];

export const DEMO_STATISTICS: CaseStatistics = {
  new_cases: 1,
  in_progress: 2,
  completed: 1,
  pending_submissions: 1,
};

export const DEMO_PHOTOS: Photo[] = [
  {
    id: 1,
    uri: 'https://via.placeholder.com/400x300/4267B2/FFFFFF?text=Front+View',
    fileName: 'front_view.jpg',
    type: 'image/jpeg',
    latitude: 40.7128,
    longitude: -74.0060,
    timestamp: '2026-01-15T10:45:00Z',
  },
  {
    id: 2,
    uri: 'https://via.placeholder.com/400x300/28a745/FFFFFF?text=Side+View',
    fileName: 'side_view.jpg',
    type: 'image/jpeg',
    latitude: 40.7128,
    longitude: -74.0060,
    timestamp: '2026-01-15T10:46:00Z',
  },
];

export const DEMO_INCIDENT_REPORT: IncidentReport = {
  case_id: 1,
  observation: 'Upon arrival at the scene, two vehicles were found with front-end damage. The collision occurred at the intersection of Main Street and 5th Avenue. Weather conditions were clear, road surface was dry.',
  statement: 'Both drivers reported that they had green lights. Traffic camera footage has been requested for verification. No pedestrians were involved in the incident.',
  date_time: '2026-01-15T10:30:00Z',
  location: 'Downtown Plaza, Main Street',
  latitude: 40.7128,
  longitude: -74.0060,
};

// Helper function to get demo case by ID
export const getDemoCaseById = (id: number): Case | undefined => {
  return DEMO_CASES.find(c => c.id === id);
};

// Helper function to filter demo cases by status
export const getDemoCasesByStatus = (status?: string): Case[] => {
  if (!status) return DEMO_CASES;
  return DEMO_CASES.filter(c => c.status === status);
};
