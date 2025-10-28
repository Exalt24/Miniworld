# Stage 1: Build stage
FROM node:22.20.0-alpine AS builder

WORKDIR /app

# ⭐ CRITICAL: Build SDK with ABI FIRST
# Copy contracts artifacts (needed for SDK prebuild)
COPY contracts/artifacts /contracts/artifacts

# Copy and build SDK
COPY sdk/package*.json /sdk/
COPY sdk/scripts /sdk/scripts
COPY sdk/src /sdk/src
COPY sdk/tsconfig.json /sdk/

WORKDIR /sdk
RUN npm ci && npm run build

# Now build game-client
WORKDIR /app

# Accept build arguments
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_CONTRACT_ADDRESS

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_CONTRACT_ADDRESS=$VITE_CONTRACT_ADDRESS

# Copy package files and install
COPY game-client/package*.json ./
RUN npm ci

# Copy source code
COPY game-client/src ./src
COPY game-client/public ./public
COPY game-client/index.html ./
COPY game-client/vite.config.ts ./
COPY game-client/tailwind.config.ts ./
COPY game-client/tsconfig*.json ./

# Build for production (will bundle SDK with ABI)
RUN npm run build

# Stage 2: Production stage with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx-game-client.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]