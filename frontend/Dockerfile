FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/.output ./.output
RUN npm install --omit=dev --prefix ./.output/server
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
