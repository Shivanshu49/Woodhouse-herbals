import type { AdminRole } from '@/types/api';

export interface StoreProfile {
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  state: string | null;
  stateCode: string | null;
  shippingGstRate: number;
}

export type StoreProfilePatch = Partial<Omit<StoreProfile, 'stateCode'>>;

export interface IntegrationsStatus {
  cloudinary: boolean;
  r2: boolean;
  phonepe: boolean;
  email: boolean;
}

export type StaffRole = AdminRole;

export interface StaffUser {
  id: string;
  email: string | null;
  fullName: string;
  role: AdminRole;
  deletedAt: string | null;
  createdAt: string;
}

export interface CreateStaffBody {
  email: string;
  fullName: string;
  role: StaffRole;
}
export interface CreateStaffResult {
  id: string;
  email: string | null;
  fullName: string;
  role: AdminRole;
  active: boolean;
  inviteUrl: string;
}
export interface UpdateStaffBody {
  role?: StaffRole;
  active?: boolean;
}
