FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

COPY . .

EXPOSE 5001

CMD [ "node", "app.js"]