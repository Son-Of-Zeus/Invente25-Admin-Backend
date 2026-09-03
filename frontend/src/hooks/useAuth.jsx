import React, { createContext, useContext, useMemo, useState } from "react";
import { createApi } from "../api/api";
import axios from "axios";

const AuthContext = createContext(null);

function decodeJwtPayload(token) {
  try {
    const encodedPayload = token?.split(".")[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function userFromPayload(payload) {
  if (!payload) return null;
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  const primaryRole = payload.primary_role || payload.role || roles[0] || null;

  return {
    ...payload,
    email: payload.email || null,
    role: primaryRole,
    primary_role: payload.primary_role || null,
    roles,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    department_id: payload.department_id ?? null,
    department_ids: Array.isArray(payload.department_ids) ? payload.department_ids : [],
    event_id: payload.event_id ?? null,
    event_ids: Array.isArray(payload.event_ids) ? payload.event_ids : [],
  };
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const decodedUser = userFromPayload(decodeJwtPayload(localStorage.getItem("token")));
    if (decodedUser) return decodedUser;

    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        localStorage.removeItem("user");
      }
    }
    return null;
  });

  // REMOVED: The problematic useEffect that caused the race condition.
  // The logic is now handled directly in login() and logout().

  const login = async (email, password, profile = {}) => {
    const base = import.meta.env.VITE_API_BASE || "http://localhost:4000/organizers/api";
    const resp = await axios.post(
      `${base}/auth/login`,
      { email, password, ...profile }
    );
    const t = resp.data.token;
    const payload = decodeJwtPayload(t);
    const newUser = userFromPayload(payload);

    // FIX: Update localStorage immediately and synchronously BEFORE updating state.
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(newUser));

    setToken(t);
    setUser(newUser);
    
    return { token: t, user: payload };
  };

  const logout = () => {
    // FIX: Clear localStorage immediately and synchronously BEFORE updating state.
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setToken(null);
    setUser(null);
  };

  const authAxios = useMemo(() => createApi(token), [token]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, authAxios }}>
      {children}
    </AuthContext.Provider>
  );
}
