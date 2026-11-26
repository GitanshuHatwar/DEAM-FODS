import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiClientError, registerAuthHandlers } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { getSupabaseClient, isMockMode } from "@/lib/supabase";
import {
  getMockCurrentUser,
  getMockDb,
  resetMockDb,
  saveMockDb,
  setMockCurrentUserId,
} from "@/lib/mocks/mockDb";
import type { Role, UserProfile } from "@/types/auth";

export interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isDeactivated: boolean;
  authError: string | null;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signupCustomer: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  quickLoginAs: (userId: string) => Promise<void>;
  resetDemoWorkspace: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function getHomeRouteForRole(role: Role): string {
  switch (role) {
    case "customer":
      return "/portal";
    case "technician":
      return "/tech";
    case "admin":
      return "/admin";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeactivated, setIsDeactivated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const hydrateProfile = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const profile = await api.auth.me();
      if (!profile.is_active) {
        setUser(profile);
        setIsDeactivated(true);
      } else {
        setUser(profile);
        setIsDeactivated(false);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "inactive_user") {
          setUser(null);
          setIsDeactivated(true);
        } else if (err.status === 401) {
          setUser(null);
          setIsDeactivated(false);
        } else {
          setAuthError(err.message);
        }
      } else {
        setAuthError("Unable to verify session.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (isMockMode) {
      setMockCurrentUserId(null);
    } else {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsDeactivated(false);
    setAuthError(null);
    queryClient.clear();
  }, []);

  useEffect(() => {
    registerAuthHandlers({
      onUnauthorized: () => {
        setUser(null);
        setIsDeactivated(false);
        queryClient.clear();
      },
      onDeactivated: () => {
        setIsDeactivated(true);
      },
    });
  }, []);

  useEffect(() => {
    if (isMockMode) {
      const current = getMockCurrentUser();
      if (!current) {
        setUser(null);
        setIsDeactivated(false);
        setIsLoading(false);
      } else if (!current.is_active) {
        setUser(current);
        setIsDeactivated(true);
        setIsLoading(false);
      } else {
        setUser(current);
        setIsDeactivated(false);
        setIsLoading(false);
      }
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        void hydrateProfile();
      } else {
        setUser(null);
        setIsDeactivated(false);
        setIsLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        if (session) {
          void hydrateProfile();
        } else {
          setUser(null);
          setIsDeactivated(false);
          setIsLoading(false);
          queryClient.clear();
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateProfile]);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      if (isMockMode) {
        const db = getMockDb();
        const normalizedEmail = email.trim().toLowerCase();
        const found = db.users.find(
          (u) => u.email.toLowerCase() === normalizedEmail,
        );
        if (!found || !password.trim()) {
          throw new Error(
            "Invalid credentials. Try a seeded demo email or use Quick Demo Access below.",
          );
        }
        queryClient.clear();
        setMockCurrentUserId(found.id);
        if (!found.is_active) {
          setUser(found);
          setIsDeactivated(true);
        } else {
          setUser(found);
          setIsDeactivated(false);
        }
        return;
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        throw new Error(error.message);
      }
      queryClient.clear();
      await hydrateProfile();
    },
    [hydrateProfile],
  );

  const signupCustomer = useCallback(
    async (fullName: string, email: string, password: string) => {
      setAuthError(null);
      if (isMockMode) {
        const db = getMockDb();
        const normalizedEmail = email.trim().toLowerCase();
        if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
          throw new Error("An account with this email already exists.");
        }
        const created: UserProfile = {
          id: `user-${Date.now()}`,
          email: normalizedEmail,
          full_name: fullName.trim(),
          role: "customer",
          is_active: true,
          created_at: new Date().toISOString(),
        };
        db.users.unshift(created);
        saveMockDb(db);
        queryClient.clear();
        setMockCurrentUserId(created.id);
        setUser(created);
        setIsDeactivated(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });
      if (error) {
        throw new Error(error.message);
      }
      queryClient.clear();
      await hydrateProfile();
    },
    [hydrateProfile],
  );

  const quickLoginAs = useCallback(async (userId: string) => {
    if (!isMockMode) return;
    const db = getMockDb();
    const found = db.users.find((u) => u.id === userId);
    if (!found) return;
    queryClient.clear();
    setMockCurrentUserId(found.id);
    setUser(found);
    setIsDeactivated(!found.is_active);
    setAuthError(null);
  }, []);

  const resetDemoWorkspace = useCallback(() => {
    if (!isMockMode) return;
    resetMockDb();
    queryClient.clear();
    const current = getMockCurrentUser();
    if (current) {
      const fresh = getMockDb().users.find((u) => u.id === current.id) ?? null;
      if (fresh) {
        setUser(fresh);
        setIsDeactivated(!fresh.is_active);
      } else {
        setMockCurrentUserId(null);
        setUser(null);
        setIsDeactivated(false);
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isDeactivated,
        authError,
        loginWithPassword,
        signupCustomer,
        quickLoginAs,
        resetDemoWorkspace,
        logout,
        refreshProfile: hydrateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
