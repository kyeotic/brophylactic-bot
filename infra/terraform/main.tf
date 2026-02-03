terraform {
  backend "s3" {
    key = "discord-bot"
  }
  required_version = ">= 1.2"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "cloudflare" { }

data "cloudflare_accounts" "self" {
  name = var.cloudflare_account_name
}

locals {
  cloudflare_account_id = data.cloudflare_accounts.self.accounts[0].id
}