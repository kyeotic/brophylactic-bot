#!/usr/bin/env bash

TOKEN_FILE="./bot-token.txt"
FIREBASE_FILE="./firebase.txt"

echo -n $BOT_TOKEN > $TOKEN_FILE
echo -n $FIREBASE_64 > $FIREBASE_FILE

# kubectl create secret generic person --from-env-file=<(env -i sh -c "set -a; . .env; printenv | grep -v '^PWD='")
kubectl create secret generic config -n brobot \
  --from-file=token=$TOKEN_FILE \
  --from-file=firebase=$FIREBASE_FILE
# kubectl create secret generic firebase --from-literal=$FIREBASE_64

rm $TOKEN_FILE
rm $FIREBASE_FILE