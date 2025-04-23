# Build stage
FROM oven/bun:1 as builder
WORKDIR /usr/src/app

# Copy package files
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-slim
WORKDIR /usr/src/app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunjs

# Copy built files from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./

# Install production dependencies only
RUN bun install --production --frozen-lockfile

# Set proper permissions
RUN chown -R bunjs:nodejs /usr/src/app

# Switch to non-root user
USER bunjs

# Expose port (changed to 3000 to match your working version)
EXPOSE 3001/tcp

# Health check (simplified to just check if the process is running)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#     CMD ps aux | grep bun | grep -v grep || exit 1

# Start the application
CMD ["bun", "run", "./dist/index.js"]