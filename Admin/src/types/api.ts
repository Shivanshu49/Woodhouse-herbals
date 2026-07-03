/** Roles that may use the admin panel. CUSTOMER is rejected at login. */
export type AdminRole = 'ADMIN' | 'MANAGER' | 'STAFF';

/** Shape returned by GET /api/auth/me. */
export interface AdminMeResponse {
  id: string;
  email: string | null;
  role: AdminRole | 'CUSTOMER';
}

/** Shape returned by POST /api/auth/admin-login. */
export interface AdminLoginResponse {
  user: {
    id: string;
    email: string | null;
    fullName: string;
    role: AdminRole;
  };
}

/** The signed-in admin as the app models it (post role-gate). */
export interface AdminUser {
  id: string;
  email: string | null;
  role: AdminRole;
}
