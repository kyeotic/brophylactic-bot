FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json esbuild.js ./
COPY src/ src/
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/dist/server.js ./dist/
EXPOSE 8006
CMD ["node", "dist/server.js"]
