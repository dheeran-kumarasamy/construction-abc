import { createContext, useContext, useState } from "react";
import type { ReactNode, JSX } from "react";
import { Navigate } from "react-router-dom";

// --- Types ---
export type Role = "architect" | "builder" | "client";

interface User {
  email: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, role: Role) => void;
  logout: () => void;
}

// --- Context ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Provider ---
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  function login(email: string, role: Role) {
    const newUser = { email, role };
    setUser(newUser);
    localStorage.setItem("auth_user", JSON.stringify(newUser));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("auth_user");
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Hook ---
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// --- Protected Route Component ---
export function RequireAuth({
  children,
  role,
}: {
  children: JSX.Element;
  role?: Role;
}) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
