'use client'

import Box from '@mui/material/Box'
import { MaiaChat } from './maia/chat/MaiaChat'

export function AgentStatus() {
  const { agent } = userAgent()
  return (
    <div>
      {agent.isRunning ? (
        <div>
          <div className="spinner" />
          <span>Agent is processing...</span>
        </div>
      ) : (
        <span>Ready</span>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Box p={3}>
      <MaiaChat />
    </Box>
  )
}
