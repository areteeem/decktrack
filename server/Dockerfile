FROM node:20-alpine

WORKDIR /app

COPY ["package.json", "yarn.lock", "./"]
RUN npx yarn@1.22.22 install --non-interactive
COPY . .
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "src/server.js"]
