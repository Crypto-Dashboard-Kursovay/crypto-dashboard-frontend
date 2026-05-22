FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

ENV CI=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Vite читает VITE_* env-переменные на этапе билда — пробрасываем их через build args.
ARG VITE_API_URL=http://localhost:8000/api/
ARG VITE_WS_URL=ws://localhost:8000/ws/updates
ARG VITE_TURNSTILE_SITEKEY=
ARG VITE_GIT_COMMIT=dev
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_TURNSTILE_SITEKEY=$VITE_TURNSTILE_SITEKEY \
    VITE_GIT_COMMIT=$VITE_GIT_COMMIT
RUN pnpm build

FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/ >/dev/null || exit 1
