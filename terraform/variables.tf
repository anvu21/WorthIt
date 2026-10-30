variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name prefix."
  type        = string
  default     = "worthitfood"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "prod"
}
