FROM us-central1-docker.pkg.dev/chat-pulimi/sentinel-repo/sentinel-base:v2

WORKDIR /app

COPY requirements.txt .


RUN pip install --no-cache-dir -r requirements.txt

COPY . .


ENV PORT=8080

CMD ["functions-framework", "--target=analizar_intruso"]