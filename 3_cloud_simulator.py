import face_recognition
import os
import numpy as np

# --- CONFIGURACIÓN ---
CARPETA_BASE_DATOS = "empleados"
TOLERANCIA = 0.5  # 0.6 es estándar. 0.5 es más estricto (menos falsos positivos).

def cargar_base_datos():
    """
    Lee las fotos de la carpeta 'empleados' y las convierte en números (encodings).
    """
    known_face_encodings = []
    known_face_names = []

    print(f"--- [CLOUD] Cargando base de datos desde '{CARPETA_BASE_DATOS}' ---")
    
    # Recorrer archivos en la carpeta
    if not os.path.exists(CARPETA_BASE_DATOS):
        os.makedirs(CARPETA_BASE_DATOS)
        print(f"AVISO: Crea la carpeta {CARPETA_BASE_DATOS} y pon fotos ahí.")
        return [], []

    files = os.listdir(CARPETA_BASE_DATOS)
    
    for filename in files:
        if filename.endswith(".jpg") or filename.endswith(".png"):
            path = os.path.join(CARPETA_BASE_DATOS, filename)
            
            # 1. Cargar imagen
            image = face_recognition.load_image_file(path)
            
            # 2. Obtener encoding (mediciones faciales)
            # A veces no detecta cara en la foto de perfil, manejamos el error
            encodings = face_recognition.face_encodings(image)
            
            if len(encodings) > 0:
                known_face_encodings.append(encodings[0])
                # Usamos el nombre del archivo como nombre de la persona
                name = os.path.splitext(filename)[0] 
                known_face_names.append(name)
                print(f"  > Aprendido: {name}")
            else:
                print(f"  X Error: No se ve cara en {filename}")

    print(f"--- Total aprendidos: {len(known_face_names)} personas ---\n")
    return known_face_encodings, known_face_names

def procesar_intruso(ruta_imagen_intruso, known_encodings, known_names):
    """
    Recibe una foto capturada por el Fog Node y busca coincidencias.
    """
    print(f"Procesando: {ruta_imagen_intruso}")
    
    try:
        # Cargar la foto del "intruso"
        unknown_image = face_recognition.load_image_file(ruta_imagen_intruso)
        
        # Codificar la cara del intruso
        unknown_encodings = face_recognition.face_encodings(unknown_image)

        if len(unknown_encodings) == 0:
            print("  [CLOUD] Resultado: No se detectó rostro humano válido para analizar.")
            return

        # Tomamos la primera cara encontrada en la foto recortada
        unknown_encoding = unknown_encodings[0]

        # --- EL CORAZÓN DEL SISTEMA: COMPARACIÓN ---
        # face_distance devuelve un número: 0.0 es idéntico, 1.0 es muy diferente
        face_distances = face_recognition.face_distance(known_encodings, unknown_encoding)
        
        # Buscamos quién se parece más (el índice del valor más bajo)
        best_match_index = np.argmin(face_distances)
        
        # Verificamos si la distancia es menor a la tolerancia
        if face_distances[best_match_index] < TOLERANCIA:
            nombre = known_names[best_match_index]
            confianza = (1 - face_distances[best_match_index]) * 100
            print(f"  ✅ ACCESO AUTORIZADO: Es {nombre.upper()} ({confianza:.1f}%)")
        else:
            print(f"  🚨 ALERTA DE SEGURIDAD: Rostro DESCONOCIDO. Iniciar protocolo de intrusión.")
            
    except Exception as e:
        print(f"Error procesando imagen: {e}")

# --- BLOQUE DE PRUEBA ---
if __name__ == "__main__":
    # 1. Cargar Memoria
    bd_encodings, bd_nombres = cargar_base_datos()

    if not bd_encodings:
        print("No hay base de datos. Finalizando.")
        exit()

    # 2. Simulación de escucha
    # Aquí es donde conectaríamos con el Fog Node. 
    # Por ahora, analicemos la imagen que generaste en el paso anterior.
    
    # Busca la imagen más reciente que empiece con "evidencia_" y termine en "FACE.jpg"
    files = [f for f in os.listdir('.') if f.startswith("evidencia_") and f.endswith("FACE.jpg")]
    
    if files:
        # Ordenar por fecha para tomar la última
        files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        ultima_captura = files[0]
        
        print(f"🔎 Analizando última captura del Fog Node: {ultima_captura}")
        procesar_intruso(ultima_captura, bd_encodings, bd_nombres)
    else:
        print("No encontré archivos 'evidencia_..._FACE.jpg'. Ejecuta primero el Fog Node (Paso 2).")