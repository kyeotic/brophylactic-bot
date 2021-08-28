FROM mhart/alpine-node:14 as base

# Create the directory
RUN mkdir -p /root/app
WORKDIR /root/app

# Copy dependency and build manifests to create docker cache
COPY package.json package-lock.json tsconfig.json ./

# ---- Dependencies ----
FROM base AS dependencies

# install node packages
RUN npm set progress=false && npm config set depth 0
RUN npm install --only=production 

# copy production node_modules aside
RUN cp -R node_modules prod_node_modules

# install ALL node_modules, including 'devDependencies'
RUN npm install

# now that dependencies are installed/cached copy the app sources
COPY . .

#
# ---- Test ----
FROM dependencies AS test
COPY . .
RUN  npm run check && npm run build

#
# ---- Release ----
FROM base AS release
RUN apk add --no-cache tini
RUN npm install pm2 -g && apk --no-cache add procps

# Digital Ocean Pm2 Hack, see: https://github.com/Unitech/pm2/issues/4360
RUN sed -i 's/pidusage(pids, function retPidUsage(err, statistics) {/pidusage(pids, { usePs: true }, function retPidUsage(err, statistics) {/' /usr/lib/node_modules/pm2/lib/God/ActionMethods.js

# copy production node_modules
COPY --from=dependencies /root/app/prod_node_modules ./node_modules
COPY --from=test /root/app/dist ./dist
# copy app sources
COPY . .
# expose port and define CMD
# EXPOSE 5000

ENTRYPOINT ["/sbin/tini", "--"]
CMD [ "pm2-runtime", "npm", "--", "start" ]
# CMD [ "npm", "start" ]
