output "tunnel_token" {
  value     = cloudflare_zero_trust_tunnel_cloudflared.bot.tunnel_token
  sensitive = true
}

output "tunnel_id" {
  value = cloudflare_zero_trust_tunnel_cloudflared.bot.id
}

output "bot_url" {
  value = "https://${var.hostname}.${var.zone}"
}
