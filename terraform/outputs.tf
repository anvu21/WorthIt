output "site_bucket" {
  description = "Bucket the deploy workflow syncs to (set as the SITE_BUCKET repo variable)."
  value       = aws_s3_bucket.site.bucket
}

output "site_bucket_regional_domain" {
  description = "Pass to the oil project as worthit_bucket_regional_domain (TF_WORTHIT_BUCKET_DOMAIN repo variable)."
  value       = aws_s3_bucket.site.bucket_regional_domain_name
}

output "cloudfront_distribution_id" {
  description = "Oil's distribution id (set as the CLOUDFRONT_DISTRIBUTION_ID repo variable)."
  value       = data.aws_cloudfront_distribution.oil.id
}

output "site_url" {
  description = "Public URL once oil's /worthit* behaviour is applied."
  value       = "https://${data.aws_cloudfront_distribution.oil.domain_name}/worthit/"
}
