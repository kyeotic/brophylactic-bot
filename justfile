local:
  ./scripts/local

command-deploy env="dev":
  ./scripts/command-deploy {{env}}

infra-deploy env:
  ./scripts/deploy {{env}}

deploy:
  docker build --platform linux/amd64 -t docker.local.kye.dev/brophylactic-bot:latest .
  docker push docker.local.kye.dev/brophylactic-bot:latest
