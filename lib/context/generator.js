import { promises as fs } from 'fs'
import path from 'path'
import OpenAI from 'openai'

const STORAGE_DIR = path.join(process.cwd(), '.chat-threads')

/**
 * Context generation system prompt
 */
const CONTEXT_SYSTEM_PROMPT = `You are a context summarizer for a data analytics conversation.
Given a conversation history, extract and return a JSON object with:
1. summary: A concise summary of what was discussed (2-3 sentences)
2. topics: Array of key topics discussed
3. lastMetric: The most recent metric discussed (e.g., "revenue", "sales")
4. lastPeriod: The most recent time period mentioned (e.g., "2024-Q4", "September 2025")
5. filters: Any dashboard filters or parameters mentioned

Be precise and factual. Include specific data points mentioned.
Return ONLY valid JSON, no markdown or code blocks.`

/**
 * Generate conversation context using LLM (Incremental Updates)
 * @param {Array} messages - Array of message objects (ideally last 5)
 * @param {Object} existingContext - Previous context to build upon
 * @returns {Promise<Object>} Context object
 */
export async function generateContext(messages, existingContext = null) {
  if (!messages || messages.length === 0) {
    return existingContext || {
      summary: 'New conversation started.',
      topics: [],
      lastMetric: null,
      lastPeriod: null,
      filters: {},
      lastUpdated: new Date().toISOString()
    }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  
  // Build conversation text from recent messages
  const conversationText = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      // Extract text from content
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return `${m.role}: ${content}`
    })
    .join('\n')
  
  // Build prompt based on whether we have existing context
  let userPrompt
  if (existingContext && existingContext.summary) {
    // Incremental update: merge new messages with existing context
    userPrompt = `You have the following EXISTING CONTEXT from previous conversation:

Summary: ${existingContext.summary}
Topics: ${existingContext.topics.join(', ')}
Last Metric: ${existingContext.lastMetric || 'none'}
Last Period: ${existingContext.lastPeriod || 'none'}
Filters: ${JSON.stringify(existingContext.filters)}

Now, here are the RECENT MESSAGES to incorporate:

${conversationText}

Update the context by merging the existing context with new information from recent messages. Keep the summary concise (2-3 sentences) and up-to-date.`
  } else {
    // First-time context creation
    userPrompt = `Summarize this conversation and extract key information:\n\n${conversationText}`
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CONTEXT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
    })
    
    const contextText = response.choices[0].message.content.trim()
    
    // Parse JSON, handling potential markdown code blocks
    let contextData
    if (contextText.startsWith('```')) {
      // Extract JSON from code block
      const jsonMatch = contextText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
      contextData = jsonMatch ? JSON.parse(jsonMatch[1]) : null
    } else {
      contextData = JSON.parse(contextText)
    }
    
    return {
      summary: contextData.summary || 'Conversation in progress.',
      topics: contextData.topics || [],
      lastMetric: contextData.lastMetric || null,
      lastPeriod: contextData.lastPeriod || null,
      filters: contextData.filters || {},
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.error('[Context Generator] Error generating context:', error)
    
    // Fallback: keep existing context or create simple one
    return existingContext || {
      summary: `Conversation with ${messages.length} messages.`,
      topics: ['data analysis'],
      lastMetric: null,
      lastPeriod: null,
      filters: {},
      lastUpdated: new Date().toISOString()
    }
  }
}

/**
 * Save context to filesystem
 * @param {string} threadId - Thread identifier
 * @param {Object} context - Context object
 */
export async function saveContext(threadId, context) {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
  const contextPath = path.join(STORAGE_DIR, `${threadId}-context.json`)
  await fs.writeFile(contextPath, JSON.stringify(context, null, 2), 'utf-8')
  console.log(`[Context] Saved context for thread ${threadId}`)
}

/**
 * Load context from filesystem
 * @param {string} threadId - Thread identifier
 * @returns {Promise<Object|null>} Context object or null
 */
export async function loadContext(threadId) {
  const contextPath = path.join(STORAGE_DIR, `${threadId}-context.json`)
  
  try {
    const data = await fs.readFile(contextPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`[Context] No context found for thread ${threadId}`)
      return null
    }
    console.error('[Context] Error loading context:', error)
    return null
  }
}

/**
 * Build context-aware system prompt
 * @param {string} basePrompt - Base system prompt
 * @param {Object} context - Context object
 * @returns {string} Enhanced system prompt
 */
export function buildContextPrompt(basePrompt, context) {
  if (!context || !context.summary) {
    return basePrompt
  }
  
  const contextSection = `

## Conversation Context

${context.summary}

**Topics Discussed**: ${context.topics.join(', ') || 'None yet'}
${context.lastMetric ? `**Last Metric**: ${context.lastMetric}` : ''}
${context.lastPeriod ? `**Last Time Period**: ${context.lastPeriod}` : ''}
${Object.keys(context.filters || {}).length > 0 ? `**Active Filters**: ${JSON.stringify(context.filters)}` : ''}

Use this context to understand the user's intent and provide relevant responses.`

  return basePrompt + contextSection
}
