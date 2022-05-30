locals {
  lambda_version = filebase64sha256(var.lambda_file)
  lambda_vars = {
    stage                      = terraform.workspace
    lambdaVersion              = local.lambda_version
    stepFunctionArn            = "arn:${data.aws_partition.current.partition}:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${local.lottery_workflow_name}"
    FIREBASE_64                = var.FIREBASE_64
    DISCORD_PUBLIC_KEY         = var.DISCORD_PUBLIC_KEY
    BOT_TOKEN                  = var.BOT_TOKEN
    DISCORD_SERVER_ID          = var.DISCORD_SERVER_ID
    DISCORD_RESIDENT_ROLE_ID   = var.DISCORD_RESIDENT_ROLE_ID
    DISCORD_NEW_MEMBER_ROLE_ID = var.DISCORD_NEW_MEMBER_ROLE_ID
    # DENO_IMPORTMAP  = "./import_map.json"
    # DENO_UNSTABLE   = "true"
    # HANDLER_EXT     = "ts.js"
  }
}

resource "aws_lambda_layer_version" "deno" {
  filename         = var.lambda_layer_file
  layer_name       = "${local.project}_deno_layer"
  source_code_hash = filebase64sha256(var.lambda_layer_file)
}

resource "aws_lambda_function" "api" {
  filename         = var.lambda_file
  function_name    = local.api_lambda_name
  handler          = "src/lambda.api"
  timeout          = 10
  memory_size      = 512
  role             = aws_iam_role.lambda.arn
  runtime          = "provided.al2"
  source_code_hash = filebase64sha256(var.lambda_file)

  layers = [aws_lambda_layer_version.deno.arn]

  environment {
    variables = local.lambda_vars
  }
}

resource "aws_lambda_function" "workflow" {
  filename         = var.lambda_file
  function_name    = local.workflow_lambda_name
  handler          = "src/lambda.workflow"
  timeout          = 10
  memory_size      = 256
  role             = aws_iam_role.lambda.arn
  runtime          = "provided.al2"
  source_code_hash = filebase64sha256(var.lambda_file)

  layers = [aws_lambda_layer_version.deno.arn]

  environment {
    variables = local.lambda_vars
  }
}