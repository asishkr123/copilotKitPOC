'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { ChartSpecRenderer } from '../charts'

/**
 * MessageHistory Component
 * Renders messages exactly like CopilotKit does
 */
export function MessageHistory({ messages = [], renderContainer = true }) {
  if (!messages || messages.length === 0) {
    return null
  }

  // Filter out tool/system messages
  const visibleMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant')

  if (visibleMessages.length === 0) {
    return null
  }

  const content = (
    <>
      {visibleMessages.map((message, index) => (
        <MessageItem key={message.id || index} message={message} />
      ))}
    </>
  )

  if (!renderContainer) {
    return content
  }

  return <div className="copilotKitMessagesContainer">{content}</div>
}

/**
 * Individual message - mimics CopilotKit's styling
 */
function MessageItem({ message }) {
  const isUser = message.role === 'user'

  // Render generative UI from CopilotKit tool calls if present
  const generativeUI =
    typeof message.generativeUI === 'function' ? message.generativeUI() : null

  // Handle ActionExecutionMessage (tool calls)
  if (message.type === 'ActionExecutionMessage' && message.toolCalls) {
    return (
      <div className="copilotKitMessage copilotKitAssistantMessage">
        <ToolCallRenderer toolCalls={message.toolCalls} />
      </div>
    )
  }

  // Handle text messages
  const content = normalizeMessageContent(message.content)
  const hasText = Boolean(content && content.trim())
  const shouldRender = hasText || generativeUI

  if (!shouldRender) {
    return null
  }

  let safeContent = content

  // Remove base64 images from markdown (they break rendering)
  // The chart is already rendered via renderComponent tool call
  if (!isUser) {
    safeContent = safeContent.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '')
  }

  const className = `copilotKitMessage ${
    isUser ? 'copilotKitUserMessage' : 'copilotKitAssistantMessage'
  }`

  return (
    <div className={className}>
      {isUser ? (
        <div>{safeContent}</div>
      ) : (
        <div>
          {generativeUI}
          {hasText && (
            <ReactMarkdown
              components={{
                // Disable image rendering to prevent broken base64 images
                img: () => null
              }}
            >
              {safeContent}
            </ReactMarkdown>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Render tool calls (charts)
 */
function ToolCallRenderer({ toolCalls }) {
  if (!toolCalls || toolCalls.length === 0) {
    return null
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {toolCalls.map((toolCall, idx) => {
        const funcName = toolCall.function?.name
        const argsString = toolCall.function?.arguments

        if (!funcName || !argsString) return null

        try {
          const args = JSON.parse(argsString)

          // renderComponent
          if (funcName === 'renderComponent' && args.componentId?.startsWith('chart-')) {
            return (
              <div key={idx} style={{ marginBottom: '12px' }}>
                <ChartSpecRenderer spec={args.componentData} />
              </div>
            )
          }

          // renderChartSpec (legacy)
          if (funcName === 'renderChartSpec' && args.spec) {
            return (
              <div key={idx} style={{ marginBottom: '12px' }}>
                <ChartSpecRenderer spec={args.spec} />
              </div>
            )
          }

          return null
        } catch (err) {
          console.error('[MessageHistory] Error parsing tool call:', err)
          return null
        }
      })}
    </div>
  )
}

function normalizeMessageContent(content) {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part
        if (part?.text) return part.text
        return ''
      })
      .join('')
  }
  if (content?.text) return content.text
  try {
    return JSON.stringify(content)
  } catch {
    return String(content)
  }
}
