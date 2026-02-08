# v0 by Vercel -- Capabilities Research

> Research compiled: 2026-02-08
> Sources: Vercel official docs, community reviews, comparison analyses, original agent research

---

## 1. What is v0?

v0 (https://v0.app) is Vercel's AI-powered development platform that turns natural language
prompts into production-ready, full-stack web applications. It has evolved from a UI component
generator into a **full-stack vibe coding platform**. It is no longer just "generate a card
component" -- it can build complete, production-ready Next.js applications with backend logic,
databases, auth, and deployment.

v0 generates React components styled with Tailwind CSS and shadcn/ui, and can scaffold entire
Next.js applications from a single conversation. You describe what you want in plain English,
and the AI writes the code, previews it live, and deploys it to Vercel.

---

## 2. Core Capabilities

### 2.1 UI Generation
- Converts plain English prompts into production-ready React components
- Styled with Tailwind CSS and shadcn/ui by default
- Image-to-code: upload Figma designs, screenshots, or mockups and v0 recreates them as code
- URL cloning: provide a website URL and ask v0 to "clone it" as a starting point
- Supports responsive design, animations, hover effects, and accessibility features
- Generates clean, structured, usable code (not static mockups)

### 2.2 Full-Stack App Generation
- Generates complete Next.js 14+ apps (App Router) with server actions and API routes
- Multi-file generation in a single prompt
- React Server Components for improved rendering performance
- Server Actions that connect backend workflows directly to the application
- API route generation and middleware
- Multifile management for complex server-side workflows
- Defaults to Next.js for colocating frontend and backend code

### 2.3 Supported Frameworks and Libraries
- **Best-in-class**: Next.js, React, Tailwind CSS, shadcn/ui, Vercel AI SDK
- **Also supports rendering**: Svelte, Vue, HTML, Markdown (rendered inside Blocks)
- **UI libraries**: Bootstrap, Material UI can also be generated
- **ORMs**: Drizzle, Prisma, Supabase client
- **State management**: React hooks, context, server state

### 2.4 Database Integrations
One-click database integrations with popular providers:
- **Supabase** -- Postgres database with auth, realtime, and storage (one-click via Vercel Marketplace)
- **Neon** -- Serverless Postgres
- **Upstash** -- Serverless Redis and Kafka
- **Vercel Blob** -- Object storage

Key database integration details:
- Adding an integration provisions a new user account on that service and injects the
  necessary environment variables into your project automatically
- For SQL-based integrations, v0 can generate and execute SQL (create, update, drop tables)
- v0 auto-prompts you to create a Supabase project when it detects the need
- Can generate SQL migrations, RLS policies, and Supabase client code

### 2.5 Figma Integration
- Direct Figma file import (attach Figma link via attachment icon)
- v0 analyzes both visual layout AND underlying design tokens (color palettes, spacing)
- Higher fidelity results than screenshots because of design token extraction
- Screenshot upload also supported (lower fidelity but still effective)
- Best practice: break Figma designs into smaller component frames (navbar, sidebar, forms, etc.)
- Figma import is a **Premium+ feature**

### 2.6 Project Structure
- Works as a persistent project editor (like Cursor in browser)
- Each prompt in a chat session builds on previous context
- You work in ONE project, not disconnected generations
- Full file tree visible and editable

---

## 3. GitHub Integration

### 3.1 Git Import
Git Import allows you to bring any GitHub repository into v0 and work on your existing
codebase with AI assistance.

**How it works:**
- Import any GitHub repo into a v0 chat session
- v0 reads your project structure, coding style, and existing code (becomes context-aware)
- Every code change generates a Git commit automatically
- Create branches, open PRs, and merge directly from within v0
- v0 handles branch management automatically

**Access levels:**
- **Write access**: v0 works directly on the repository; changes are pushed to branches
  in the original repo; PRs are created directly
- **Read-only access**: v0 automatically forks the repo to your GitHub account; changes
  are made in the fork; contributions submitted via fork-based pull requests

### 3.2 Vercel Project Connection
When importing a repo, v0 checks if it is already connected to a Vercel Project:
- If connected: environment variables are automatically available; connected integrations
  (Supabase, Stripe, databases) work immediately without setup
- If not connected: v0 creates a new Vercel project for you

### 3.3 Preview Environment
- Uses **Vercel Sandbox** (VM-based approach)
- Closely mimics local development environment
- Provides: full Node.js runtime, real dependency installation, background processes, file system access
- Branch-based deployments: every push outside `main` gets a unique preview URL

### 3.4 Git Workflow
- Git panel lets you create a new branch for each chat
- Open PRs against main
- Deploy on merge
- Pull requests are first-class citizens
- Previews map to real Vercel deployments
- Main branch stays safe while you iterate with AI
- Can sync with CI/CD pipelines

---

## 4. Deployment

### 4.1 One-Click Deploy
- Click "Deploy" in v0 to package and send to Vercel
- Live in seconds at a `*.vercel.app` URL
- Creates a new Vercel project (prefixed with `v0-`)
- Updates that same project on each subsequent deploy
- Custom domains supported

### 4.2 Environment Variables
- Services connected via the "Connect" section inject env vars automatically
- Env vars are available both in the v0 editor and when deployed
- Manual configuration: Vercel > Project > Settings > Environment Variables
- Scoped by environment: Development, Preview, Production

### 4.3 Production Deployments
- Each v0 project has exactly one production URL
- Publishing a new chat in the same project replaces the previous deployment at the same URL
- Production URL remains consistent across all deployments
- Branch-based preview deployments are separate from production

---

## 5. Platform API and SDK

### 5.1 v0 Platform API (Beta)
A REST API that wraps v0's full code generation lifecycle:
**prompt -> project -> code files -> deployment**

**Capabilities:**
- Programmatic access to all v0 features
- AI-powered code generation
- Chat interface management
- Project management and updates
- Deployment automation

**Use cases:**
- Custom chat interfaces
- Automated workflows
- Development tool integrations
- Team dashboards
- AI agents that build and deploy apps

### 5.2 v0 SDK
- TypeScript library for the Platform API
- GitHub: https://github.com/vercel/v0-sdk
- Supports creating and managing chats and projects programmatically
- Available on Premium+ plans

---

## 6. Pricing (as of early 2026)

### 6.1 Plans

| Plan       | Price             | Monthly Credits | Key Features                                              |
|------------|-------------------|-----------------|-----------------------------------------------------------|
| Free       | $0                | $5              | v0-1.5-md model, GitHub sync, Vercel deployment           |
| Premium    | $20/month         | $20             | Buy more credits, higher upload limits, Figma imports, API |
| Team       | $30/user/month    | $30/user        | Shared credits, centralized billing, team collaboration    |
| Business   | $100/user/month   | (more)          | Advanced features, priority performance                    |
| Enterprise | Custom            | Custom          | Priority performance, dedicated support, SSO, security     |

### 6.2 Credit System
- Credits are consumed based on **input and output tokens**
- Longer prompts and larger outputs use more tokens
- Monthly credits **reset on billing date** and **do not roll over**
- Additional credits can be purchased on Premium+ plans
- Purchased credits **expire after one year**
- Purchased credits can be shared across team (Team/Enterprise plans)

### 6.3 Token Costs
- **Standard model**: Input ~$1.50/M tokens, Output ~$7.50/M tokens
- **Advanced model**: Input ~$7.50/M tokens, Output ~$37.50/M tokens
- Input tokens cost approximately $1.50 to $15 per million depending on model selected

### 6.4 Pricing History
- Pre-May 2025: generous, nearly unlimited plan
- May 2025: shifted to metered model based on token consumption (caused community backlash)
- Current model: token-based consumption with monthly credit allowances

### 6.5 Credit Optimization Tips
- Use standard model (cheaper) for most work
- Write specific, focused prompts (less input tokens)
- Don't regenerate -- iterate ("make the cards more compact")
- Break work into logical chunks within one project session
- Avoid excessive back-and-forth; get prompts right with specificity

---

## 7. Best Practices for Prompting

### 7.1 Be Specific and Detailed
- Vague prompts like "design a dashboard" produce generic, unusable output
- Detailed prompts deliver **30-40% faster generation**, fewer credits spent, cleaner code
- Include: what you need, who it serves, mood/style cues, behavior on different screens

**Bad prompt:**
> "design a dashboard"

**Good prompt:**
> "Build a shift management dashboard for warehouse workers. Include a clock in/out button,
> shift history grouped by week, and an active timer showing elapsed time. Use a dark theme
> with green accent colors. Mobile-first responsive layout. Use mock data."

### 7.2 Include Key Elements
Every prompt should specify:
1. **What**: the component or page (navbar, pricing table, landing page section)
2. **Who**: the target audience (affects tone, complexity, structure)
3. **Style**: mood cues, color schemes, design references
4. **Behavior**: responsive breakpoints, animations, hover effects, interactions
5. **Constraints**: "use mock data", specific libraries, no external dependencies

### 7.3 Component-by-Component Approach
- Build applications piece by piece, starting with individual components
- More control over each part; easier debugging
- Once happy with components, ask v0 to compose them together
- This is especially important for complex UIs

### 7.4 Iterative Development
- Start with general prompts, then refine based on output
- Two ways to iterate: (1) describe changes in chat, (2) edit code directly
- Start with core functionality, gradually add features
- Each iteration should be a working state

### 7.5 Use Constraints to Reduce Hallucination
- Clearly outline specific UI elements and their behaviors
- Telling v0 to "use mock data" prevents it from inventing API calls
- Specify exact field names, button labels, and data structures
- Reference existing component libraries or design systems

### 7.6 Use Reference Materials
- Upload screenshots or mockups for visual reference
- Attach Figma files for highest fidelity (includes design tokens)
- Provide website URLs to clone as starting points
- Reference other v0 generations as inspiration

### 7.7 Prompt Structure Template
```
Build a [component/page type] for [product/audience].

Requirements:
- [Feature 1 with specific details]
- [Feature 2 with specific details]
- [Feature 3 with specific details]

Design:
- [Color scheme / theme]
- [Layout preferences]
- [Responsive behavior]

Technical:
- [Framework preferences]
- [Data source: mock data / API / database]
- [Any constraints or libraries to use/avoid]
```

---

## 8. Limitations and Considerations

### 8.1 Current Limitations
- **Frontend-heavy**: Despite full-stack ambitions, v0 still primarily excels at frontend/UI
- **Backend requires wiring**: Developers must still connect APIs, databases, and complex
  state management themselves for production apps
- **Vercel ecosystem lock-in**: Tightest integration is with Vercel's own services
- **No native auth**: Authentication must be added via third-party integrations
- **Code errors**: LLM-generated code can have errors ~10% of the time, though v0's pipeline
  detects and fixes many in real-time during streaming
- **Framework constraints**: Strongest with React/Next.js; other frameworks are secondary
- **Credit consumption**: Complex prompts with large contexts burn through credits quickly

### 8.2 What v0 Does Well
- Rapid UI prototyping and component generation
- Professional, accessible, responsive React components
- Figma-to-code conversion
- Iterative design refinement through conversation
- One-click deployment to Vercel
- Git workflow integration
- shadcn/ui component generation (best-in-class)
- Context continuity within a single project/chat session

### 8.3 What v0 Does NOT Do Well
- Complex backend logic and multi-service architectures
- Non-React frameworks (limited support)
- Large-scale application architecture decisions
- Real-time collaborative editing (vs. Lovable)
- Offline or self-hosted deployment

---

## 9. Competitive Landscape (2026)

### v0 vs Bolt.new vs Lovable

| Aspect           | v0 (Vercel)                    | Bolt.new (StackBlitz)         | Lovable                        |
|------------------|--------------------------------|-------------------------------|--------------------------------|
| **Best for**     | React UI prototyping           | Full-stack dev speed          | No-code full-stack apps        |
| **Frontend**     | Excellent (React/Next.js)      | Strong (multi-framework)      | Good (generated)               |
| **Backend**      | Limited (server actions)       | Strong (full environment)     | Strong (Supabase integration)  |
| **Code quality** | High, follows React best practices | High, production-ready     | Varies by prompt clarity       |
| **Deployment**   | Vercel (native)                | Flexible                      | Built-in                       |
| **Git workflow** | Full GitHub integration        | Limited                       | GitHub sync                    |
| **Figma import** | Yes (Premium)                  | No                            | Yes                            |
| **API/SDK**      | Yes (Platform API)             | No                            | No                             |
| **Team collab**  | Team plan                      | Limited                       | Strong                         |
| **Pricing**      | Token-based credits            | Token-based                   | Subscription + credits         |

### When to Choose v0
- Building React/Next.js applications
- Need professional UI components quickly
- Want tight Vercel deployment integration
- Working with existing GitHub repos (Git Import)
- Need programmatic access (Platform API)
- Figma-to-code workflow is important

### When to Choose Alternatives
- Need full backend without manual wiring: consider Bolt.new or Lovable
- Non-React frameworks: consider Bolt.new
- No-code audience / business users: consider Lovable
- Budget-sensitive projects: compare credit costs carefully

---

## 10. Strategy Implications for donedonadone

### Optimal Workflow
1. **Create GitHub repo first** with basic structure
2. **Import into v0 via Git Import** -- v0 becomes context-aware of existing code
3. **Work in a single v0 project/chat** -- each prompt builds on previous context
4. **Push to GitHub from v0** -- changes go to repo automatically with commits
5. **Deploy to Vercel from v0** -- one-click production deployment

### Why This Beats Separate Disconnected Prompts
- **Context continuity**: v0 knows about ALL previous code in the session
- **No design drift**: consistent design system throughout
- **More efficient credit usage**: no re-explaining context
- **GitHub sync**: every iteration is versioned
- **Supabase integration**: set up once, used everywhere

### Credit Budget Strategy
- Use standard model (cheaper) for most work
- Write specific, focused prompts (less input tokens consumed)
- Don't regenerate -- iterate ("make the cards more compact")
- Break work into logical chunks within one project session
- A $15-20/month budget is workable with focused prompts on the standard model

---

## 11. Key URLs and Resources

- **v0 App**: https://v0.app
- **Documentation**: https://v0.app/docs
- **Pricing**: https://v0.app/docs/pricing
- **Full-Stack Apps Docs**: https://v0.app/docs/full-stack-apps
- **Database Docs**: https://v0.dev/docs/databases
- **Git Import Docs**: https://v0.app/docs/git-import
- **GitHub Integration Docs**: https://v0.app/docs/github
- **Figma Docs**: https://v0.app/docs/figma
- **Platform API Docs**: https://v0.app/docs/api/platform
- **v0 SDK (GitHub)**: https://github.com/vercel/v0-sdk
- **Text Prompting Guide**: https://v0.app/docs/text-prompting
- **How to Prompt v0 (Blog)**: https://vercel.com/blog/how-to-prompt-v0
- **Maximizing Outputs (Blog)**: https://vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation
- **Updated Pricing (Blog)**: https://vercel.com/blog/updated-v0-pricing
- **Vercel Community (v0)**: https://community.vercel.com/c/v0/59
- **Neon + v0 Production Guide**: https://neon.com/blog/the-new-v0-is-ready-for-production-apps-and-agents
