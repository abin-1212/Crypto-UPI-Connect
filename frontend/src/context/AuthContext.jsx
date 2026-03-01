import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydration complete — mark as not loading
    setLoading(false);
  }, []);

  // Listen for storage changes (e.g. 401 interceptor clearing token)
  // so auth state stays in sync without a full page reload
  useEffect(() => {
    const handleStorage = () => {
      const currentToken = localStorage.getItem("token");
      const currentUser = localStorage.getItem("user");
      if (!currentToken && token) {
        // Token was removed externally (e.g. by 401 interceptor)
        setToken(null);
        setUser(null);
      } else if (currentToken !== token) {
        setToken(currentToken);
        setUser(currentUser ? JSON.parse(currentUser) : null);
      }
    };

    // Poll localStorage periodically to catch interceptor-driven removals
    const interval = setInterval(handleStorage, 1000);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, [token]);

  /* =====================
     LOGIN
  ===================== */
  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      const { token: newToken, user: userData } = res.data;

      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Login failed",
      };
    }
  };

  /* =====================
     REGISTER (FIXED)
  ===================== */
  const register = async (username, email, password) => {
    try {
      const res = await api.post("/auth/register", {
        name: username, // ✅ FIX: backend expects `name`
        email,
        password,
      });

      const { token: newToken, user: userData } = res.data;

      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Registration failed",
      };
    }
  };

  /* =====================
     LOGOUT
  ===================== */
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
