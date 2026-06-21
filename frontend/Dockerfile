FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
RUN npm install

FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
# P0: 개발 서버로 기동(빌드 최적화는 P6). 운영 빌드는 `npm run build && npm start`
CMD ["npm", "run", "dev"]
