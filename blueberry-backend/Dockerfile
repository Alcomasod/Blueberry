# ЭТАП 1: Сборка (Builder)
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем только package.json для кэширования слоя npm ci
COPY package*.json ./

# Устанавливаем ВСЕ зависимости (включая typescript для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Компилируем TypeScript в JavaScript (создает папку dist)
RUN npm run build

# Удаляем dev-зависимости, чтобы уменьшить итоговый размер образа
RUN npm prune --production


# ЭТАП 2: Production образ
FROM node:20-alpine

WORKDIR /app

# Копируем package.json и очищенные node_modules из builder-образа
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Копируем скомпилированный JS-код
COPY --from=builder /app/dist ./dist

# .env файл НЕ копируем! Он будет передан через docker-compose.yml

EXPOSE 3000

# Запускаем скомпилированное приложение
CMD ["node", "dist/index.js"]