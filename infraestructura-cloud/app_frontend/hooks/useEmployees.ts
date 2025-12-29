
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, isConfigured } from '../firebase';
import { CONFIG, getGCSUrl } from '../config';
import { Employee } from '../types';

const MOCK_EMPLOYEES: Employee[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', phone: '+1 234 567 890', role: 'Security Manager', active: true, photoUrl: 'https://picsum.photos/seed/p1/150/150' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', phone: '+1 234 567 891', role: 'Technical Support', active: true, photoUrl: 'https://picsum.photos/seed/p2/150/150' },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', phone: '+1 234 567 892', role: 'Night Watch', active: false, photoUrl: 'https://picsum.photos/seed/p3/150/150' },
];

export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setEmployees(MOCK_EMPLOYEES);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Employee[] = [];
      snapshot.forEach((doc) => {
        const empData = doc.data();
        // Si el campo photoUrl es solo el nombre del archivo, construimos la URL del bucket
        const photoUrl = getGCSUrl(CONFIG.storage.employeesBucket, empData.photoUrl);
        
        data.push({ 
          id: doc.id, 
          ...empData,
          photoUrl 
        } as Employee);
      });
      setEmployees(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { employees, loading };
};
