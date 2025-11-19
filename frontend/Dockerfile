# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (generates static files in .output/public)
RUN npm run generate

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files for production dependencies
COPY package*.json ./

# Install only production dependencies (for express server)
RUN npm ci --omit=dev

# Copy the built static files from builder stage
COPY --from=builder /app/.output /app/.output

# Copy the server.js file
COPY server.js .

# Expose port (Cloud Run will set PORT env variable)
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Start the Express server
CMD ["node", "server.js"]
