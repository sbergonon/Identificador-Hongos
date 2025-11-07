import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

interface ApiKeyContextState {
  userApiKey: string | null;
  effectiveApiKey: string | null;
  isUserProvided: boolean;
  saveApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextState | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userApiKey, setUserApiKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('userApiKey');
      if (storedKey) {
        setUserApiKey(storedKey);
      }
    } catch (e) {
      console.error("Failed to read userApiKey from localStorage", e);
    }
  }, []);

  const saveApiKey = (key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      localStorage.setItem('userApiKey', trimmedKey);
      setUserApiKey(trimmedKey);
    }
  };

  const clearApiKey = () => {
    localStorage.removeItem('userApiKey');
    setUserApiKey(null);
  };
  
  // Accede de forma segura a process.env para evitar el error "process is not defined" en algunos entornos.
  const fallbackApiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : null;
  const effectiveApiKey = userApiKey || fallbackApiKey;

  const value: ApiKeyContextState = {
    userApiKey,
    effectiveApiKey,
    isUserProvided: !!userApiKey,
    saveApiKey,
    clearApiKey,
  };

  return (
    <ApiKeyContext.Provider value={value}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = (): ApiKeyContextState => {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};