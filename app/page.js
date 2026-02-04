'use client'

import Box from '@mui/material/Box'
import { MaiaChat } from './maia/chat/MaiaChat'
import { ThreadSwitcher } from './components/thread-switcher/ThreadSwitcher'

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
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with thread switcher */}
      <Box
        sx={{
          bgcolor: '#1976d2',
          p: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        <ThreadSwitcher />
        <Box sx={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}>Maia</Box>
      </Box>

      {/* Chat area */}
      <Box sx={{ flex: 1 }}>
        <MaiaChat />
      </Box>
    </Box>
  )
}
