default:
    @just --list

# Run the bot locally with dev env vars
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    set -o allexport; source .env.dev; set +o allexport
    STAGE=dev cargo watch -x run

command-deploy env="dev":
    ./scripts/command-deploy {{ env }}

infra-deploy:
    ./scripts/deploy

get-tunnel-token:
    terraform -chdir=infra/terraform output -raw tunnel_token

docker-build:
    docker build --platform linux/amd64 -t docker.local.kye.dev/discord-bot:latest .

deploy:
    docker build --platform linux/amd64 -t docker.local.kye.dev/discord-bot:latest .
    docker push docker.local.kye.dev/discord-bot:latest
    stack-sync sync discord-bot

# Build the Docker image with Nix
nix-image:
    nix build .#docker-image
    docker load < result

# Build, load, push, and deploy with Nix
nix-deploy:
    nix build .#docker-image
    docker load < result
    docker push docker.local.kye.dev/discord-bot:latest
    stack-sync sync --redeploy discord-bot

deploy-stack *args:
    stack-sync sync  {{ args }}

# Run the CLI
run *args:
    cargo run -- {{ args }}

# Check compilation without building
check:
    cargo check

# Run tests
test:
    cargo test

# Run clippy lints
lint:
    cargo clippy -- -D warnings

# Format code
fmt:
    cargo fmt

# Check formatting without modifying files
fmt-check:
    cargo fmt -- --check
