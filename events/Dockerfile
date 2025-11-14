# 1. Offizielles Node-Image (schlank)
FROM node:25-alpine

# 2. Arbeitsverzeichnis erstellen
WORKDIR /app

# 3. package.json + package-lock.json kopieren
COPY package*.json ./

# 4. Dependencies installieren
RUN npm install --production

# 5. Restlichen Code kopieren
COPY . .

# 6. Port exposen (falls dein Express auf 3000 läuft)
EXPOSE 3000

# 7. Startbefehl
CMD ["node", "server.js"]
