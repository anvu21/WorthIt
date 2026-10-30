terraform {
  required_version = ">= 1.7"

  # Shares the oil project's state bucket + lock table under its own key.
  backend "s3" {
    bucket         = "gas-price-tf-state"
    key            = "worthitfood/prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "gas-price-tf-lock"
    encrypt        = true
  }
}
