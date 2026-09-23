FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm test
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-slim AS production
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
ENTRYPOINT [ "node", "build/index.js", "--http", "--port", "3000" ]
