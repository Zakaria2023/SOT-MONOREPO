import { describe, expect, it } from "vitest";
import {
  AuthError,
  ConflictError,
  DomainError,
  ForbiddenError,
  toErrorResponse,
  ValidationError,
} from "./errors";

describe("domain errors", () => {
  it("are Error and DomainError instances carrying their status", () => {
    const error = new ValidationError("bad input");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.status).toBe(400);
    expect(error.message).toBe("bad input");
    expect(error.name).toBe("ValidationError");
  });

  it("map each subclass to its status code", () => {
    expect(new ValidationError("x").status).toBe(400);
    expect(new AuthError("x").status).toBe(401);
    expect(new ForbiddenError("x").status).toBe(403);
    expect(new ConflictError("x").status).toBe(409);
  });
});

describe("toErrorResponse", () => {
  it("exposes a domain error's status and message", () => {
    expect(toErrorResponse(new ConflictError("email taken"))).toEqual({
      status: 409,
      message: "email taken",
    });
  });

  it("hides an unexpected error as a generic 500", () => {
    const response = toErrorResponse(new Error("secret db detail"));
    expect(response.status).toBe(500);
    expect(response.message).not.toContain("secret db detail");
  });

  it("handles non-Error throws", () => {
    expect(toErrorResponse("boom").status).toBe(500);
  });
});
