local env="dev":
    ./scripts/local {{ env }}

command-deploy env="dev":
    ./scripts/command-deploy {{ env }}

infra-deploy:
    ./scripts/deploy

get-tunnel-token:
    terraform -chdir=infra/terraform output -raw tunnel_token

deploy:
    docker build --platform linux/amd64 -t docker.local.kye.dev/brophylactic-bot:latest .
    docker push docker.local.kye.dev/brophylactic-bot:latest

deploy-stack *args:
    stack-sync sync  {{ args }}
