data "aws_route53_zone" "main" {
  name = var.zone
}

resource "aws_route53_record" "bot" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.hostname}.${var.zone}"
  type    = "CNAME"
  ttl     = 300
  records = ["${cloudflare_tunnel.bot.id}.cfargotunnel.com"]
}
