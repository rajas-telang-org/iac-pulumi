# iac-pulumi

This Pulumi program sets up an AWS Virtual Private Cloud (VPC) along with associated components such as subnets, route tables, and an Internet Gateway. It utilizes the Pulumi AWS provider and is written in JavaScript.

## Prerequisites

-Pulumi CLI installed (Pulumi Installation Guide)
-AWS CLI configured with appropriate credentials (AWS CLI Configuration Guide)
-Node.js and npm installed (Node.js Installation)

## Configuration

This Pulumi program requires several configuration parameters. You can set these parameters using the Pulumi configuration system. Create a Pulumi.dev.yaml file or use environment variables to set the following:

-vpc-cidr-block: The CIDR block for the VPC.
-vpc-name: The name to assign to the VPC.
-private-rt-name: The name to assign to the private route table.
-internet-gateway-cidr: The CIDR block for the Internet Gateway.
-publicSubPrefix: Prefix for public subnets.
-privateSubPrefix: Prefix for private subnets.
-public-route-name: The name to assign to the public route.
-internet-gateway-name: The name to assign to the Internet Gateway.
-internet-gateway-attachment-name: The name to assign to the Internet Gateway attachment.
-public-rt-name: The name to assign to the public route table.
-public-SubAssociationPrefix: Prefix for public subnet associations.
-private-SubAssociationPrefix: Prefix for private subnet associations.
-num_of_subnets: Number of subnets to create.

Usage
Initialize the Pulumi project:

# Set other configuration parameters

Deploy the infrastructure:

-'pulumi up'
After deployment, view the created resources:

- 'pulumi destroy' to Cleanup
  After destroying the stack, you can remove the stack:

##command to import SSL certificate
aws acm import-certificate --certificate fileb:///Users/rajastelang/Desktop/ssl/demo_rajastelang_me/demo_rajastelang_me.crt --private-key fileb:///Users/rajastelang/Desktop/ssl/rajasprivate.pem --certificate-chain fileb:///Users/rajastelang/Desktop/ssl/demo_rajastelang_me/demo_rajastelang_me.ca-bundle
