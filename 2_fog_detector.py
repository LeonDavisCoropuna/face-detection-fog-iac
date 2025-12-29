import cv2
import imutils
from ultralytics import YOLO
import time
import datetime
import threading
from google.cloud import storage

VIDEO_PATH = 'http://192.168.0.16:8080/video'
BUCKET_NAME = "sentinel-incoming-images-8cb8e26"

VAR_THRESHOLD = 100
AREA_MINIMA = 4000
CONFIDENCIA_YOLO = 0.50
TIEMPO_RECOLECCION = 4.0  # Segundos que espera para buscar la mejor foto
TIEMPO_COOLDOWN = 5.0     # Segundos de descanso tras una detección

# --- 2. CONEXIÓN CON LA NUBE ---
print("🔌 Conectando con Google Cloud Storage...")
try:
    storage_client = storage.Client()
    bucket = storage_client.bucket(BUCKET_NAME)
    print(f"✅ Conectado al bucket: {BUCKET_NAME}")
except Exception as e:
    print(f"❌ Error de credenciales GCP: {e}")
    exit()

# --- 3. FUNCIONES AUXILIARES ---
def calcular_nitidez(imagen):
    """Calcula qué tan enfocada está una imagen usando varianza Laplaciana"""
    gray = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def subir_archivo_thread(nombre_archivo, imagen_cv2):
    """Función que corre en segundo plano para subir la foto"""
    try:
        print(f"   ☁️ Subiendo {nombre_archivo}...")
        # Convertir a bytes en memoria
        _, img_encoded = cv2.imencode('.jpg', imagen_cv2)
        contenido_bytes = img_encoded.tobytes()

        # Subir
        blob = bucket.blob(nombre_archivo)
        blob.upload_from_string(contenido_bytes, content_type='image/jpeg')
        print(f"   ✅ SUBIDA COMPLETADA: {nombre_archivo}")
    except Exception as e:
        print(f"   ❌ Error subiendo: {e}")

# --- 4. INICIALIZACIÓN DE MODELOS ---
print("🧠 Cargando Modelos de IA...")
model = YOLO('yolov8n.pt') # Detecta personas
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml') # Detecta caras
fgbg = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=VAR_THRESHOLD, detectShadows=True) # Detecta movimiento

cap = cv2.VideoCapture(VIDEO_PATH)

# Variables de Estado
mejor_rostro_img = None
mejor_frame_completo = None
mejor_puntaje_nitidez = 0
tiempo_inicio_deteccion = None
en_cooldown = False
tiempo_inicio_cooldown = 0

print(f"--- 👁️ SENTINEL FOG NODE ACTIVO 👁️ ---")

