FROM node:22-alpine

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY backend/package*.json ./

# Install ALL dependencies (including devDependencies for tsx)
RUN npm ci

# Copy source code
COPY backend/ ./

# Copy SDK (backend may need SDK types)
COPY sdk/ ../sdk/

# Expose port
EXPOSE 4000

# Run dev server with tsx watch
CMD ["npm", "run", "dev"]