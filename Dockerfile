FROM node:14

# Create the directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Copy and Install our bot
COPY . .
RUN npm install \
  && npm run build

CMD ["npm", "start"]