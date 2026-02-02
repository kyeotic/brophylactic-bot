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
