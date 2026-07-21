import OpenAI from "openai";

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const openai = new OpenAI({
  apiKey: requiredEnv("OPENAI_API_KEY"),
});

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
