'use client'

import Box from '@mui/material/Box'
import { CopilotChat } from '@copilotkit/react-ui'
import { useRenderTools } from '@/components/copilot-tools/render-tools'
import { useFrontendTools } from '@/components/copilot-tools/frontend-tools'
import { mergeChatConfig } from '@/config/chat-ui'
import { MaiaInput } from '@/components/maia-chat/MaiaInput'
import React, { useState } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

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
