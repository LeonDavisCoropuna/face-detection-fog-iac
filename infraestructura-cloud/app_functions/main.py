import functions_framework
from google.cloud import firestore
from google.cloud import storage
import face_recognition
import numpy as np
import os
import cv2
import json
from datetime import datetime
from google.cloud import pubsub_v1

# --- CONFIGURACIÓN ---
BUCKET_EMPLEADOS_NAME = os.environ.get("BUCKET_EMPLEADOS")
DB_NAME = os.environ.get("DB_NAME")
TOPIC_ID = os.environ.get("TOPIC_ID")
PROJECT_ID = os.environ.get("PROJECT_ID")
TOLERANCIA = 0.5

# Clientes
if DB_NAME:
    db = firestore.Client(database=DB_NAME)
else:
    db = firestore.Client()
storage_client = storage.Client()
publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID) if TOPIC_ID and PROJECT_ID else None

# Memoria Caché
known_face_encodings = []
known_face_names = []
base_datos_cargada = False

def cargar_base_datos_desde_bucket():
    global known_face_encodings, known_face_names, base_datos_cargada
    if base_datos_cargada: return

    print(f"--- [CLOUD] Cargando DB Empleados ---")
    bucket_empleados = storage_client.bucket(BUCKET_EMPLEADOS_NAME)
    blobs = list(bucket_empleados.list_blobs())

    for blob in blobs:
        if blob.name.lower().endswith(('.jpg', '.png', '.jpeg')):
            img_bytes = blob.download_as_bytes()
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            encodings = face_recognition.face_encodings(rgb_img)
            
            if len(encodings) > 0:
                known_face_encodings.append(encodings[0])
                name = os.path.splitext(os.path.basename(blob.name))[0]
                known_face_names.append(name)
    
    base_datos_cargada = True
    print(f"--- DB Lista: {len(known_face_names)} personas ---")

@functions_framework.cloud_event
def analizar_intruso(cloud_event):
    data = cloud_event.data
    bucket_incoming_name = data["bucket"]
    file_name = data["name"]
    
    # --- 1. FILTRO ANTI-BUCLE (CRÍTICO) ---
    # Solo procesamos si termina en _FULL.jpg.
    # Ignoramos _FACE.jpg original y cualquier _CROP generado.
    if not file_name.endswith("_FULL.jpg"):
        print(f"🚫 SKIPPED: {file_name} (Solo procesamos _FULL.jpg)")
        return "SKIPPED"

    print(f"🔔 PROCESANDO MAESTRO: {file_name}")

    cargar_base_datos_desde_bucket()

    # --- 2. Descargar Imagen FULL ---
    bucket_incoming = storage_client.bucket(bucket_incoming_name)
    blob_full = bucket_incoming.blob(file_name)
    
    img_bytes_full = blob_full.download_as_bytes()
    nparr_full = np.frombuffer(img_bytes_full, np.uint8)
    img_full = cv2.imdecode(nparr_full, cv2.IMREAD_COLOR)
    rgb_full = cv2.cvtColor(img_full, cv2.COLOR_BGR2RGB)

    # --- 3. Analizar Rostros ---
    print("🔍 Buscando rostros en la escena completa...")
    face_locations = face_recognition.face_locations(rgb_full)
    unknown_encodings = face_recognition.face_encodings(rgb_full, face_locations)
    
    personas_detectadas = []
    hay_intruso = False
    recortes_nombres = []
    
    if len(unknown_encodings) == 0:
        print("❌ No hay rostros.")
        # Opcional: Si quieres avisar que no hubo nadie, envía un mail diferente.
        # Por ahora no hacemos nada para no spamear.
        return "NO_FACES"

    print(f"👥 Rostros encontrados: {len(unknown_encodings)}")
    
    # --- 4. Procesar cada rostro y generar Recortes ---
    for idx, (unknown_encoding, face_location) in enumerate(zip(unknown_encodings, face_locations)):
        top, right, bottom, left = face_location
        
        # Recorte
        face_image = img_full[top:bottom, left:right]
        
        # NOMBRE SEGURO PARA EL RECORTE (Usamos _CROP para no activar triggers por error)
        # file_name original: evidencia_2025..._FULL.jpg
        base_name = file_name.replace("_FULL.jpg", "")
        crop_filename = f"{base_name}_CROP_{idx + 1}.jpg"
        
        # Subir recorte
        _, face_buffer = cv2.imencode('.jpg', face_image)
        bucket_incoming.blob(crop_filename).upload_from_string(face_buffer.tobytes(), content_type='image/jpeg')
        recortes_nombres.append(crop_filename)
        
        # Identificación
        nombre_detectado = "INTRUSO"
        if len(known_face_encodings) > 0:
            face_distances = face_recognition.face_distance(known_face_encodings, unknown_encoding)
            best_match_index = np.argmin(face_distances)
            if face_distances[best_match_index] < TOLERANCIA:
                nombre_detectado = known_face_names[best_match_index]
            else:
                hay_intruso = True
        else:
            hay_intruso = True # Si no hay DB, todos son intrusos
        
        personas_detectadas.append(nombre_detectado)

    # --- 5. Decisión y Notificación ---
    resultado_texto = ", ".join(personas_detectadas)
    estado_final = "INTRUSO" if hay_intruso else "AUTORIZADO"
    
    print(f"📊 Resultado: {estado_final} | Personas: {resultado_texto}")

    # Notificar SOLO si hay intrusos (o si quieres siempre, quita el if)
    if hay_intruso and topic_path:
        print("📢 Enviando alerta unificada a Pub/Sub...")
        
        mensaje = {
            "alerta": "INTRUSO DETECTADO",
            "bucket": bucket_incoming_name,
            "imagen_full": file_name,       # Enviamos la FULL que inició todo
            "recortes_caras": recortes_nombres, # Array de los recortes generados
            "persona_identificada": resultado_texto,
            "timestamp": str(datetime.now()),
            "nivel_amenaza": "ALTO"
        }
        
        data_bytes = json.dumps(mensaje).encode("utf-8")
        publisher.publish(topic_path, data_bytes)

    # Guardar LOG en Firestore
    db.collection("alertas").document(file_name).set({
        "timestamp": datetime.now(),
        "archivo": file_name,
        "estado": estado_final,
        "personas": personas_detectadas,
        "recortes": recortes_nombres
    })

    return "OK"