FROM node:22-alpine

WORKDIR /app

# ⭐ STEP 1: Build SDK first
WORKDIR /sdk

# Copy contracts artifacts (needed for SDK prebuild)
COPY contracts/artifacts /contracts/artifacts

# Copy and build SDK
COPY sdk/package*.json ./
COPY sdk/scripts ./scripts
COPY sdk/src ./src
COPY sdk/tsconfig.json ./

RUN npm ci && npm run build

# ⭐ STEP 2: Now build game-client
WORKDIR /app

# Copy package files
COPY game-client/package*.json ./

# Install ALL dependencies (including vite)
RUN npm ci

# Copy source code
COPY game-client/ ./

# Expose Vite dev server port
EXPOSE 3000

# Run Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]