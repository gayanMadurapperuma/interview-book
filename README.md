# The Interview Book

A plain-English, animated reference for backend and full-stack interviews. Every chapter explains how something actually works, with step-through diagrams, real code, common mistakes and a model interview answer.

**Read it:** https://gayanmadurapperuma.github.io/interview-book/

## Volumes

| | Volume | Covers |
|---|---|---|
| I | JavaScript | values, scope, closures, prototypes, the event loop, modern syntax |
| II | Node.js | libuv, the event loop phases, streams, clustering, production services |
| III | TypeScript | the type system, generics, type-level programming, config |
| IV | Databases | SQL, transactions and isolation, indexes, replication, sharding, Redis |
| V | System Design | the interview method, distributed fundamentals, components, case studies |
| VI | APIs | HTTP, REST, GraphQL, gRPC, WebSockets and SSE |
| VII | Security | authentication, OAuth/OIDC, authorisation, web vulnerabilities, secrets |
| VIII | Kubernetes | containers, Docker, Kubernetes core, running Node in production |
| IX | AWS | IAM, VPC, EC2, ECS, EKS, Lambda, S3, RDS, DynamoDB, messaging, a production platform end to end |

There's also an interactive **Demo Lab** that animates the JavaScript and Node.js event loops.

## Running it locally

```bash
cd book
npm install
npm run dev        # http://localhost:4321/interview-book/
npm test           # checks demo scenarios against real Node output
npm run build      # static site + search index in book/dist
```

## Writing

- Chapters are MDX files in `book/src/content/<volume>/NN-slug.mdx`. The frontmatter is `title`, `part`, `order`, `level` and `summary`. Volumes and their parts are defined in `book/src/lib/subjects.ts`.
- Components available in every chapter: `<Diagram>`, `<Analogy>`, `<Callout>`, `<InterviewAnswer>`, `<KeyTerms>`, `<Output>`, `<DemoLink>`.
- `<Diagram>` renders Mermaid. Flowcharts can be stepped through with `steps`, sequence diagrams with `sequence` + `notes`, and architecture diagrams use AWS icons (`aws:lambda`, `aws:s3`, …). Read the layout rules at the top of `book/src/components/Diagram.astro` before drawing an architecture diagram.
- AWS icons come from `@iconify-json/logos` (CC0). To regenerate them: `node scripts/build-aws-icons.mjs` (run inside `book/`).

## Deployment

Every push to `main` runs `.github/workflows/static.yml`, which tests and builds the book and deploys it to GitHub Pages. The base path comes from the Pages configuration, so the site follows the repository name or a custom domain without code changes.
