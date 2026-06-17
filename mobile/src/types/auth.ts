export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'owner' | 'tenant';
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
