import { createContext, useContext, useEffect, useState } from "react";
import { ApiError, apiRequest } from "../api/apiClient.js";

const AuthContext = createContext(null);

function normalizeRole(role) {
  if (!role) {
    return null;
  }

  if (typeof role === "string") {
    return role;
  }

  return role.name ?? role.code ?? null;
}

function normalizeUser(payload) {
  const userCandidate =
    payload?.user ??
    payload?.data?.user ??
    payload?.session?.user ??
    null;

  if (!userCandidate) {
    return null;
  }

  return {
    ...userCandidate,
    role: normalizeRole(userCandidate.role)
  };
}

async function fetchSessionUser() {
  try {
    const payload = await apiRequest("/auth/session");

    if (payload?.authenticated === false) {
      return null;
    }

    return normalizeUser(payload);
  } catch (error) {
    if (error instanceof ApiError && [401, 404].includes(error.status)) {
      return null;
    }

    throw error;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const refreshSession = async () => {
    setStatus("loading");
    setError("");

    try {
      const nextUser = await fetchSessionUser();
      setUser(nextUser);
      setStatus("ready");
      return nextUser;
    } catch (requestError) {
      setUser(null);
      setError(requestError.message);
      setStatus("ready");
      return null;
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (credentials) => {
    setError("");
    await apiRequest("/auth/login", {
      method: "POST",
      body: credentials
    });

    return refreshSession();
  };

  const register = async (payload) => {
    setError("");
    await apiRequest("/auth/register", {
      method: "POST",
      body: payload
    });

    return refreshSession();
  };

  const logout = async () => {
    setError("");
    await apiRequest("/auth/logout", {
      method: "POST"
    });
    setUser(null);
  };

  const value = {
    user,
    role: user?.role ?? null,
    isAuthenticated: Boolean(user),
    isLoading: status === "loading",
    error,
    login,
    register,
    logout,
    refreshSession,
    clearError: () => setError("")
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
