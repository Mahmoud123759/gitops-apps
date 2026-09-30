FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./

ARG APP_VERSION=v2.0.0
ARG APP_COLOR="#16a34a"
ENV APP_VERSION=$APP_VERSION \
    APP_COLOR=$APP_COLOR \
    PORT=3000

EXPOSE 3000
USER node
CMD ["node", "server.js"]