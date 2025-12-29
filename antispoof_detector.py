import torch 
import torch.nn as nn
import cv2
import numpy as np
from PIL import Image
from torchvision import transforms

class BasicBlock(nn.Module):
    expansion = 1

    def __init__(self, in_planes, planes, stride=1, downsample=None):
        super(BasicBlock, self).__init__()
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=3, stride=stride,
                               padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=1,
                               padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)
        self.downsample = downsample

    def forward(self, x):
        identity = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)
        out = self.bn2(out)

        if self.downsample is not None:
            identity = self.downsample(x)

        out += identity
        out = self.relu(out)

        return out

class ResNet18_Custom(nn.Module):
    def __init__(self, block=BasicBlock, layers=[2,2,2,2], num_classes=3):
        super(ResNet18_Custom, self).__init__()
        self.in_planes = 64
        # initial conv
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3,
                               bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        # layers
        self.layer1 = self._make_layer(block, 64, layers[0], stride=1)
        self.layer2 = self._make_layer(block, 128, layers[1], stride=2)
        self.layer3 = self._make_layer(block, 256, layers[2], stride=2)
        self.layer4 = self._make_layer(block, 512, layers[3], stride=2)

        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(512 * block.expansion, num_classes)

        # init weights
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, (nn.BatchNorm2d, nn.GroupNorm)):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def _make_layer(self, block, planes, blocks, stride=1):
        downsample = None
        if stride != 1 or self.in_planes != planes * block.expansion:
            downsample = nn.Sequential(
                nn.Conv2d(self.in_planes, planes * block.expansion,
                          kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * block.expansion),
            )

        layers = []
        layers.append(block(self.in_planes, planes, stride, downsample))
        self.in_planes = planes * block.expansion
        for _ in range(1, blocks):
            layers.append(block(self.in_planes, planes))

        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)   # [B,64,H/2,W/2]
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x) # [B,64,H/4,W/4]

        x = self.layer1(x)  # [B,64,...]
        x = self.layer2(x)  # [B,128,...]
        x = self.layer3(x)  # [B,256,...]
        x = self.layer4(x)  # [B,512,...]

        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.fc(x)

        return x


