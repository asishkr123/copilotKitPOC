'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import ChatIcon from '@mui/icons-material/Chat'
import Drawer from '@mui/material/Drawer'
import { MaiaChat } from '@/maia/chat/MaiaChat'

export default function MaiaFabPage() {
  const [open, setOpen] = useState(false)

  const handleClose = (_, reason) => {
    // Allow backdrop click and escape key
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      setOpen(false)
    }
  }

  return (
    <>
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300 }}
        onClick={() => setOpen(true)}
      >
        <ChatIcon />
      </Fab>

      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        ModalProps={{
          keepMounted: true // smoother open/close, safer for chat
        }}
        PaperProps={{ sx: { width: 420 } }}
      >
        <Box p={2} height="100%">
          <MaiaChat />
        </Box>
      </Drawer>
    </>
  )
}
