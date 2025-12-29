import streamlit as st
from google.cloud import storage
import os

# Leer los nombres de los buckets de las variables de entorno de Cloud Run
BUCKET_INCOMING = os.environ.get("BUCKET_INCOMING", "sentinel-incoming-images-186c2f0")
BUCKET_EMPLOYEES = os.environ.get("BUCKET_EMPLOYEES", "sentinel-employees-56205db")

# Configuración de página
st.set_page_config(page_title="Sentinel Dashboard", layout="wide")
st.title("🚨 Sentinel: Monitoreo de Intrusos")

# Conexión a Storage
storage_client = storage.Client()

def get_images(bucket_name):
    bucket = storage_client.bucket(bucket_name)
    # Listamos los últimos 20 archivos (asumiendo que los más nuevos están al final por nombre)
    blobs = list(bucket.list_blobs(max_results=50))
    # Ordenar por fecha de creación (más reciente primero)
    blobs.sort(key=lambda x: x.time_created, reverse=True)
    return blobs

# --- BARRA LATERAL ---
st.sidebar.header("Configuración")
bucket_name = st.sidebar.text_input("Nombre del Bucket", BUCKET_INCOMING) # Pon tu bucket real
ver_recortes = st.sidebar.checkbox("Ver recortes de rostros", value=True)

# --- CUERPO PRINCIPAL ---
if st.button('🔄 Actualizar'):
    st.rerun()

try:
    blobs = get_images(bucket_name)
    
    # Separamos FULL de CROPS
    full_images = [b for b in blobs if "_FULL.jpg" in b.name]
    
    if not full_images:
        st.info("No se han detectado eventos aún.")
    else:
        for blob in full_images:
            # Diseño de tarjeta para cada detección
            with st.container(border=True):
                fecha = blob.time_created.strftime("%Y-%m-%d %H:%M:%S")
                st.subheader(f"Evento: {fecha}")
                
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    st.image(blob.download_as_bytes(), caption="Escena Completa", use_container_width=True)
                
                with col2:
                    st.write("🔍 **Detalles:**")
                    st.write(f"Archivo: `{blob.name}`")
                    
                    if ver_recortes:
                        # Buscar los recortes que corresponden a esta imagen FULL
                        base_name = blob.name.replace("_FULL.jpg", "")
                        crops = [b for b in blobs if base_name in b.name and "_CROP_" in b.name]
                        
                        if crops:
                            st.write(f"Rostros detectados: {len(crops)}")
                            for c in crops:
                                st.image(c.download_as_bytes(), width=150)
                        else:
                            st.warning("No hay recortes para este evento.")

except Exception as e:
    st.error(f"Error conectando al bucket: {e}")