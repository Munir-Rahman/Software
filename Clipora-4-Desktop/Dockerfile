# Build the React SPA separately from the runtime image.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY index.html vite.config.js ./
COPY client ./client
COPY public ./public
RUN npm run build

FROM node:22-bookworm-slim AS runtime
# Debian ffmpeg + Python 3.11 + yt-dlp with EJS support. Upgrade regularly.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates \
    && python3 -m venv /opt/yt-dlp \
    && /opt/yt-dlp/bin/pip install --no-cache-dir 'yt-dlp[default]==2026.10.26' \
    && rm -rf /var/lib/apt/lists/*
ENV PATH="/opt/yt-dlp/bin:$PATH" \
    NODE_ENV=production HOST=0.0.0.0 PORT=3001 DOWNLOAD_DIR=/app/server/runtime
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/server/runtime && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
