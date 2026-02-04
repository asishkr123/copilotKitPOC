'use client'

import React from 'react'
import { Box } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import { ChartSpecRenderer } from '../charts'

/**
 * MessageHistory Component
 * Renders messages exactly like CopilotKit does
 */
export function MessageHistory({ messages = [] }) {
  if (!messages || messages.length === 0) {
    return null
  }

  // Filter out tool/system messages
  const visibleMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant')

  if (visibleMessages.length === 0) {
    return null
  }

  return (
    <Box sx={{ width: '100%', paddingBottom: '16px' }}>
      {visibleMessages.map((message, index) => (
        <MessageItem key={message.id || index} message={message} />
      ))}
    </Box>
  )
}

/**
 * Individual message - mimics CopilotKit's styling
 */
function MessageItem({ message }) {
  const isUser = message.role === 'user'

  // Handle ActionExecutionMessage (tool calls)
  if (message.type === 'ActionExecutionMessage' && message.toolCalls) {
    return <ToolCallRenderer toolCalls={message.toolCalls} />
  }

  // Handle text messages
  if (!message.content) {
    return null
  }

  let content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  
  // Remove base64 images from markdown (they break rendering)
  // The chart is already rendered via renderComponent tool call
  if (!isUser) {
    content = content.replace(/!\[.*?\]\(data:image\/[^)]+\)/g, '')
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        paddingX: '16px'
      }}
    >
      <Box
        sx={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: isUser ? '#000000' : '#f0f0f0',
          color: isUser ? '#ffffff' : '#000000',
          fontSize: '14px',
          lineHeight: 1.5,
          // Markdown styling for assistant messages
          ...(!isUser && {
            '& p': { margin: '0 0 8px 0', color: '#000000' },
            '& p:last-child': { marginBottom: 0 },
            '& ul, & ol': { margin: '0 0 8px 0', paddingLeft: '20px', color: '#000000' },
            '& li': { marginBottom: '4px', color: '#000000' },
            '& strong': { fontWeight: 600, color: '#000000' },
            '& code': { 
              backgroundColor: '#e0e0e0', 
              padding: '2px 4px', 
              borderRadius: '3px',
              fontSize: '13px',
              color: '#000000'
            },
            '& pre': { 
              backgroundColor: '#e0e0e0', 
              padding: '12px', 
              borderRadius: '4px',
              overflow: 'auto',
              color: '#000000'
            }
          })
        }}
      >
        {isUser ? (
          // User message - plain text, white color
          <Box sx={{ color: '#ffffff' }}>{content}</Box>
        ) : (
          // Assistant message - markdown, black color, no images
          <Box sx={{ color: '#000000' }}>
            <ReactMarkdown
              components={{
                // Disable image rendering to prevent broken base64 images
                img: () => null
              }}
            >
              {content}
            </ReactMarkdown>
          </Box>
        )}
      </Box>
    </Box>
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
    <Box sx={{ marginBottom: '16px', paddingX: '16px' }}>
      {toolCalls.map((toolCall, idx) => {
        const funcName = toolCall.function?.name
        const argsString = toolCall.function?.arguments

        if (!funcName || !argsString) return null

        try {
          const args = JSON.parse(argsString)

          // renderComponent
          if (funcName === 'renderComponent' && args.componentId?.startsWith('chart-')) {
            return (
              <Box key={idx} sx={{ marginBottom: '12px' }}>
                <ChartSpecRenderer spec={args.componentData} />
              </Box>
            )
          }

          // renderChartSpec (legacy)
          if (funcName === 'renderChartSpec' && args.spec) {
            return (
              <Box key={idx} sx={{ marginBottom: '12px' }}>
                <ChartSpecRenderer spec={args.spec} />
              </Box>
            )
          }

          return null
        } catch (err) {
          console.error('[MessageHistory] Error parsing tool call:', err)
          return null
        }
      })}
    </Box>
  )
}
