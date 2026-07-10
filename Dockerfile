FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=optional --ignore-scripts=false
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-setuptools make g++ \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --omit=optional && npm cache clean --force
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV PORT=5331
ENV FEEDLOFT_DB_PATH=/app/data/feedloft.db
EXPOSE 5331

CMD ["node", "server/index.js"]
