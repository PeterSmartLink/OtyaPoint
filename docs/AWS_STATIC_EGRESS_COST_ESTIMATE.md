# OmniPoint AWS static-egress relay: cost estimate

**Status:** estimate only. No AWS resources or Elastic IPs have been created. Not approved for production.

## Pricing checked against AWS public Price List API

For an always-on, low-volume development relay, the initial candidate is one Linux `t4g.micro` EC2 instance in Mumbai (`ap-south-1`) with one attached Elastic IP/public IPv4 address. Mumbai is a candidate because it is geographically closer to Uganda than Europe and the current public list price is lower among the regions checked. It is not automatically the right region: confirm the payment partner accepts its IP/region and check measured latency before final selection.

| Region | Linux `t4g.micro` hourly compute | Approx. 730-hour compute/month | Approx. one public IPv4/month | Base subtotal |
|---|---:|---:|---:|---:|
| Asia Pacific (Mumbai), `ap-south-1` | $0.0056/hr | $4.09 | $3.65 | $7.74 |
| EU (Ireland), `eu-west-1` | $0.0092/hr | $6.72 | $3.65 | $10.37 |
| EU (London), `eu-west-2` | $0.0094/hr | $6.86 | $3.65 | $10.51 |
| EU (Frankfurt), `eu-central-1` | $0.0096/hr | $7.01 | $3.65 | $10.66 |

Compute values are from AWS Pricing API for Linux, shared tenancy, on-demand `t4g.micro` as queried for these four locations. The public IPv4 estimate uses AWS's published $0.005/address/hour rate: 730 hours × $0.005 = $3.65. The EC2 public IPv4/Elastic IP fee applies when attached unless the account's eligible Free Tier benefit covers the applicable usage. AWS sources: [EC2 On-Demand Pricing](https://aws.amazon.com/ec2/pricing/on-demand/), [Public IPv4 pricing announcement](https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/), [Elastic IP documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html).

## Realistic budget

- **Base estimate in Mumbai:** $7.74/month before disk, data transfer, logs/monitoring, taxes, support, and any additional services.
- **Budget planning range:** allow approximately $9–12/month for a tiny always-on relay until the actual EBS size, traffic, logs and account billing are confirmed. This is a planning range, not a guaranteed quote.
- **Free tier/credits:** account-specific. AWS's current Free Tier offers and credits depend on account eligibility and signup date; do not assume this account qualifies. If eligible credits cover the compute and public IPv4, net cash cost may be temporarily $0, but this must be checked in Billing before creation.
- **Do not use a NAT Gateway for this low-volume first version:** it adds a separate hourly and per-GB processing charge, making it an unnecessarily expensive default for a single outbound relay. AWS documents hourly and data-processing charges for NAT Gateway: [NAT Gateway pricing](https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-pricing.html).

## Why not claim this is free?

AWS charges $0.005/hour for a public IPv4 address in normal billing; an unused allocated Elastic IP can also be charged. The Free Tier's public IPv4 allowance depends on the account's eligibility and applicable terms. The connected AWS account's eligibility/credit balance has not been verified. Do not allocate an IP just to reserve it: it can incur charges while idle.

## Proposed isolated setup

1. Keep all work on the existing OmniPoint feature branch; do not change the production Cloudflare Worker, D1 database, provider allowlists, DNS or payment settings.
2. Prepare an infrastructure template and relay code for review only; do not create AWS resources yet.
3. When explicitly approved, create a small isolated EC2 instance in the selected region and attach one Elastic IP. Use a separate security group, minimal ingress, TLS, a dedicated service user, patched OS, and a documented rollback/termination procedure.
4. Keep provider hosts sandbox-only, and store sandbox credentials outside Git. Use synthetic requests only.
5. Verify the actual outbound IP from the instance and make a controlled test request to a harmless IP-echo endpoint. Do not submit the IP to the provider until it is verified and the provider's environment/product is confirmed.
6. Verify signed Worker-to-relay authentication, timestamp freshness, replay rejection, fixed destination allowlisting, response-size limits, timeouts, redacted logs and fail-closed behavior.
7. Enable AWS Budgets/alerts if supported for the account and monitor actual charges. A budget alert is not a hard spending cap.
8. Stop and remove the test resources after testing if the relay is not needed; release the Elastic IP when it is no longer needed.

## Alternatives

- If the partner accepts a Cloudflare dedicated egress product, compare its plan/add-on cost with this AWS relay. Cloudflare documents dedicated egress IPs as an add-on to Zero Trust Enterprise: [Cloudflare dedicated egress IPs](https://developers.cloudflare.com/cloudflare-one/traffic-controls/egress-policies/dedicated-egress-ips/).
- If the provider does not require a static IP for its sandbox, keep development on mocked/provider-sandbox calls until credentials and contract details are ready.
- If a provider accepts a shared fixed-IP service or a lower-cost trusted gateway, compare it only after security and contractual review.

## Approval gates

This estimate does not authorize resource creation. Before provisioning, explicitly approve the region, expected monthly spend (including taxes and storage), and isolated test resources. Production credentials, production allowlisting and live transactions require separate approval.
