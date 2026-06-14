# syntax=docker/dockerfile:1
FROM node:20

WORKDIR /app

# Copy only the deps manifest first so npm ci layer is cached
# unless dependencies actually change.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code AFTER deps install.
# Code changes won't bust the npm ci cache.
COPY src ./src
COPY scripts ./scripts

# Document the listening port (informational, doesn't actually open it).
EXPOSE 5000

# Run as the non-root "node" user that the official image already creates.
USER node

# Default command when the container starts.
CMD ["node", "src/index.js"]
