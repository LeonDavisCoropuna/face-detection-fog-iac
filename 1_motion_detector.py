import cv2
import imutils
from ultralytics import YOLO
import time
import datetime

# --- CONFIGURACIÓN ---
VIDEO_PATH = 'http://192.168.0.11:8080/video' 
AREA_MINIMA = 4000
CONFIDENCIA_YOLO = 0.50
VAR_THRESHOLD = 100

# Tiempos
TIEMPO_RECOLECCION = 1.5   # Meta ideal
TIEMPO_PACIENCIA = 0.5     # ### NUEVO: Si dejo de ver la cara por 0.5s, guardo lo que tenga ###
TIEMPO_COOLDOWN = 5.0

# Variables de Estado
mejor_rostro_img = None
mejor_frame_completo = None
mejor_puntaje_nitidez = 0
tiempo_inicio_deteccion = None
tiempo_ultimo_avistamiento_cara = 0 # ### NUEVO: Para saber cuándo "perdimos" al sujeto ###
en_cooldown = False
tiempo_inicio_cooldown = 0

def calcular_nitidez(imagen):
    gray = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def guardar_evidencia(rostro, frame_completo, puntaje, motivo):
    """ Función auxiliar para guardar y resetear variables """
    if rostro is not None and frame_completo is not None:
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_face = f"evidencia_{ts}_FACE.jpg"
        nombre_full = f"evidencia_{ts}_FULL.jpg"

        print(f"\n>>> [GUARDADO - {motivo}] Nitidez: {puntaje:.2f}")
        print(f"    Archivo: {nombre_face}")
        
        cv2.imwrite(nombre_face, rostro)
        cv2.imwrite(nombre_full, frame_completo)
        # upload_to_gcp(...)
        return True
    return False

# Cargar modelos
print("Cargando IA...")
model = YOLO('yolov8n.pt')
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

cap = cv2.VideoCapture(VIDEO_PATH)
fgbg = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=VAR_THRESHOLD, detectShadows=True)

print("--- SENTINEL: MODO FAIL-SAFE ACTIVO ---")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Reconectando...")
        time.sleep(2)
        cap = cv2.VideoCapture(VIDEO_PATH)
        continue

    frame = imutils.resize(frame, width=640)
    blurred = cv2.GaussianBlur(frame, (21, 21), 0)

    # LÓGICA DE COOLDOWN
    if en_cooldown:
        tiempo_restante = TIEMPO_COOLDOWN - (time.time() - tiempo_inicio_cooldown)
        cv2.putText(frame, f"COOLDOWN: {tiempo_restante:.1f}s", (10, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        if tiempo_restante <= 0:
            en_cooldown = False
            mejor_rostro_img = None
            mejor_frame_completo = None
            mejor_puntaje_nitidez = 0
            tiempo_inicio_deteccion = None # Reset total
            print("Sistema listo.")
        
        cv2.imshow('Sentinel Fog Node', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break
        continue

    # 1. DETECCIÓN DE MOVIMIENTO
    fgmask = fgbg.apply(blurred)
    _, mask_limpia = cv2.threshold(fgmask, 250, 255, cv2.THRESH_BINARY)
    mask_limpia = cv2.dilate(mask_limpia, None, iterations=2)
    contours, _ = cv2.findContours(mask_limpia, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    hay_movimiento = False
    for cnt in contours:
        if cv2.contourArea(cnt) > AREA_MINIMA:
            hay_movimiento = True
            break 

    cara_detectada_en_este_frame = False # Bandera local

    # 2. INFERENCIA YOLO
    if hay_movimiento:
        results = model(frame, stream=True, verbose=False)
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                if int(box.cls[0]) == 0 and box.conf[0] > CONFIDENCIA_YOLO:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 1)
                    
                    # 3. DETECCIÓN DE ROSTRO
                    roi_cuerpo = frame[y1:y2, x1:x2]
                    if roi_cuerpo.size == 0: continue
                    
                    gray_roi = cv2.cvtColor(roi_cuerpo, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray_roi, 1.1, 4)

                    for (fx, fy, fw, fh) in faces:
                        # ¡ENCONTRAMOS UNA CARA!
                        cara_detectada_en_este_frame = True
                        tiempo_ultimo_avistamiento_cara = time.time() # ### NUEVO: Actualizamos el reloj ###

                        rostro_x = x1 + fx
                        rostro_y = y1 + fy
                        rostro_img = frame[rostro_y:rostro_y+fh, rostro_x:rostro_x+fw]
                        
                        if tiempo_inicio_deteccion is None:
                            tiempo_inicio_deteccion = time.time()
                            print(">>> INICIANDO RASTREO...")

                        # Evaluar Nitidez
                        nitidez = calcular_nitidez(rostro_img)
                        if nitidez > mejor_puntaje_nitidez:
                            mejor_puntaje_nitidez = nitidez
                            mejor_rostro_img = rostro_img.copy()
                            mejor_frame_completo = frame.copy()
                            cv2.rectangle(frame, (rostro_x, rostro_y), (rostro_x+fw, rostro_y+fh), (0, 255, 0), 3)
                        else:
                             cv2.rectangle(frame, (rostro_x, rostro_y), (rostro_x+fw, rostro_y+fh), (0, 0, 255), 1)

    # --- LÓGICA DE DECISIÓN (EL CEREBRO DEL BUFFER) ---
    
    if tiempo_inicio_deteccion is not None:
        ahora = time.time()
        tiempo_pasado_total = ahora - tiempo_inicio_deteccion
        tiempo_sin_ver_cara = ahora - tiempo_ultimo_avistamiento_cara
        
        # Barra de progreso visual
        ancho_barra = int((tiempo_pasado_total / TIEMPO_RECOLECCION) * 200)
        cv2.rectangle(frame, (10, 10), (10 + ancho_barra, 30), (0, 255, 0), -1)

        # CASO 1: ÉXITO TOTAL (Se cumplió el tiempo de recolección)
        if tiempo_pasado_total > TIEMPO_RECOLECCION:
            if guardar_evidencia(mejor_rostro_img, mejor_frame_completo, mejor_puntaje_nitidez, "TIEMPO COMPLETO"):
                en_cooldown = True
                tiempo_inicio_cooldown = ahora
                tiempo_inicio_deteccion = None
            else:
                # Si pasó el tiempo pero no guardamos nada (raro), reseteamos
                tiempo_inicio_deteccion = None

        # CASO 2: EMERGENCIA (Perdimos al sujeto por más de 0.5s)
        # ### NUEVO BLOQUE ###
        elif tiempo_sin_ver_cara > TIEMPO_PACIENCIA and mejor_rostro_img is not None:
            cv2.putText(frame, "¡SUJETO PERDIDO! GUARDANDO...", (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            if guardar_evidencia(mejor_rostro_img, mejor_frame_completo, mejor_puntaje_nitidez, "EMERGENCIA"):
                en_cooldown = True
                tiempo_inicio_cooldown = ahora
                tiempo_inicio_deteccion = None
        
        # CASO 3: FALSO POSITIVO (Pasó tiempo y nunca tuvimos una buena imagen)
        elif tiempo_sin_ver_cara > TIEMPO_PACIENCIA and mejor_rostro_img is None:
            print(">>> Falso positivo o pérdida total. Reseteando.")
            tiempo_inicio_deteccion = None
            mejor_puntaje_nitidez = 0

    cv2.imshow('Sentinel Fog Node', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()