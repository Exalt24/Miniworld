# Contracts Service Dockerfile
# For running Hardhat node and deploying contracts

FROM node:22.20.0-alpine

WORKDIR /app

# Install dependencies required for native modules AND curl for health check
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY contracts/package*.json ./

# Install dependencies
RUN npm ci

# Copy contract source
COPY contracts/contracts ./contracts
COPY contracts/ignition ./ignition
COPY contracts/test ./test
COPY contracts/hardhat.config.ts ./
COPY contracts/tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose Hardhat node RPC port
EXPOSE 8545

# Start Hardhat node by default
CMD ["npx", "hardhat", "node"]