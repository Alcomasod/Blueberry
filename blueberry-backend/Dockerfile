# ============================================================
# ЭТАП 1: Сборка фронтенда (React + Vite)
# Контекст сборки — корень монорепозитория (blueberry/):
#   docker compose build app   (из blueberry-backend/)
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /fe

COPY blueberry-frontend/package*.json ./
RUN npm ci

COPY blueberry-frontend/ ./

# В едином контейнере фронтенд обращается к бэкенду по тому же origin,
# поэтому API URL — относительный '/api' (CORS не участвует,
# приложение доступно по любому IP/домену без пересборки).
ENV VITE_API_URL=/api
RUN npm run build

# ============================================================
# ЭТАП 2: Сборка бэкенда (TypeScript -> dist)
# ============================================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Копируем только package.json для кэширования слоя npm ci
COPY blueberry-backend/package*.json ./

# Устанавливаем ВСЕ зависимости (включая typescript для сборки)
RUN npm ci

# Копируем исходный код бэкенда
COPY blueberry-backend/ ./

# Компилируем TypeScript в JavaScript (создаёт папку dist)
RUN npm run build

# Подключаем собранный фронтенд как статику: dist/public/frontend
COPY --from=frontend-builder /fe/dist ./dist/public/frontend

# Удаляем dev-зависимости, чтобы уменьшить итоговый размер образа
RUN npm prune --production

# ============================================================
# ЭТАП 3: Production образ
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Копируем package.json и очищенные node_modules из builder-образа
COPY --from=backend-builder /app/package*.json ./
COPY --from=backend-builder /app/node_modules ./node_modules

# Копируем скомпилированный JS-код + статику фронтенда внутри dist
COPY --from=backend-builder /app/dist ./dist

# .env файл НЕ копируем! Он будет передан через docker-compose.yml

EXPOSE 3000

# Запускаем скомпилированное приложение
CMD ["node", "dist/index.js"]
