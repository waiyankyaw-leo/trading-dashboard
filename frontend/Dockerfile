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

COPY frontend/index.html frontend/index.html
COPY frontend/nginx.conf frontend/nginx.conf
COPY frontend/postcss.config.js frontend/postcss.config.js
COPY frontend/tailwind.config.js frontend/tailwind.config.js
COPY frontend/tsconfig.json frontend/tsconfig.json
COPY frontend/vite.config.ts frontend/vite.config.ts
COPY frontend/src frontend/src

RUN npm run build --workspace frontend

# ─── Production stage ───
FROM nginx:alpine AS production

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
