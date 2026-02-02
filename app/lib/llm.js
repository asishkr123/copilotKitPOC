import OpenAI from 'openai'

/**
 * OpenAI client. Uses OPENAI_API_KEY from the environment.
 * Do not hardcode API keys; ensure OPENAI_API_KEY is set in deployment.
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})
