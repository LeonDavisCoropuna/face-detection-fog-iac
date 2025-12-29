import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, isConfigured } from '../firebase';
import { Employee } from '../types';

// CONFIGURACIÓN (Similar a tus os.environ de Python)
// Si el nombre del bucket es fijo para empleados, lo definimos aquí.
// Si viene dentro del documento de Firestore (como en tu JSON de alerta), lo sacamos del doc.
const EMPLOYEES_BUCKET = "sentinel-employees-8f90456"; 

export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Validación inicial (igual que verificas GMAIL_USER en Python)
    if (!isConfigured) {
      console.warn("Firebase no está configurado");
      setLoading(false);
      return;
    }

    // 2. Conectar a la fuente de datos (Equivalente a escuchar el Pub/Sub, pero persistente)
    const q = query(collection(db, 'employees'), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Employee[] = [];
      
      snapshot.forEach((doc) => {
        const empData = doc.data();
        
        // --- LOGICA TIPO NOTIFIER ---
        
        // En Python: name_full = alerta_json.get('imagen_full')
        // En React:  filename = empData.photoUrl
        const filename = empData.photoUrl;
        
        // En Python: bucket_name = alerta_json.get('bucket')
        // Aquí podemos sacarlo del documento si existe, o usar el default
        const bucketName = empData.bucket || EMPLOYEES_BUCKET;

        let finalUrl = '';

        if (filename) {
            // Lógica "Agresiva" similar a descargar_imagen:
            // No usamos SDK de Firebase, construimos la ruta directa a la infraestructura.
            // Esto asume que el objeto es público o tienes acceso por cookies/IAM.
            
            if (filename.startsWith('http')) {
                // Si ya es una URL completa, la respetamos
                finalUrl = filename;
            } else {
                // Construcción RAW: https://storage.googleapis.com/[BUCKET]/[FILE]
                finalUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
            }
        } else {
            finalUrl = 'https://via.placeholder.com/150?text=Sin+Foto';
        }

        data.push({ 
          id: doc.id, 
          ...empData,
          photoUrl: finalUrl // Esta URL se la daremos al <img src>
        } as Employee);
      });

      setEmployees(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { employees, loading };
};