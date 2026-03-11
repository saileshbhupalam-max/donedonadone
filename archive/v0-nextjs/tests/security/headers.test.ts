import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

// Test that security headers are properly configured in next.config.mjs

describe("Security: Headers Configuration", () => {
  let configContent: string

  try {
    configContent = readFileSync(resolve(process.cwd(), "next.config.mjs"), "utf-8")
  } catch {
    configContent = ""
  }

  it("has next.config.mjs file", () => {
    expect(configContent.length).toBeGreaterThan(0)
  })

  it("disables production source maps", () => {
    expect(configContent).toContain("productionBrowserSourceMaps")
    expect(configContent).toMatch(/productionBrowserSourceMaps\s*:\s*false/)
  })

  it("sets X-Frame-Options to DENY", () => {
    expect(configContent).toContain("X-Frame-Options")
    expect(configContent).toContain("DENY")
  })

  it("sets X-Content-Type-Options to nosniff", () => {
    expect(configContent).toContain("X-Content-Type-Options")
    expect(configContent).toContain("nosniff")
  })

  it("sets Strict-Transport-Security", () => {
    expect(configContent).toContain("Strict-Transport-Security")
    expect(configContent).toContain("max-age=")
  })

  it("sets Referrer-Policy", () => {
    expect(configContent).toContain("Referrer-Policy")
    expect(configContent).toContain("strict-origin-when-cross-origin")
  })

  it("sets Permissions-Policy", () => {
    expect(configContent).toContain("Permissions-Policy")
  })
})

describe("Security: robots.txt", () => {
  let robotsContent: string

  try {
    robotsContent = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf-8")
  } catch {
    robotsContent = ""
  }

  it("has robots.txt file", () => {
    expect(robotsContent.length).toBeGreaterThan(0)
  })

  it("disallows /admin", () => {
    expect(robotsContent).toContain("Disallow: /admin")
  })

  it("disallows /api", () => {
    expect(robotsContent).toContain("Disallow: /api")
  })

  it("disallows /dashboard", () => {
    expect(robotsContent).toContain("Disallow: /dashboard")
  })

  it("disallows /partner", () => {
    expect(robotsContent).toContain("Disallow: /partner")
  })
})
