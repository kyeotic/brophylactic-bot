#!/usr/bin/env bash

# curl -i -H "authorization: $REDEPLOY_AUTHORIZATION" https://brophylactic-bot.deno.dev/redeploy
echo $REDEPLOY_AUTHORIZATION
curl -i -H "authorization: $REDEPLOY_AUTHORIZATION" http://0.0.0.0:8080/redeploy