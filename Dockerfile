FROM node:24.18.0-bookworm AS bulider
WORKDIR /opt
COPY package.json package-lock.json ./
RUN npm i
COPY tsconfig.json ./
COPY src ./src
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm run build:production

FROM node:24.18.0-bookworm-slim
WORKDIR /opt
COPY package.json package-lock.json ./
RUN npm i --omit dev
COPY --from=bulider /opt/node_modules/.prisma/client /opt/node_modules/.prisma/client
COPY --from=bulider /opt/out /opt/out
CMD ["node", "out/index.js"]

