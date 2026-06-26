# ---- deps -----------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- build ----------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
ARG API_PROXY=http://badminton-be-rust:8090
ENV API_PROXY=$API_PROXY
# Unique per deploy so the service worker's bytes change → browsers auto-update.
ARG BUILD_ID=dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN sed -i "s/__BUILD_ID__/${BUILD_ID}/g" public/sw.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime (standalone) -------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3090

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3090
CMD ["node", "server.js"]
