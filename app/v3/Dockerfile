FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./

ARG APP_VERSION=v3.0.0
ARG APP_COLOR="#ea580c"
ENV APP_VERSION=$APP_VERSION \
    APP_COLOR=$APP_COLOR \
    PORT=3000

EXPOSE 3000
USER node
CMD ["node", "server.js"]