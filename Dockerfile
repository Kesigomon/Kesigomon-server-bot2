FROM node:16.9.1-buster as bulider
WORKDIR /opt
COPY package.json package-lock.json ./
RUN npm i
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc --sourceMap false

FROM node:16.9.1-buster-slim
WORKDIR /opt
COPY package.json package-lock.json ./
RUN npm i --production
COPY --from=bulider /opt/out /opt/out
CMD ["node", "out/index.js"]

