FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_* são inlined no bundle em build time — precisam chegar como ARG
# (Railway injeta as variáveis do serviço como build args automaticamente
# quando o Dockerfile declara o ARG correspondente).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/.output ./.output
RUN npm install --omit=dev --prefix ./.output/server
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
