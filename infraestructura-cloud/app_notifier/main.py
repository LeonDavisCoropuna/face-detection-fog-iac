import base64
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import functions_framework
from google.cloud import storage

# Configuración
GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_PASSWORD")
DESTINATARIO = os.environ.get("GMAIL_DESTINATARIO")

storage_client = storage.Client()

def descargar_imagen(bucket_obj, blob_name):
    """
    Descarga 'agresiva': Intenta descargar directamente.
    Esto evita falsos negativos de blob.exists() por latencia de Google Cloud.
    """
    if not blob_name:
        return None
    try:
        blob = bucket_obj.blob(blob_name)
        data = blob.download_as_bytes()
        print(f"   ✅ Descargada: {blob_name} ({len(data)} bytes)")
        return data
    except Exception as e:
        # Solo si falla la descarga real asumimos que no existe o hay error
        print(f"   ❌ Error crítico descargando {blob_name}: {e}")
        return None

@functions_framework.cloud_event
def enviar_alerta_email(cloud_event):
    # 1. Decodificar mensaje
    pubsub_data = base64.b64decode(cloud_event.data["message"]["data"]).decode("utf-8")
    alerta_json = json.loads(pubsub_data)
    
    bucket_name = alerta_json.get('bucket')
    
    # Nombres de archivos
    name_full = alerta_json.get('imagen_full')
    recortes_caras = alerta_json.get('recortes_caras', [])
    
    sujetos = alerta_json.get('persona_identificada') or "Desconocido"

    print(f"📧 INICIANDO ENVÍO. Sujetos: {sujetos}")
    print(f"   📂 Bucket: {bucket_name}")
    print(f"   🖼️ Full: {name_full}")
    print(f"   👤 Caras a descargar: {recortes_caras}")

    # 2. Descargar imágenes (Sin preguntar si existen, solo descargar)
    bucket = storage_client.bucket(bucket_name)
    
    data_full = descargar_imagen(bucket, name_full)
    
    caras_data = []
    for face_name in recortes_caras:
        face_bytes = descargar_imagen(bucket, face_name)
        if face_bytes:
            caras_data.append((face_name, face_bytes))
        else:
            print(f"   ⚠️ ALERTA: La imagen de cara {face_name} no se pudo recuperar.")

    # 3. Construir el Email
    msg = MIMEMultipart('related')
    msg['From'] = GMAIL_USER
    msg['To'] = DESTINATARIO
    msg['Subject'] = f"🚨 ALERTA SENTINEL: {alerta_json.get('alerta', 'Intruso')}"

    # Generar HTML dinámico para las caras
    caras_html = ""
    if caras_data:
        for idx, (face_name, _) in enumerate(caras_data):
            caras_html += f'''
            <td style="padding: 10px; vertical-align: top;">
                <p style="margin:0; font-size:10px; color:#666;">Rostro #{idx+1}</p>
                <img src="cid:img_face_{idx}" style="width: 120px; height: 120px; object-fit: cover; border: 3px solid #d9534f; border-radius: 5px;">
            </td>
            '''
    else:
        caras_html = "<td><p>⚠️ No se pudieron adjuntar los recortes de rostro.</p></td>"

    # HTML de la imagen completa
    full_html = ""
    if data_full:
        full_html = '<img src="cid:img_full" style="max-width: 100%; border: 1px solid #999; border-radius: 5px;">'
    else:
        full_html = "<p>⚠️ Imagen de escena completa no disponible.</p>"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; border-radius: 10px;">
        <h1 style="color: #d9534f; margin-top: 0;">⚠️ INTRUSO DETECTADO</h1>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p><strong>🕒 Hora:</strong> {alerta_json.get('timestamp')}</p>
            <p><strong>👁️ Identificación:</strong> {sujetos}</p>
        </div>

        <h3 style="margin: 0 0 10px 0; color: #333;">👤 Análisis de Rostros</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                {caras_html}
            </tr>
        </table>
        
        <h3 style="margin: 20px 0 10px 0; color: #333;">🏠 Escena Completa</h3>
        {full_html}
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">Sentinel Cloud Security System</p>
    </div>
    """
    msg.attach(MIMEText(html_content, 'html'))

    # 4. Adjuntar imágenes (Forzando tipo JPEG)
    # Adjuntar caras
    for idx, (face_name, face_bytes) in enumerate(caras_data):
        # _subtype="jpeg" ayuda a clientes de correo estrictos
        img_part = MIMEImage(face_bytes, _subtype="jpeg") 
        img_part.add_header('Content-ID', f'<img_face_{idx}>')
        img_part.add_header('Content-Disposition', 'inline', filename=face_name)
        msg.attach(img_part)
    
    # Adjuntar full
    if data_full:
        img_part = MIMEImage(data_full, _subtype="jpeg")
        img_part.add_header('Content-ID', '<img_full>')
        img_part.add_header('Content-Disposition', 'inline', filename=name_full)
        msg.attach(img_part)

    # 5. Enviar
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"✅ Correo enviado a {DESTINATARIO} con {len(caras_data)} rostros y escena.")
        return "EMAIL_SENT"
    except Exception as e:
        print(f"❌ Error SMTP: {e}")
        return f"ERROR_SMTP: {e}"