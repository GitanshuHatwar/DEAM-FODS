export type Role = "customer" | "technician" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface SessionState {
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  isDeactivated: boolean;
  authError: string | null;
}
