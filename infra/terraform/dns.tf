data "aws_route53_zone" "main" {
  name = var.zone
}

# Delegate discord-bot.kye.dev to Cloudflare nameservers
resource "aws_route53_record" "bot_ns" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.hostname}.${var.zone}"
  type    = "NS"
  ttl     = 300
  records = [
    "graham.ns.cloudflare.com",
    "mira.ns.cloudflare.com",
  ]
}

# Proxied CNAME in Cloudflare pointing to the tunnel
data "cloudflare_zone" "main" {
  name = var.zone
}

resource "cloudflare_record" "bot" {
  zone_id = data.cloudflare_zone.main.id
  name    = var.hostname
  content = "${cloudflare_zero_trust_tunnel_cloudflared.bot.id}.cfargotunnel.com"
  type    = "CNAME"
  proxied = true
}
