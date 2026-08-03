// Clerk throws an error object carrying an `errors` array; surface the first
// human-readable message, falling back to a generic one.
export const clerkErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (error as { errors?: { message?: string }[] }).errors;
    if (Array.isArray(errors) && errors[0]?.message) {
      return errors[0].message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
};
