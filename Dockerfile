FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY server ./server
COPY src ./src
COPY migrations ./migrations
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "--import", "tsx", "server/index.ts"]
