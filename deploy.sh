#!/bin/bash

# set -e

APP="brophylactic-bot"
npm run build
# now scale $APP.now.sh 0
now --public && now alias && now rm $APP --safe --yes