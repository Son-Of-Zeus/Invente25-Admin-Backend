import React, { createContext, useContext, useState } from "react";
import { createApi } from "../api/api";
import axios from "axios";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
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
    const payload = JSON.parse(atob(t.split(".")[1]));
    
    const newUser = {
      email: payload.email,
      role: payload.role,
      department_id: payload.department_id,
      assigned_by: payload.assigned_by || null,
      event_id: payload.event_id || null,
    };

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

  const authAxios = createApi(token);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, authAxios }}>
      {children}
    </AuthContext.Provider>
  );
}