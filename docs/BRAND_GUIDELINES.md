# Otya Family Brand Standard

**Owner:** Otya Hold Ltd  
**Brand principle:** One connected Otya family  
**Status:** Initial canonical standard for review; do not imply a public launch or legal trademark registration.

## 1. Brand architecture

| Name | Correct meaning | Use it for |
|---|---|---|
| **Otya Hold Ltd** | Parent legal entity | Legal notices, ownership, contracts and company-level policies |
| **Otya OS** | Unified ecosystem/platform | Cross-product ecosystem, navigation and platform-level descriptions |
| **Otya Server** | Shared backend and integration layer | Shared APIs, internal services, provider adapters and common infrastructure |
| **Otya Auth** | Shared identity service | Authentication and identity |
| **Otya Core** | Shared core platform services | Core APIs and reusable platform capabilities |
| **Otya Next** | Connected application/product | The product currently named Otya Next; preserve its existing function |
| **OtyaPoint** | The owner's shop and agency operations application | Inventory, retail sales, cashbook, reconciliation and future approved agency workflows |
| **Otya Media** | Media player | Media-player application, releases and product documentation |
| **OtyaHub** | Public developer/partner hub | Open-source collaboration, developer documentation and partner onboarding |

For legal notices, preserve the currently verified legal wording **“Otya Hold Ltd T/A OmniPoint”** unless the owner confirms a formal legal/trading-name change. In product UI and ecosystem navigation, use **OtyaPoint** as the current application/product name. Do not describe OtyaPoint or OmniPoint as a separate legal entity.

## 2. Visual identity

Use the supplied SVG assets in `public/branding/` as the first canonical source assets:

- `otya-mark.svg` — compact symbol for app icons and small spaces.
- `otya-wordmark.svg` — symbol plus the Otya wordmark.

### Core palette

| Token | Hex | Purpose |
|---|---|---|
| Otya Ink | `#102A43` | Primary text, dark backgrounds and strong contrast |
| Otya Teal | `#18A999` | Primary brand accent and positive interactive states |
| Otya Gold | `#F4B942` | Small highlights and secondary accent |
| Otya Paper | `#F7FAFC` | Light surfaces and backgrounds |
| Otya White | `#FFFFFF` | Text/surfaces where contrast is appropriate |

Use teal and ink as the default combination. Gold is an accent, not a large background. Keep text contrast accessible; never communicate status by colour alone. Product screens may use different supporting colours for status, warnings and errors.

### Typography and layout

- Prefer a clean system sans-serif stack; do not add a paid font dependency just for branding.
- Use sentence case, concise labels and plain language.
- Use consistent spacing, restrained borders, clear focus states and touch-friendly controls.
- Keep the symbol legible at small sizes. Use the wordmark where space permits.
- Do not stretch the logo, alter its proportions, add unapproved effects, or place it on low-contrast backgrounds.

## 3. Product naming and writing

- Write **Otya OS**, **Otya Server**, **Otya Auth**, **Otya Core**, **Otya Next**, **Otya Media**, **OtyaHub**, and **OtyaPoint** exactly as shown.
- Use **Otya family** for the connected suite, not as a replacement for each product's name.
- The legacy repository slug `OmniPoint` may remain for compatibility until a coordinated rename is approved. Product-specific interfaces should lead with their product name and may include a subtle “Part of Otya OS” descriptor when useful.
- Use **“One connected Otya family”** as the umbrella brand line.
- Describe capabilities honestly: “planned”, “in development”, “sandbox only”, and “live” must mean different things.
- Never call a payment integration live, secure, verified, backed up, or production-ready unless the relevant tests and operational evidence exist.

## 4. Code, package and infrastructure naming

Brand consistency must not break compatibility:

1. Update user-visible titles, descriptions, headers, footers, documentation, app metadata and non-sensitive examples first.
2. Keep stable package IDs, API routes, database identifiers, Worker names, DNS names, OAuth callback URLs and provider-required identifiers until references and migration steps have been audited.
3. Where an old identifier must remain, document it as a compatibility/technical identifier; do not present it as the public brand.
4. Keep product data and permissions isolated by service. Shared Otya branding does not mean sharing databases or granting cross-product access.
5. Keep secrets out of source control. Use platform secret stores.
6. Prefer free, permissively licensed open-source dependencies where they add clear value. Preserve their licences and notices; do not copy code without checking provenance and licence.

## 5. Review and release rules

- Work on a branch and propose changes through a pull request.
- Run lint, type checks, tests and build checks relevant to each affected repository.
- Check for old names in UI strings, metadata, manifests, docs and screenshots; distinguish obsolete public branding from required technical identifiers.
- Do not merge, deploy, change DNS/domains, rotate secrets, delete resources or activate live payments without the required review and explicit approval.
- Keep a record of what changed, what was tested, what remains and which environments are affected.

This standard is a living guide. Changes to legal identity, product architecture or the canonical names should be reviewed centrally so the ecosystem stays consistent.
