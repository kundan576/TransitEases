import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User, getRoleMismatchMessage } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, pass: string, expectedRole?: 'passenger' | 'driver' | 'admin') => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (data: any) => Promise<{ success: boolean; error?: string; message?: string; user?: User }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateLanguage: (lang: 'en' | 'hi') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('transitease_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('transitease_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active request sequence counter to prevent delayed /api/auth/me responses from overwriting a newer session
  const activeRequestIdRef = useRef<number>(0);
  const currentTokenRef = useRef<string | null>(token);

  useEffect(() => {
    currentTokenRef.current = token;
  }, [token]);

  const refreshProfile = useCallback(async (forcedToken?: string) => {
    const tokenToValidate = forcedToken !== undefined ? forcedToken : (currentTokenRef.current || localStorage.getItem('transitease_token'));

    if (!tokenToValidate) {
      setUser(null);
      setToken(null);
      currentTokenRef.current = null;
      localStorage.removeItem('transitease_token');
      localStorage.removeItem('transitease_user');
      setIsLoading(false);
      return;
    }

    const requestId = ++activeRequestIdRef.current;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${tokenToValidate}` },
        cache: 'no-store'
      });

      // Discard response if a newer authentication action occurred while this request was in flight
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (requestId === activeRequestIdRef.current) {
          setUser(data.user);
          setToken(tokenToValidate);
          currentTokenRef.current = tokenToValidate;
          localStorage.setItem('transitease_token', tokenToValidate);
          localStorage.setItem('transitease_user', JSON.stringify(data.user));
        }
      } else {
        // Token is invalid, expired, or user not found
        if (requestId === activeRequestIdRef.current) {
          localStorage.removeItem('transitease_token');
          localStorage.removeItem('transitease_user');
          currentTokenRef.current = null;
          setToken(null);
          setUser(null);
        }
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // On application startup, validate existing token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('transitease_token');
    if (savedToken) {
      refreshProfile(savedToken);
    } else {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  const login = async (identifier: string, pass: string, expectedRole?: 'passenger' | 'driver' | 'admin') => {
    // Invalidate any older in-flight /api/auth/me requests immediately
    const requestId = ++activeRequestIdRef.current;

    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass, expectedRole }),
        cache: 'no-store'
      });
    } catch (networkErr: any) {
      return { success: false, error: 'Network error connecting to transit server.' };
    }

    // Safely parse JSON without throwing on non-JSON bodies
    let data: any = null;
    try {
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }
    } catch (parseErr) {
      console.warn('Error reading response body:', parseErr);
    }

    if (!res.ok) {
      // Handle HTTP 401, HTTP 403, server errors, and network errors separately (Requirement 7)
      let errorMessage = data?.error;
      if (res.status === 403) {
        if (data?.actualRole) {
          errorMessage = getRoleMismatchMessage(data.actualRole, expectedRole);
        } else if (!errorMessage || typeof errorMessage !== 'string' || errorMessage.trim().startsWith('<')) {
          errorMessage = 'Access forbidden for this account type. Please sign in with the appropriate role.';
        }
      } else if (res.status === 401) {
        if (!errorMessage || typeof errorMessage !== 'string' || errorMessage.trim().startsWith('<')) {
          errorMessage = 'Invalid mobile number or password.';
        }
      } else if (res.status >= 500) {
        errorMessage = 'Transit server encountered an internal error. Please try again later.';
      } else {
        if (!errorMessage || typeof errorMessage !== 'string' || errorMessage.trim().startsWith('<')) {
          errorMessage = `Login failed (HTTP status ${res.status}).`;
        }
      }
      return { success: false, error: errorMessage };
    }

    if (requestId !== activeRequestIdRef.current) {
      return { success: false, error: 'Authentication action superseded.' };
    }

    // Double-check role matching client-side against backend-verified role (Requirements 2, 3, 4, 8)
    if (expectedRole && data?.user?.role !== expectedRole) {
      return {
        success: false,
        error: getRoleMismatchMessage(data?.user?.role || 'different', expectedRole)
      };
    }

    if (!data?.token || !data?.user) {
      return { success: false, error: 'Invalid authentication response received from server.' };
    }

    // Synchronously update persistent token, memory token, and user state together
    localStorage.setItem('transitease_token', data.token);
    localStorage.setItem('transitease_user', JSON.stringify(data.user));
    currentTokenRef.current = data.token;
    setToken(data.token);
    setUser(data.user);
    setIsLoading(false);

    return { success: true, user: data.user };
  };

  const register = async (formData: any) => {
    const requestId = ++activeRequestIdRef.current;

    let res: Response;
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        cache: 'no-store'
      });
    } catch (networkErr: any) {
      return { success: false, error: 'Network error connecting to transit server.' };
    }

    let data: any = null;
    try {
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }
    } catch (parseErr) {
      console.warn('Error reading register response body:', parseErr);
    }

    if (!res.ok) {
      return { success: false, error: data?.error || 'Registration failed.' };
    }

    if (requestId !== activeRequestIdRef.current) {
      return { success: false, error: 'Registration action superseded.' };
    }

    if (!data?.token || !data?.user) {
      return { success: false, error: 'Invalid registration response from server.' };
    }

    localStorage.setItem('transitease_token', data.token);
    localStorage.setItem('transitease_user', JSON.stringify(data.user));
    currentTokenRef.current = data.token;
    setToken(data.token);
    setUser(data.user);
    setIsLoading(false);

    return { success: true, message: data.message, user: data.user };
  };

  const logout = () => {
    // Invalidate any active requests immediately
    activeRequestIdRef.current++;
    localStorage.removeItem('transitease_token');
    localStorage.removeItem('transitease_user');
    currentTokenRef.current = null;
    setToken(null);
    setUser(null);
    setIsLoading(false);
  };

  const updateLanguage = async (lang: 'en' | 'hi') => {
    if (token) {
      try {
        await fetch('/api/auth/language', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ language: lang })
        });
      } catch (err) {
        console.error('Failed to update language on server:', err);
      }
    }
    if (user) {
      const updatedUser = { ...user, language: lang };
      setUser(updatedUser);
      localStorage.setItem('transitease_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        updateLanguage
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
