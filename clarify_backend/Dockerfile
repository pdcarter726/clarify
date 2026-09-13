# The Playwright base image ships Node plus Chromium and all of its system
# libraries. Its tag must match the playwright-core version in package.json.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# prisma.config.ts reads DIRECT_URL, but generating the client never connects,
# so a placeholder is enough at build time.
RUN DIRECT_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
  && npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main"]
