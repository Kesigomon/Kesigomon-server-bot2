FROM node:16.18.1-buster as bulider
WORKDIR /opt
COPY package.json package-lock.json ./
RUN npm i
COPY tsconfig.json ./
COPY src ./src
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm run build:production

FROM node:16.18.1-buster-slim
WORKDIR /opt
COPY package.json package-lock.json ./
RUN npm i --omit dev
COPY --from=bulider /opt/out /opt/out
CMD ["node", "out/index.js"]

