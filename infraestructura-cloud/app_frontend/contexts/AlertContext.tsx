
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, limit } from 'firebase/firestore';
import { db, isConfigured } from '../firebase';
import { CONFIG, getGCSUrl } from '../config';
import { SecurityAlert } from '../types';

interface AlertContextType {
  alerts: SecurityAlert[];
  unreadCount: number;
  markAsReviewed: (alertId: string) => Promise<void>;
  simulateAlert: () => void;
  activePopup: SecurityAlert | null;
  dismissPopup: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

// Datos iniciales para modo demo
const MOCK_ALERTS_INITIAL: SecurityAlert[] = [
  {
    id: 'demo-1',
    status: 'UNKNOWN',
    matchedWith: null,
    distance: 0.85,
    imageUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=800',
    croppedFaceUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Stranger1',
    createdAt: { toDate: () => new Date(Date.now() - 7200000) },
    reviewed: true
  }
];

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activePopup, setActivePopup] = useState<SecurityAlert | null>(null);
  const lastAlertIdRef = useRef<string | null>(null);

  // Escuchador de cambios en la lista de alertas (Notificaciones)
  useEffect(() => {
    const unread = alerts.filter(a => !a.reviewed);
    setUnreadCount(unread.length);

    // LOGICA DE NOTIFICACIÓN: Si hay una alerta nueva no revisada
    if (alerts.length > 0) {
      const latestAlert = alerts[0];
      // Solo disparamos si es realmente nueva (evitar duplicados por re-renders)
      if (!latestAlert.reviewed && latestAlert.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = latestAlert.id;
        triggerNewAlertNotification(latestAlert);
      }
    }
  }, [alerts]);

  // SUSCRIPCIÓN EN TIEMPO REAL A FIRESTORE
  // Este es el puente con tu Pub/Sub -> Cloud Function -> Firestore
  useEffect(() => {
    if (!isConfigured) {
      setAlerts(MOCK_ALERTS_INITIAL);
      return;
    }

    // El Dashboard se "suscribe" a la colección donde tu pipeline de Pulumi escribe los resultados
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newAlerts: SecurityAlert[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Construimos las URLs usando el bucket 'bucket-fotos-nuevas-36290e1' definido en Pulumi
        const imageUrl = getGCSUrl(CONFIG.storage.alertsBucket, data.imageUrl);
        const croppedFaceUrl = getGCSUrl(CONFIG.storage.alertsBucket, data.croppedFaceUrl);

        newAlerts.push({ 
          id: doc.id, 
          ...data,
          imageUrl,
          croppedFaceUrl
        } as SecurityAlert);
      });
      setAlerts(newAlerts);
    }, (error) => {
      console.error("Error en la suscripción de alertas:", error);
    });

    return () => unsubscribe();
  }, []);

  const triggerNewAlertNotification = (alert: SecurityAlert) => {
    setActivePopup(alert);
    playAlertSound();
  };

  const playAlertSound = () => {
    const audio = new Audio(CONFIG.app.alertSoundUrl);
    audio.play().catch(e => console.log("Audio play blocked by browser policies"));
  };

  // Función para pruebas locales
  const simulateAlert = () => {
    const id = "sim-" + Math.random().toString(36).substr(2, 9);
    const isUnknown = Math.random() > 0.4;
    const newAlert: SecurityAlert = {
      id,
      status: isUnknown ? 'UNKNOWN' : 'MATCH',
      matchedWith: isUnknown ? null : 'Empleado de Prueba',
      distance: isUnknown ? 0.92 : 0.08,
      imageUrl: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&q=80&w=800',
      croppedFaceUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
      createdAt: { toDate: () => new Date() },
      reviewed: false
    };
    setAlerts(prev => [newAlert, ...prev]);
  };

  const dismissPopup = () => setActivePopup(null);

  const markAsReviewed = async (alertId: string) => {
    if (!isConfigured) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, reviewed: true } : a));
      return;
    }
    try {
      const alertRef = doc(db, 'alerts', alertId);
      await updateDoc(alertRef, { reviewed: true });
    } catch (e) {
      console.error("Error al actualizar alerta:", e);
    }
  };

  return (
    <AlertContext.Provider value={{ alerts, unreadCount, markAsReviewed, simulateAlert, activePopup, dismissPopup }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};
