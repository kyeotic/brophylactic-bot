
data "aws_route53_zone" "api" {
  name = var.zone
}

module "cert" {
  source  = "terraform-aws-modules/acm/aws"
  version = "~> 3.0"

  domain_name = "${var.api_name}.${data.aws_route53_zone.api.name}"
  zone_id     = data.aws_route53_zone.api.zone_id

  wait_for_validation = true
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.api.zone_id

  name = "${var.api_name}.${data.aws_route53_zone.api.name}"
  type = "A"

  alias {
    name                   = module.api_gateway.apigatewayv2_domain_name_target_domain_name
    zone_id                = module.api_gateway.apigatewayv2_domain_name_hosted_zone_id
    evaluate_target_health = false
  }
}
