resource "random_id" "tunnel_secret" {
  byte_length = 32
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "bot" {
  account_id = local.cloudflare_account_id
  name       = "discord-bot"
  secret     = random_id.tunnel_secret.b64_std
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "bot" {
  account_id = local.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.bot.id

  config {
    ingress_rule {
      hostname = "${var.hostname}.${var.zone}"
      service  = var.tunnel_service_url
    }

    ingress_rule {
      service = "http_status:404"
    }
  }
}
