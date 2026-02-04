'use client'

import Box from '@mui/material/Box'
import { CopilotChat } from '@copilotkit/react-ui'
import { useCopilotMessagesContext } from '@copilotkit/react-core'
import { useRenderTools } from '../../components/copilot-tools/render-tools'
import { useFrontendTools } from '../../components/copilot-tools/frontend-tools'
import { mergeChatConfig } from '../../config/chat-ui'
import { MaiaInput } from '../../components/maia-chat/MaiaInput'
import { getOrCreateThreadId, handleSharedThread } from '../../../utils/threads'
import React, { useState, useEffect } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { MessageHistory } from '../../components/message-history'

export function FullScreenSpinner({ label = 'Loading insights…' }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        bgcolor: 'rgba(255, 255, 255, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <CircularProgress />
      <Typography sx={{ mt: 2 }} color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}

const MAIA_INSTRUCTIONS = `You are Maia, a data assistant for the US Dashboard.
Use the available MCP tools to fetch data. When you receive list or chart data, summarize it in text for the user or call renderChartSpec if they asked for a chart. Always provide a direct text answer; do not leave the user without a reply.`

/**
 * @param {Object} props
 * @param {{ className?: string, wrapperClassName?: string, wrapperSx?: object } | undefined} [props.chatConfig] - Optional config to customize the chat UI (CSS). See @/config/chat-ui.
 */
export function MaiaChat({ chatConfig: chatConfigOverrides }) {
  useRenderTools()
  useFrontendTools()
  const chatConfig = mergeChatConfig(chatConfigOverrides)
  const hasWrapper = chatConfig.wrapperClassName || chatConfig.wrapperSx
  const [showSpinner, setShowSpinner] = useState(null)
  
  // Handle shared threads before getting thread ID
  const [threadId, setThreadId] = useState(null)
  
  useEffect(() => {
    async function initThread() {
      // Check for shared thread first
      const sharedId = await handleSharedThread()
      if (sharedId) {
        setThreadId(sharedId)
      } else {
        setThreadId(getOrCreateThreadId())
      }
    }
    initThread()
  }, [])
  
  // Get CopilotKit's message context
  const { messages: copilotMessages, setMessages } = useCopilotMessagesContext()
  
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  
  // Load messages from DB into CopilotKit context
  useEffect(() => {
    if (!threadId) return
    
    console.log('[MaiaChat] Loading messages for thread:', threadId)
    setLoading(true)
    
    fetch(`/api/messages?threadId=${threadId}`)
      .then(res => res.json())
      .then(data => {
        console.log('[MaiaChat] Loaded', data.messages?.length, 'messages from DB')
        if (setMessages) {
            setMessages(data.messages || [])
        }
        setLoading(false)
        setInitialLoad(false)
      })
      .catch(err => {
        console.error('[MaiaChat] Failed to load messages:', err)
        setLoading(false)
        setInitialLoad(false)
      })
  }, [threadId, setMessages])
  
  // Auto-sync messages to backend after conversation updates
  useEffect(() => {
    // Don't sync during initial load or if no messages
    if (initialLoad || !copilotMessages || copilotMessages.length === 0) {
      return
    }
    
    // Debounce sync to avoid excessive calls during streaming
    const syncTimeout = setTimeout(async () => {
      try {
        console.log('[MaiaChat] Auto-syncing', copilotMessages.length, 'messages to backend')
        
        const response = await fetch('/api/messages/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId,
            messages: copilotMessages
          })
        })
        
        if (!response.ok) {
          console.error('[MaiaChat] Sync failed:', response.statusText)
        } else {
          const data = await response.json()
          console.log('[MaiaChat] ✅ Synced', data.saved, 'messages successfully')
        }
      } catch (error) {
        console.error('[MaiaChat] Sync error:', error)
      }
    }, 2000) // Wait 2 seconds after message changes to sync
    
    return () => clearTimeout(syncTimeout)
  }, [threadId, copilotMessages, initialLoad])

  const chat = (
    <React.Fragment>
      <MessageHistory messages={copilotMessages}/>
      <CopilotChat
        instructions={MAIA_INSTRUCTIONS}
        labels={{
          title: 'Maia',
          placeholder: 'How may I help you today?'
        }}
        className={chatConfig.className}
        Input={MaiaInput}
        
      />
      {showSpinner && <FullScreenSpinner label={showSpinner} />}
    </React.Fragment>
  )

  if (!hasWrapper) {
    return chat
  }

  return (
    <Box className={chatConfig.wrapperClassName} sx={chatConfig.wrapperSx}>
      {chat}
    </Box>
  )
}
