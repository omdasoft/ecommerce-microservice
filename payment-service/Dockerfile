FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN apk add --no-cache python3 make g++

RUN npm install

COPY . .

EXPOSE 5005

CMD [ "node", "app.js"]