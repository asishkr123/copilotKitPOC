'use client'

import Box from '@mui/material/Box'
import { CopilotChat } from '@copilotkit/react-ui'
import { useCopilotMessagesContext } from '@copilotkit/react-core'
import { useRenderTools } from '../../components/copilot-tools/render-tools'
import { useFrontendTools } from '../../components/copilot-tools/frontend-tools'
import { mergeChatConfig } from '../../config/chat-ui'
import { MaiaInput } from '../../components/maia-chat/MaiaInput'
import { getOrCreateThreadId } from '../../../utils/threads'
import React, { useState, useEffect } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { TextMessage, ActionExecutionMessage, ResultMessage } from "@copilotkit/runtime-client-gql";

export function FullScreenSpinner({ label = 'Loading insights…' }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000, // above Drawer (1300) and FAB
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
  
  // Get thread ID and messages context
  const threadId = getOrCreateThreadId()
  const { messages, setMessages } = useCopilotMessagesContext()
  console.log("messages", messages)
  const [messagesLoaded, setMessagesLoaded] = useState(true) // Always true since we're not loading

  // Note: Message loading from localStorage/API doesn't work with InMemoryAgentRunner
  // The runner doesn't support injecting messages after initialization
  // Messages ARE being saved, but restoration requires a custom persistent runner
  
  // Load saved messages on mount - DISABLED because InMemoryAgentRunner doesn't support it
  // useEffect(() => {
  //   if (!threadId || messagesLoaded) return;
  //   console.log('[MaiaChat] Loading messages for thread:', threadId)
  //   fetch(`/api/messages?threadId=${threadId}`)
  //     .then(res => res.json())
  //     .then(data => {
  //       console.log('[MaiaChat] Loaded data:', data)
  //       if (data.messages && data.messages.length > 0) {
  //         const parsed = data.messages.map((msg) => {
  //           if (msg.type === "TextMessage") return new TextMessage({ ...msg });
  //           if (msg.type === "ActionExecutionMessage") return new ActionExecutionMessage({ ...msg });
  //           if (msg.type === "ResultMessage") return new ResultMessage({ ...msg });
  //           return msg;
  //         });
  //         console.log('[MaiaChat] Setting parsed messages:', parsed)
  //         setMessages(parsed);
  //       } else {
  //         console.log('[MaiaChat] No saved messages found')
  //       }
  //       setMessagesLoaded(true);
  //     })
  //     .catch((err) => {
  //       console.error('[MaiaChat] Failed to load messages:', err)
  //       setMessagesLoaded(true)
  //     });
  // }, [threadId, messagesLoaded, setMessages]);

  // Save messages whenever they change (with debounce)
  useEffect(() => {
    if (!threadId || !messagesLoaded || messages.length === 0) return;
    
    console.log('[MaiaChat] Messages changed, scheduling save. Count:', messages.length)
    
    // Debounce saves to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      // Serialize messages for storage
      const messagesToSave = messages.map(msg => ({
        ...msg,
        type: msg.constructor?.name || msg.type || 'TextMessage',
        id: msg.id,
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolCallId: msg.toolCallId,
        createdAt: msg.createdAt || new Date().toISOString()
      }));

      console.log('[MaiaChat] Saving messages:', messagesToSave)
      
      // Save to backend (fire and forget)
      fetch(`/api/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, messages: messagesToSave })
      })
        .then(res => res.json())
        .then(data => console.log('[MaiaChat] Save response:', data))
        .catch(err => console.error('[MaiaChat] Failed to save messages:', err));
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [messages, threadId, messagesLoaded]);

  const chat = (
    <React.Fragment>
      <CopilotChat
        instructions={MAIA_INSTRUCTIONS}
        // onInProgress={(inProgress) => setShowSpinner(inProgress)}
        labels={{
          title: 'Maia',
          placeholder: 'How may I help you today?'
        }}
        className={chatConfig.className}
        Input={MaiaInput}
        stream
      />
    </React.Fragment>
  )

  if (hasWrapper) {
    return (
      <Box className={chatConfig.wrapperClassName} sx={chatConfig.wrapperSx}>
        {chat}
      </Box>
    )
  }

  return chat
}
