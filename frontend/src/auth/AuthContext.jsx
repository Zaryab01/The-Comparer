import { createContext, useContext, useState } from "react";

const TOKEN_KEY = "admin_token";
const USER_KEY  = "admin_username";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]       = useState(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY));

  function login(tok, user) {
    localStorage.setItem(TOKEN_KEY, tok);
    localStorage.setItem(USER_KEY, user);
    setToken(tok);
    setUsername(user);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUsername(null);
  }

  return (
    <AuthContext.Provider value={{ token, username, isAuthed: Boolean(token), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
