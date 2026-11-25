# Imagen de la API.
# Contexto de build: la raiz del repositorio (copia app/package.json y app/server.js).
# Mismo archivo para el pipeline de este directorio y para score-compose.

FROM node:22-alpine AS dependencias

WORKDIR /app

COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 10001 -S app && adduser -u 10001 -S -G app app

COPY --from=dependencias /app/node_modules ./node_modules
COPY app/package.json app/server.js ./

USER 10001

EXPOSE 8080

CMD ["node", "server.js"]
