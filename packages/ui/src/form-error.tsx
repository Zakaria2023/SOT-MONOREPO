type FormErrorProps = {
  message?: string;
};

export const FormError = ({ message }: FormErrorProps) => {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-danger">{message}</p>;
};
