FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Copy static files to dist
RUN cp -r src/views dist/ && cp -r src/public dist/

# Production image
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Create config directory for database
RUN mkdir -p /app/config

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run the application
CMD ["node", "dist/index.js"]
