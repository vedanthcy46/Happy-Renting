export type UserRole = 'superadmin' | 'owner' | 'tenant';

// Which workspace is currently active in the app.
export type Workspace = 'tenant' | 'owner';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;       // primary role (legacy, kept for compat)
  roles: UserRole[];    // all roles this user has
  ownerId?: string;
  mustChangePassword?: boolean;
  emailVerified?: boolean;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface AuthError {
  success: boolean;
  message: string;
}
