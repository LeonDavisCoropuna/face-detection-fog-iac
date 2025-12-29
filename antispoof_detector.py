import cv2
import numpy as np
import onnxruntime as ort # <--- AGREGAR ESTO AL INICIO CON TUS IMPORTS

class AntiSpoofDetector:
    def __init__(self, model_path):
        print(f"🛡️ Cargando Anti-Spoofing (ORT): {model_path}...")
        try:
            # Usamos ONNX Runtime en lugar de OpenCV DNN
            self.session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
            
            # Obtener nombres de entrada y salida dinámicamente
            self.input_name = self.session.get_inputs()[0].name
            self.input_shape = self.session.get_inputs()[0].shape
            
            # Detectar tamaño esperado (usualmente 80x80)
            # shape suele ser [batch, canal, alto, ancho] -> [0, 1, 2, 3]
            self.img_h = self.input_shape[2] 
            self.img_w = self.input_shape[3]
            
            self.loaded = True
            print(f"   ✅ Modelo cargado. Input esperado: {self.img_w}x{self.img_h}")
        except Exception as e:
            print(f"⚠️ ERROR CRÍTICO CARGANDO MODELO: {e}")
            print("   -> El sistema funcionará sin protección de fraude.")
            self.loaded = False

    def predecir(self, frame, bbox):
        """
        Retorna: (score_realidad, etiqueta)
        """
        if not self.loaded: return 1.0, "Disabled"

        x, y, w, h = bbox
        
        # 1. Expandir Bounding Box (Scale 2.7x)
        scale = 2.7
        center_x, center_y = x + w/2, y + h/2
        new_w, new_h = w * scale, h * scale
        new_x = int(center_x - new_w/2)
        new_y = int(center_y - new_h/2)

        img_h_orig, img_w_orig = frame.shape[:2]
        new_x = max(0, new_x)
        new_y = max(0, new_y)
        new_w = min(img_w_orig - new_x, int(new_w))
        new_h = min(img_h_orig - new_y, int(new_h))

        if new_w <= 0 or new_h <= 0: return 0.0, "Error"

        face_roi = frame[new_y:new_y+new_h, new_x:new_x+new_w]

        # 2. Preprocesamiento manual (OpenCV DNN lo hacía automático, aquí no)
        try:
            # Resize al tamaño que pide el modelo (80x80)
            resized = cv2.resize(face_roi, (self.img_w, self.img_h))
            
            # Convertir a float32 y normalizar a [0, 1]
            img_data = resized.astype(np.float32) / 255.0
            
            # Transponer de (Alto, Ancho, Canales) a (Canales, Alto, Ancho) -> Formato PyTorch/ONNX
            img_data = np.transpose(img_data, (2, 0, 1))
            
            # Agregar dimensión de batch: (1, 3, 80, 80)
            img_data = np.expand_dims(img_data, axis=0)

            # 3. Inferencia
            inputs = {self.input_name: img_data}
            preds = self.session.run(None, inputs)[0] # Retorna lista, tomamos el primero
            
            # 4. Softmax
            preds = np.array(preds).flatten()
            probs = np.exp(preds) / np.sum(np.exp(preds))
            
            # INDICE: En MiniFASNet, usualmente [0]=Spoof, [1]=Real
            # Verificar esto probando. Si sale invertido, cambia a probs[0]
            score_real = probs[1] 
            
            label = "REAL" if score_real > 0.70 else "FAKE"
            return score_real, label
            
        except Exception as e:
            print(f"Err pred: {e}")
            return 0.0, "Error"