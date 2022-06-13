#-------------------------------------------
# Required variables (do not add defaults here!)
#-------------------------------------------
variable "api_name" {}
variable "zone" {}
variable "FIREBASE_64" {
  sensitive = true
}
variable "DISCORD_PUBLIC_KEY" {
  sensitive = true
}
variable "BOT_TOKEN" {
  sensitive = true
}
variable "DISCORD_SERVER_ID" {}
variable "DISCORD_RESIDENT_ROLE_ID" {}
variable "DISCORD_NEW_MEMBER_ROLE_ID" {}

#-------------------------------------------
# Configurable variables
#-------------------------------------------
variable "region" {
  default = "us-west-2"
}

variable "app_namespace" {
  default = "brobot"
}

variable "lambda_file" {
  default = "../../build/lambda.zip"
}


#-------------------------------------------
# Interpolated Values
#-------------------------------------------

locals {
  project = "${var.app_namespace}_${terraform.workspace}"
  is_prod = terraform.workspace == "prod"

  domain_name           = "${var.api_name}.${data.aws_route53_zone.api.name}"
  api_gateway_name      = "${local.project}_api"
  api_lambda_name       = "${local.project}_api"
  workflow_lambda_name  = "${local.project}_workflow"
  lottery_workflow_name = "${local.project}_lottery"
}
