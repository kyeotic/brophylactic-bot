#-------------------------------------------
# Required variables
#-------------------------------------------
variable "cloudflare_api_token" {
  sensitive = true
}

variable "cloudflare_account_id" {}

variable "zone" {
  default = "kye.dev"
}

variable "hostname" {
  default = "discord-bot"
}

variable "tunnel_service_url" {
  description = "URL the tunnel points to (the bot's HTTP server in Docker compose)"
  default     = "http://bot:8006"
}