# ==========================================
# DETECTOR ANTI-SPOOFING
# ==========================================
class AntiSpoofDetector:
    """
    Detector de fraude usando ResNet18 Custom para identificar si un rostro es real o falso.
    Detecta ataques de spoofing como fotos impresas, pantallas de celular, máscaras, etc.
    """
    
    def __init__(self, model_path, debug_mode=False):
        """
        Inicializa el detector de anti-spoofing.
        
        Args:
            model_path (str): Ruta al archivo del modelo PyTorch (ej: "final_resnet18_custom.pth")
            debug_mode (bool): Si True, guarda imágenes de debug para análisis
        """
        print(f"🛡️ Cargando Anti-Spoofing ResNet18: {model_path}...")
        
        self.debug_mode = debug_mode
        self.debug_counter = 0
        
        if self.debug_mode:
            import os
            self.debug_dir = "debug_antispoof"
            os.makedirs(self.debug_dir, exist_ok=True)
            print(f"   🐛 Modo DEBUG activado: {self.debug_dir}/")
        
        # Detectar dispositivo (GPU si está disponible)
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        print(f"   Dispositivo: {self.device}")
        
        try:
            # Cargar modelo
            self.model = ResNet18_Custom(num_classes=3)
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            self.model.to(self.device)
            self.model.eval()
            
            # Transforms para preprocesamiento (igual que en entrenamiento)
            # NOTA: NO usar ToPILImage() porque puede malinterpretar canales
            # Usamos Resize de PIL directamente después de convertir manualmente
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
            
            # Mapeo de clases
            self.class_names = ['live', 'print', 'replay']
            
            self.loaded = True
            print(f"   ✅ Modelo cargado correctamente")
            
        except Exception as e:
            print(f"⚠️ ERROR CARGANDO MODELO: {e}")
            print("   -> El sistema funcionará sin protección de fraude.")
            self.loaded = False

    def predecir(self, frame, bbox):
        """
        Predice si un rostro es real o falso.
        
        Args:
            frame: Frame completo de la cámara (BGR)
            bbox: Tupla (x, y, w, h) con las coordenadas del rostro
            
        Returns:
            tuple: (score_realidad, etiqueta)
                - score_realidad: float de 0.0 a 1.0 (1.0 = muy real)
                - etiqueta: "REAL", "FAKE", "Disabled" o "Error"
        """
        # Si el modelo no se cargó, bypass
        if not self.loaded: 
            return 1.0, "Disabled"

        x, y, w, h = bbox
        
        # 1. Expandir el Bounding Box
        # El modelo necesita ver contexto alrededor del rostro
        scale = 2.7
        center_x, center_y = x + w/2, y + h/2
        new_w, new_h = w * scale, h * scale
        new_x = int(center_x - new_w/2)
        new_y = int(center_y - new_h/2)
        new_w = int(new_w)
        new_h = int(new_h)

        img_h_orig, img_w_orig = frame.shape[:2]
        
        # Validar límites (con padding si es necesario)
        if new_x < 0 or new_y < 0 or (new_x+new_w) > img_w_orig or (new_y+new_h) > img_h_orig:
            # Si estamos cerca del borde, ajustar sin expandir tanto
            new_x = max(0, new_x)
            new_y = max(0, new_y)
            new_w = min(img_w_orig - new_x, new_w)
            new_h = min(img_h_orig - new_y, new_h)
            
            if new_w <= 10 or new_h <= 10:
                return 0.5, "Borde"

        face_roi = frame[new_y:new_y+new_h, new_x:new_x+new_w]
        
        # Validación extra
        if face_roi.size == 0: 
            return 0.0, "Error"

        try:
            # === CONVERSIÓN CRÍTICA: BGR (OpenCV) → RGB (PyTorch) ===
            face_roi_rgb = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
            
            # Convertir numpy array a PIL Image manualmente para evitar ambigüedades
            face_pil = Image.fromarray(face_roi_rgb)  # Ahora PIL sabe que es RGB
            
            # DEBUG: Guardar imagen pre-procesada
            if self.debug_mode and self.debug_counter % 50 == 0:  # Cada 50 frames
                debug_path = f"{self.debug_dir}/frame_{self.debug_counter:04d}.jpg"
                face_pil.save(debug_path)
                print(f"   💾 Debug image saved: {debug_path}")
            self.debug_counter += 1
            
            # Aplicar transformaciones
            img_tensor = self.transform(face_pil)
            img_tensor = img_tensor.unsqueeze(0).to(self.device)
            
            # Inferencia
            with torch.no_grad():
                outputs = self.model(img_tensor)
                probabilities = torch.nn.functional.softmax(outputs, dim=1)
                probs = probabilities[0].cpu().numpy()
            
            # === INTERPRETACIÓN DE RESULTADOS ===
            # Clase 0: live (REAL)
            # Clase 1: print (FAKE - foto impresa)
            # Clase 2: replay (FAKE - pantalla/video)
            score_live = float(probs[0])
            score_print = float(probs[1])
            score_replay = float(probs[2])
            
            # DEBUG: Imprimir scores para diagnóstico
            print(f"   🔍 Scores: Live={score_live:.3f} | Print={score_print:.3f} | Replay={score_replay:.3f}")
            
            # Score real es la probabilidad de "live"
            score_real = score_live
            
            # === ESTRATEGIA DE DECISIÓN MEJORADA ===
            # El modelo tiene 3 clases, pero "replay" puede confundirse con cámaras web reales
            # porque ambos son "video". Vamos a priorizar detectar PRINT attacks (fotos).
            
            # Si print es dominante → definitivamente FAKE
            if score_print > 0.40:  # Foto impresa clara
                label = "FAKE"
                print(f"   ❌ PRINT ATTACK detectado")
            # Si print es bajo Y (live es razonablemente alto O replay/live están competidos)
            elif score_print < 0.15 and score_live > 0.35:
                # Consideramos que es real si:
                # 1. NO es una foto impresa (print bajo)
                # 2. Live tiene al menos 35% (modelo no está seguro pero tampoco descarta)
                label = "REAL"
                print(f"   ✅ REAL (live dominante, print descartado)")
            # Si live y replay están muy competidos (diferencia < 15%)
            elif abs(score_live - score_replay) < 0.15 and score_print < 0.10:
                # Zona gris: no está claro, pero si print es bajo, damos beneficio de duda
                label = "REAL"
                print(f"   ⚠️ REAL (zona gris, beneficio de duda)")
            else:
                # Caso por defecto: si nada de lo anterior aplica
                label = "FAKE"
                print(f"   ❌ FAKE (criterios no cumplidos)")
            
            return score_real, label
            
        except Exception as e:
            print(f"⚠️ Error en predicción: {e}")
            return 0.0, "Error"