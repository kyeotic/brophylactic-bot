#!/usr/bin/env bash

set -euxo pipefail

_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pushd "${_dir}/.."

docker build -t gcr.io/tk8-cluster/brobot .
docker push gcr.io/tk8-cluster/brobot
kubectl rollout restart deployment brobot -n brobot

popd