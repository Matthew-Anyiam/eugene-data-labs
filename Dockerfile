# Stage 1: Build frontend
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
# Ensure production env is used (VITE_API_URL empty = same-origin)
RUN cat .env.production && npm run build

# Stage 2: Python backend + frontend dist
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# Copy application source and install the package
COPY . .
RUN pip install --no-cache-dir --no-deps .

# Copy frontend build output from stage 1
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Non-root user with write access to app dir
RUN useradd --create-home eugene && chown -R eugene:eugene /app
USER eugene

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["python", "eugene_server.py"]
