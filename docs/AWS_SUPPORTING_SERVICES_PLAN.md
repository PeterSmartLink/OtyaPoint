# AWS supporting-services plan for OmniPoint

## Decision

AWS is connected to the development workspace, but the read-only inventory found no application resources in eu-west-2. Do not create AWS resources automatically: resource creation can incur costs and needs an explicit scope and budget.

Cloudflare remains the approved primary runtime and operational data platform:
- Workers: API and business rules.
- D1: canonical operational records, stock, cashbook, float, payment-operation state, audit events and ledger.
- R2: private application exports or documents when needed.
- Queues/Workflows/Cron: background processing when justified.

Do not create a second authoritative ledger/database in AWS. Do not dual-write financial records between D1 and AWS.

## Appropriate optional AWS roles

Only introduce an AWS service when it solves a measured requirement that Cloudflare does not already satisfy economically and operationally.

1. **S3 backup/archive (optional later):** encrypted, private, versioned backup copies of approved exports or database backups. Require a retention policy, restore test, least-privilege access and a lifecycle rule before storing data. Never use a public bucket.
2. **CloudTrail (security audit):** enable/verify account-level audit coverage if it is not already available. Keep logs private and define retention and alerting costs.
3. **CloudWatch (operations):** use only if AWS-hosted workloads or an explicit cross-platform monitoring requirement exist.
4. **Lambda/SQS/EventBridge:** do not add by default. Cloudflare Queues/Workflows/Cron already cover the currently planned asynchronous jobs; introducing a second queue/runtime adds operational complexity and duplicate-delivery paths.
5. **RDS/DynamoDB/API Gateway:** not selected for the current design because D1 is the approved canonical database and Workers is the approved API runtime.

## Data and security rules

- No production data, payment credentials, PINs, OTPs, raw card data or provider secrets in AWS during the preview phase.
- Use synthetic test records only.
- Keep AWS credentials out of Git, client bundles, logs and Postman collections.
- If cross-cloud backup is approved, encrypt in transit and at rest, use a dedicated least-privilege role, and document restore ownership and recovery objectives.
- Financial events remain append-only in D1; an AWS backup is a recovery copy, never a second live ledger.
- Any service activation must include estimated monthly cost, free-tier caveats, region, data classification, access policy, monitoring and a tested cleanup/rollback plan.

## Current inventory

A read-only check of the connected AWS account in eu-west-2 found no S3 buckets, Lambda functions, DynamoDB tables, SQS queues, RDS instances, API Gateway v2 APIs or completed CloudFormation stacks. This is a scoped inventory, not proof that every AWS service or every region is empty. The account identity and credentials are not recorded here.

## Delivery gates

1. Confirm a specific AWS use case and monthly spending limit.
2. Review the proposed resources and IAM policy before creating anything.
3. Create only isolated development resources, with no public access and no production data.
4. Verify security settings, costs and deletion/retention behavior.
5. Test restore or processing behavior before relying on it.
6. Obtain explicit owner approval before production data, production secrets, or production workloads are introduced.
