# ─── Dependencies stage ───
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN npm ci --include-workspace-root

# ─── Build stage ───
FROM deps AS build

COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src

RUN npm run build --workspace backend

# ─── Production stage ───
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN npm ci --omit=dev --workspace backend

COPY --from=build /app/backend/dist ./backend/dist

WORKDIR /app/backend

EXPOSE 4000

CMD ["node", "dist/server.js"]
