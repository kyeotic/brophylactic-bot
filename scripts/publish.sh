#!/usr/bin/env bash

set -euxo pipefail

_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pushd "${_dir}/.."

# REGISTRY="registry.digitalocean.com/tk8"
REGISTRY="gcr.io/tk8-cluster"

docker build -t $REGISTRY/brobot .
docker push $REGISTRY/brobot
kubectl rollout restart deployment brobot -n brobot

popd