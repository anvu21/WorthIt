terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  name_prefix = "${var.project}-${var.environment}"
}

data "aws_caller_identity" "current" {}

# The site is served by the oil project's CloudFront distribution (path /worthit*).
# That distribution's /worthit* behaviour is defined in oil's Terraform; here we only
# need its ARN so the bucket policy can trust it.
data "terraform_remote_state" "oil" {
  backend = "s3"
  config = {
    bucket = "gas-price-tf-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

data "aws_cloudfront_distribution" "oil" {
  id = data.terraform_remote_state.oil.outputs.cloudfront_distribution_id
}

# ---------------------------------------------------------------------------
# Site bucket — private; objects live under the worthit/ prefix because
# CloudFront forwards the full request path (/worthit/...) as the object key.
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "site" {
  bucket        = "${local.name_prefix}-site-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = { Name = "${local.name_prefix}-site" }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "site_bucket" {
  statement {
    sid       = "AllowOilCloudFrontOAC"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/worthit/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [data.aws_cloudfront_distribution.oil.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.site]
}
