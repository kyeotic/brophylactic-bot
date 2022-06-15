module "step_function" {
  source = "terraform-aws-modules/step-functions/aws"

  name = local.roulette_workflow_name
  type = "STANDARD"

  definition = jsonencode({
    Comment = "Roulette workflow for the brobot"
    StartAt = "Start"
    States = {
      Start = {
        Type        = "Wait",
        SecondsPath = "$.duration",
        Next        = "Finish"
      },
      Finish = {
        Type     = "Task",
        Resource = aws_lambda_function.workflow.arn
        End      = true
      }
    }
  })

  service_integrations = {
    lambda = {
      lambda = [
        aws_lambda_function.api.arn,
        aws_lambda_function.workflow.arn
      ]
    }
  }
}
