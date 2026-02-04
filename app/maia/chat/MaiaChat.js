'use client'

import Box from '@mui/material/Box'
import { CopilotChat } from '@copilotkit/react-ui'
import { useCopilotMessagesContext } from '@copilotkit/react-core'
import { useRenderTools } from '../../components/copilot-tools/render-tools'
import { useFrontendTools } from '../../components/copilot-tools/frontend-tools'
import { mergeChatConfig } from '../../config/chat-ui'
import { MaiaInput } from '../../components/maia-chat/MaiaInput'
import { getOrCreateThreadId, handleSharedThread } from '../../../utils/threads'
import React, { useRef, useState, useEffect } from 'react'
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
  const { messages: copilotMessages } = useCopilotMessagesContext()
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [persistedMessages, setPersistedMessages] = useState([])
  const historyRef = useRef(null)
  const isUserScrollUpRef = useRef(false)
  const isProgrammaticScrollRef = useRef(false)
  const hasLoadedPersistedRef = useRef(false)

  useEffect(() => {
    hasLoadedPersistedRef.current = false
    setPersistedMessages([])
    setInitialLoad(true)
  }, [threadId])

  // Load last 5 messages from DB for persisted history (not injected into CopilotKit)
  useEffect(() => {
    if (!threadId) return
    if (hasLoadedPersistedRef.current) return
    if (copilotMessages && copilotMessages.length > 0) {
      // In-memory session already has messages; skip persisted load
      hasLoadedPersistedRef.current = true
      setInitialLoad(false)
      return
    }

    console.log('[MaiaChat] Loading messages for thread:', threadId)
    setLoading(true)

    fetch(`/api/messages?threadId=${threadId}&limit=5&offset=0`)
      .then((res) => res.json())
      .then((data) => {
        console.log('[MaiaChat] Loaded', data.messages?.length, 'messages from DB')
        setPersistedMessages(data.messages || [])
        hasLoadedPersistedRef.current = true
        setLoading(false)
        setInitialLoad(false)
      })
      .catch((err) => {
        console.error('[MaiaChat] Failed to load messages:', err)
        setLoading(false)
        setInitialLoad(false)
      })
  }, [threadId, copilotMessages])

  // Auto-sync messages to backend after conversation updates
  useEffect(() => {
    // Don't sync during initial load or if no messages
    if (initialLoad || !copilotMessages || copilotMessages.length === 0) {
      setLoading
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

  useEffect(() => {
    const container = historyRef.current
    if (!container) return

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false
        return
      }
      const { scrollTop, scrollHeight, clientHeight } = container
      isUserScrollUpRef.current = scrollTop + clientHeight < scrollHeight - 8
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const container = historyRef.current
    if (!container) return
    if (isUserScrollUpRef.current) return
    isProgrammaticScrollRef.current = true
    container.scrollTop = container.scrollHeight
  }, [persistedMessages.length, copilotMessages.length, loading])

  const chat = (
    <React.Fragment>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="copilotKitMessages" ref={historyRef}>
          <div className="copilotKitMessagesContainer">
            <MessageHistory messages={persistedMessages} renderContainer={false} />
            <MessageHistory messages={copilotMessages} renderContainer={false} />
          </div>
        </div>
        <CopilotChat
          instructions={MAIA_INSTRUCTIONS}
          labels={{
            title: 'Maia',
            placeholder: 'How may I help you today?'
          }}
          className={chatConfig.className}
          Input={MaiaInput}
        />
      </Box>
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
