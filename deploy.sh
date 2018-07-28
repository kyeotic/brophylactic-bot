#!/bin/bash

# set -e

APP="brophylactic-bot"
npm run deploy
# now scale $APP.now.sh 0
now --public && now alias && now rm $APP --safe --yes