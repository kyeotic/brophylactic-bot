FROM node:14 as base

# Create the directory
RUN mkdir -p /root/app
WORKDIR /root/app

# Copy and Install our bot
COPY . .

# ---- Dependencies ----
FROM base AS dependencies
# install node packages
RUN npm set progress=false && npm config set depth 0
RUN npm install --only=production 
# copy production node_modules aside
RUN cp -R node_modules prod_node_modules
# install ALL node_modules, including 'devDependencies'
RUN npm install

#
# ---- Test ----
FROM dependencies AS test
COPY . .
RUN  npm run check && npm run build

#
# ---- Release ----
FROM base AS release
# copy production node_modules
COPY --from=dependencies /root/app/prod_node_modules ./node_modules
COPY --from=test /root/app/dist ./dist
# copy app sources
COPY . .
# expose port and define CMD
# EXPOSE 5000
CMD npm run start