# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-build
WORKDIR /usr/src/app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Express backend and assemble
FROM node:20-slim
WORKDIR /usr/src/app

# Install compilation prerequisites for native SQLite3 compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend

# Copy backend application source code
COPY backend/ ./backend/

# Copy the compiled static frontend files from Stage 1
COPY --from=frontend-build /usr/src/app/frontend/dist ./frontend/dist

# Define environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose server port
EXPOSE 8080

# Create folder for persistent SQLite data
RUN mkdir -p /data

# Run the app
CMD ["node", "backend/server.js"]
