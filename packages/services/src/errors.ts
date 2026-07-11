/**
 * Base class for expected, client-facing domain errors. Each carries the HTTP
 * status a transport should map it to. Anything that is NOT a DomainError is an
 * unexpected failure and should surface as a 500 with its detail hidden.
 *
 * Note: a resource that simply doesn't exist is not modelled here — services
 * return null/empty for that and the transport decides whether it's a 404. A
 * DomainError is only for a request we understood but cannot fulfill.
 */
export class DomainError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

/** Invalid input or a business rule that prevents fulfilling the request (400). */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

/** The caller is not allowed to act on this resource (403). */
export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(message, 403);
  }
}

/** The request conflicts with the resource's current state (409). */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** Authentication failed — bad credentials or an expired session (401). */
export class AuthError extends DomainError {
  constructor(message: string) {
    super(message, 401);
  }
}

/**
 * Map any thrown value to a client-safe status and message. DomainErrors expose
 * their own status and message; anything else is treated as an unexpected 500
 * and its detail is hidden from the client.
 */
export const toErrorResponse = (
  error: unknown,
): { status: number; message: string } => {
  if (error instanceof DomainError) {
    return { status: error.status, message: error.message };
  }
  return { status: 500, message: "Something went wrong. Please try again." };
};
