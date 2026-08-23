FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV APP_VERSION=v1
ENV APP_COLOR=#2563eb
COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
