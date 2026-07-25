FROM node:24.18.0-bookworm AS bulider
WORKDIR /opt
RUN apt-get update \
    && apt-get install -y openssl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm i
COPY tsconfig.json ./
COPY src ./src
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm run build:production

FROM node:24.18.0-bookworm-slim
WORKDIR /opt
RUN apt-get update \
    && apt-get install -y openssl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm i --omit dev
COPY --from=bulider /opt/node_modules/.prisma/client /opt/node_modules/.prisma/client
COPY --from=bulider /opt/out /opt/out
CMD ["node", "out/index.js"]

