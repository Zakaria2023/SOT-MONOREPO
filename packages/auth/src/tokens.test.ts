import { beforeAll, describe, expect, it } from "vitest";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "./tokens";

const SECRET = "test-secret-value";

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

describe("access tokens", () => {
  it("round-trips a signed token", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" });
    expect(verifyAccessToken(token)).toEqual({
      sub: "user-1",
      email: "a@b.com",
    });
  });

  it("rejects a tampered signature", () => {
    const token = signAccessToken({ sub: "user-1", email: "a@b.com" });
    const lastChar = token.slice(-1);
    const tampered = token.slice(0, -1) + (lastChar === "a" ? "b" : "a");
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it("rejects a malformed token", () => {
    expect(() => verifyAccessToken("only-one-part")).toThrow(
      "Malformed access token",
    );
    expect(() => verifyAccessToken("not.a.jwt.at.all")).toThrow(
      "Malformed access token",
    );
  });

  it("rejects a token signed with a different secret", () => {
    const token = signAccessToken({ sub: "u", email: "e@x.com" });
    process.env.JWT_SECRET = "a-different-secret";
    expect(() => verifyAccessToken(token)).toThrow();
    process.env.JWT_SECRET = SECRET;
  });
});

describe("refresh tokens", () => {
  it("generates unique tokens", () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it("hashes the same token deterministically", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashRefreshToken("token-a")).not.toBe(hashRefreshToken("token-b"));
  });
});
