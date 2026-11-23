import { describe, expect, it } from "vitest";
import {
  clearSessionCookie, hashToken, isExpired, MAGIC_LINK_TTL_MS, newToken,
  normalizeEmail, readSessionToken, sessionCookie, SESSION_COOKIE, tokensMatch,
} from "../../server/authCore";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com"));
  it("rejects junk", () => {
    for (const bad of ["", "nope", "a@b", "a b@c.com", 5, null, undefined, "a@@b.com"]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });
});

describe("tokens", () => {
  it("are unique and long", () => {
    const a = newToken(), b = newToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });
  it("match only their own hash", () => {
    const t = newToken();
    expect(tokensMatch(t, hashToken(t))).toBe(true);
    expect(tokensMatch(newToken(), hashToken(t))).toBe(false);
    expect(tokensMatch(t, "zz")).toBe(false);
  });
  it("expire at the boundary", () => {
    expect(isExpired(1000 + MAGIC_LINK_TTL_MS, 1000)).toBe(false);
    expect(isExpired(1000, 1000)).toBe(true);
  });
});

describe("cookies", () => {
  it("sets safe flags", () => {
    const c = sessionCookie("abc", 0);
    for (const f of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) expect(c).toContain(f);
  });
  it("reads the session token back", () => {
    expect(readSessionToken(`x=1; ${SESSION_COOKIE}=tok=en; y=2`)).toBe("tok=en");
    expect(readSessionToken("x=1")).toBeNull();
    expect(readSessionToken(undefined)).toBeNull();
  });
  it("clears", () => expect(clearSessionCookie()).toContain("Max-Age=0"));
});
