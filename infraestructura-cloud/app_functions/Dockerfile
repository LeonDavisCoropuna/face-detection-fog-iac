# Usamos una imagen de Python ligera
FROM python:3.10-slim

# 1. INSTALAR HERRAMIENTAS DE SISTEMA (Lo que nos faltaba antes)
# Instalamos CMake y compiladores C++ para que dlib funcione
RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Configurar directorio de trabajo
WORKDIR /app

# 3. Copiar dependencias e instalarlas
COPY requirements.txt .
# Ahora pip sí podrá compilar dlib porque instalamos cmake arriba
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copiar el código fuente
COPY . .

# 5. Configurar comando de arranque (Functions Framework)
ENV PORT=8080
CMD ["functions-framework", "--target=analizar_intruso"]