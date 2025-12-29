
/**
 * ARCHIVO DE CONFIGURACIÓN MAESTRO - SENTINEL DASHBOARD
 * Sincronizado con la infraestructura Pulumi (GCP us-central1)
 */

export const CONFIG = {
  // Configuración de Firebase (Consola de Firebase -> Project Settings)
  firebase: {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890",
    measurementId: "G-XXXXXXXXXX" 
  },

  // Buckets de Google Cloud Storage (Nombres exactos de tu Pulumi/GCP)
  storage: {
    alertsBucket: "bucket-fotos-nuevas-36290e1",        // Pulumi: upload_bucket
    employeesBucket: "bucket-rostros-conocidos-8fb0fe3", // Pulumi: known_faces_bucket
    baseUrl: "https://storage.googleapis.com"
  },

  // Infraestructura de Backend (Cloud Run & Pub/Sub)
  infrastructure: {
    region: "us-central1",
    cloudRunUrl: "https://face-recognition-service-tu-hash.a.run.app",
    alertsTopic: "alertas-rostros-topic",
    imagesTopic: "imagenes-nuevas-topic"
  },

  // Ajustes de Marca y UI
  app: {
    name: "SENTINEL",
    companyName: "Central Plaza Headquarters",
    supportEmail: "support@sentinel-security.com",
    systemStatusUrl: "https://status.sentinel.com",
    monitoringZone: "CAM-04 (Main Entrance)",
    alertSoundUrl: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"
  }
};

/**
 * Helper para construir URLs de Google Cloud Storage
 * Soporta tanto nombres de archivo como rutas completas
 */
export const getGCSUrl = (bucket: string, path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path; 
  // Eliminar slash inicial si existe
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${CONFIG.storage.baseUrl}/${bucket}/${cleanPath}`;
};

export const isConfigLoaded = () => {
  return CONFIG.firebase.apiKey !== "TU_API_KEY_AQUI";
};
