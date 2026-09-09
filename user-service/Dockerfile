FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN apk add --no-cache python3 make g++

RUN npm ci --omit=dev

COPY . .

EXPOSE 5001

CMD [ "node", "app.js"]