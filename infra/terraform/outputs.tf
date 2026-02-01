output "tunnel_token" {
  value     = cloudflare_tunnel.bot.tunnel_token
  sensitive = true
}

output "tunnel_id" {
  value = cloudflare_tunnel.bot.id
}

output "bot_url" {
  value = "https://${var.hostname}.${var.zone}"
}
