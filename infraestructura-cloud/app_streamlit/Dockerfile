FROM python:3.10-slim
WORKDIR /app
COPY . .
# Importante incluir numpy<2.0 aquí también
RUN pip install streamlit google-cloud-storage "numpy<2.0"
EXPOSE 8080
# Streamlit por defecto usa el puerto 8501, lo forzamos al 8080 de Cloud Run
CMD ["streamlit", "run", "main.py", "--server.port=8080", "--server.address=0.0.0.0"]