FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy backend source
COPY backend/ ./

# Copy SDK (backend depends on types from SDK)
COPY sdk/ ../sdk/

# Build backend
RUN npm run build

# ⭐ CRITICAL: Copy contract artifacts into dist
RUN mkdir -p ./dist/artifacts/contracts/MiniWorld.sol
COPY contracts/artifacts/contracts/MiniWorld.sol/MiniWorld.json \
     ./dist/artifacts/contracts/MiniWorld.sol/MiniWorld.json

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built backend from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 4000

CMD ["node", "dist/index.js"]