while True:
    ret, frame = cap.read()
    if not ret:
        print("⚠️ Error de cámara. Reconectando en 2s...")
        time.sleep(2)
        cap = cv2.VideoCapture(VIDEO_PATH)
        continue

    frame = imutils.resize(frame, width=640)
    blurred = cv2.GaussianBlur(frame, (21, 21), 0)

    # A) LÓGICA DE COOLDOWN (Descanso)
    if en_cooldown:
        tiempo_restante = TIEMPO_COOLDOWN - (time.time() - tiempo_inicio_cooldown)
        cv2.putText(frame, f"ENVIADO. REINICIANDO EN: {tiempo_restante:.1f}s", (10, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        
        if tiempo_restante <= 0:
            en_cooldown = False
            mejor_rostro_img = None
            mejor_frame_completo = None
            mejor_puntaje_nitidez = 0
            tiempo_inicio_deteccion = None
            print("🟢 Sistema listo para nueva detección.")
        
        cv2.imshow('Sentinel Fog Node', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break
        continue

    # B) DETECCIÓN DE MOVIMIENTO
    fgmask = fgbg.apply(blurred)
    _, mask_limpia = cv2.threshold(fgmask, 250, 255, cv2.THRESH_BINARY)
    mask_limpia = cv2.dilate(mask_limpia, None, iterations=2)
    contours, _ = cv2.findContours(mask_limpia, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    hay_movimiento = False
    for cnt in contours:
        if cv2.contourArea(cnt) > AREA_MINIMA:
            hay_movimiento = True
            break 

    # C) SI HAY MOVIMIENTO -> BUSCAR PERSONAS Y CARAS
    if hay_movimiento:
        results = model(frame, stream=True, verbose=False)
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                # Clase 0 es "Person" en COCO dataset
                if int(box.cls[0]) == 0 and box.conf[0] > CONFIDENCIA_YOLO:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 1) # Rectángulo azul (Cuerpo)
                    
                    # Recortar el cuerpo para buscar cara solo ahí (ahorra CPU)
                    roi_cuerpo = frame[y1:y2, x1:x2]
                    if roi_cuerpo.size == 0: continue
                    
                    gray_roi = cv2.cvtColor(roi_cuerpo, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray_roi, 1.1, 4)

                    for (fx, fy, fw, fh) in faces:
                        # Coordenadas globales de la cara
                        rostro_x = x1 + fx
                        rostro_y = y1 + fy
                        
                        # Recorte
                        rostro_img = frame[rostro_y:rostro_y+fh, rostro_x:rostro_x+fw]
                        
                        if tiempo_inicio_deteccion is None:
                            tiempo_inicio_deteccion = time.time()
                            print(">>> 📸 RASTREANDO ROSTRO (Buscando mejor toma)...")

                        # Calcular nitidez
                        nitidez = calcular_nitidez(rostro_img)
                        
                        # === SELECCIÓN DE MEJOR FOTO ===
                        if nitidez > mejor_puntaje_nitidez:
                            mejor_puntaje_nitidez = nitidez
                            mejor_rostro_img = rostro_img.copy()
                            mejor_frame_completo = frame.copy() 
                            # Verde grueso = Nuevo campeón
                            cv2.rectangle(frame, (rostro_x, rostro_y), (rostro_x+fw, rostro_y+fh), (0, 255, 0), 3)
                        else:
                            # Rojo fino = Peor que el actual campeón
                            cv2.rectangle(frame, (rostro_x, rostro_y), (rostro_x+fw, rostro_y+fh), (0, 0, 255), 1)

        # D) GESTIÓN DEL TIEMPO DE CAPTURA
        if tiempo_inicio_deteccion is not None:
            tiempo_pasado = time.time() - tiempo_inicio_deteccion
            
            # Barra de progreso visual
            ancho_barra = int((tiempo_pasado / TIEMPO_RECOLECCION) * 200)
            cv2.rectangle(frame, (10, 10), (10 + ancho_barra, 30), (0, 255, 0), -1)
            cv2.putText(frame, "ANALIZANDO...", (220, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            # --- MOMENTO DE LA VERDAD (Se acabó el tiempo) ---
            if tiempo_pasado > TIEMPO_RECOLECCION:
                if mejor_rostro_img is not None and mejor_frame_completo is not None:
                    
                    # 1. Preparar Nombres
                    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                    nombre_face = f"evidencia_{ts}_FACE.jpg"
                    nombre_full = f"evidencia_{ts}_FULL.jpg"

                    print(f"\n>>> [CAPTURA FINALIZADA] Nitidez: {mejor_puntaje_nitidez:.2f}")
                    
                    # 2. Guardar Localmente (Backup)
                    cv2.imwrite(nombre_face, mejor_rostro_img)
                    cv2.imwrite(nombre_full, mejor_frame_completo)
                    
                    # 3. SUBIR A GCP EN HILOS (Aquí está la corrección clave)
                    # Usamos threading para no trabar la cámara mientras sube a internet
                    t1 = threading.Thread(target=subir_archivo_thread, args=(nombre_face, mejor_rostro_img))
                    t2 = threading.Thread(target=subir_archivo_thread, args=(nombre_full, mejor_frame_completo))
                    t1.start()
                    t2.start()

                    # 4. Activar Cooldown
                    en_cooldown = True
                    tiempo_inicio_cooldown = time.time()
                    tiempo_inicio_deteccion = None # Reset
                
                else:
                    # Se acabó el tiempo y no conseguimos buena foto
                    print("Tiempo agotado sin foto clara. Reiniciando.")
                    tiempo_inicio_deteccion = None
                    mejor_puntaje_nitidez = 0

    else:
        # Si deja de haber movimiento por mucho tiempo (3s), cancelamos el rastreo actual
        if tiempo_inicio_deteccion is not None and (time.time() - tiempo_inicio_deteccion) > 3.0:
             print("Objetivo perdido. Reset.")
             tiempo_inicio_deteccion = None
             mejor_puntaje_nitidez = 0

    cv2.imshow('Sentinel Fog Node', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()