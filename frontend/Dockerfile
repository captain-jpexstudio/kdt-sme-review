# 프로덕션 빌드 — next build && next start.
# 산출물이 해시 파일명(/_next/static/.../[hash].css)이라 배포 시 브라우저 캐시가 자동 무효화됨.
FROM node:20-slim
WORKDIR /app

# NEXT_PUBLIC_* 는 빌드 타임에 코드로 인라인되므로 build arg 로 주입한다.
# (compose 에서 .env 의 NEXT_PUBLIC_API_BASE 를 args 로 전달)
ARG NEXT_PUBLIC_API_BASE=http://localhost/api/v1
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

# 의존성(락 기준). 빌드에 devDeps(typescript/tailwind)가 필요하므로 NODE_ENV=production 전에 설치.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
