
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, isConfigured } from '../firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginAsDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: User = {
  uid: 'demo-123',
  email: 'admin@demo.com',
  displayName: 'Demo Administrator',
  photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for persistent demo session
    const savedDemoUser = localStorage.getItem('sentinel_demo_user');
    if (savedDemoUser) {
      setUser(JSON.parse(savedDemoUser));
      setLoading(false);
      return;
    }

    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Admin User',
          photoURL: firebaseUser.photoURL || 'https://picsum.photos/seed/user/100/100',
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginAsDemo = () => {
    setUser(DEMO_USER);
    localStorage.setItem('sentinel_demo_user', JSON.stringify(DEMO_USER));
  };

  const signOut = async () => {
    if (localStorage.getItem('sentinel_demo_user')) {
      localStorage.removeItem('sentinel_demo_user');
      setUser(null);
    } else {
      await auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginAsDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
