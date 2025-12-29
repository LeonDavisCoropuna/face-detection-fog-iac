# --- AQUI ESTA LA MAGIA ---
# En vez de "python:3.10-slim", usamos TU imagen pre-cocinada
FROM us-central1-docker.pkg.dev/chat-pulimi/sentinel-repo/sentinel-base:v1

WORKDIR /app

# 1. Copiamos solo los requirements RESTANTES (sin dlib, porque ya lo tenemos)
COPY requirements.txt .

# 2. Instalamos el resto (Flask, numpy, opencv...)
# Esto tardará solo segundos
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copiamos tu código (lo que más cambias)
COPY . .

ENV PORT=8080
CMD ["functions-framework", "--target=analizar_intruso"]