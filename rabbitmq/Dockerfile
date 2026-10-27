FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY broker.mjs api.mjs worker.mjs ./
USER node
CMD ["node", "api.mjs"]
