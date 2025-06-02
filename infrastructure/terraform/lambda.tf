locals {
  lambda_version = filebase64sha256(var.lambda_file)
  lambda_vars = {
    stage                      = terraform.workspace
    lambdaVersion              = local.lambda_version
    stepFunctionArn            = "arn:${data.aws_partition.current.partition}:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${local.roulette_workflow_name}"
    FIREBASE_64                = var.FIREBASE_64
    DISCORD_PUBLIC_KEY         = var.DISCORD_PUBLIC_KEY
    BOT_TOKEN                  = var.BOT_TOKEN
    DISCORD_SERVER_ID          = var.DISCORD_SERVER_ID
  }
}


resource "aws_lambda_function" "api" {
  filename         = var.lambda_file
  function_name    = local.api_lambda_name
  handler          = "src/lambda.api"
  timeout          = 10
  memory_size      = 512
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs16.x"
  source_code_hash = filebase64sha256(var.lambda_file)


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
  runtime          = "nodejs16.x"
  source_code_hash = filebase64sha256(var.lambda_file)

  environment {
    variables = local.lambda_vars
  }
}
