'use client';

import React, { createContext, useContext } from 'react';

/* ─── Demo user identity for data persistence (uid only) ─── */
const DEMO_UID = 'demo-user-genflow';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AuthUser;
  loading: false;
}

const demoUser: AuthUser = {
  uid: DEMO_UID,
  email: null,
  displayName: null,
  photoURL: null,
};

const AuthContext = createContext<AuthContextType>({
  user: demoUser,
  loading: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: demoUser, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
