'use client'

import React, { useState, useEffect } from 'react'
import { 
  Box, 
  IconButton, 
  Menu, 
  MenuItem, 
  ListItemText,
  Divider,
  Typography,
  Button
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import AddIcon from '@mui/icons-material/Add'
import ShareIcon from '@mui/icons-material/Share'
import { 
  getThreads, 
  getCurrentThreadId, 
  setCurrentThreadId,
  createNewThread,
  getShareableUrl
} from '../../../utils/threads'

export function ThreadSwitcher() {
  const [anchorEl, setAnchorEl] = useState(null)
  const [threads, setThreads] = useState([])
  const [currentThreadId, setCurrentThread] = useState(null)

  useEffect(() => {
    loadThreads()
  }, [])

  const loadThreads = () => {
    setThreads(getThreads())
    setCurrentThread(getCurrentThreadId())
  }

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
    loadThreads() // Refresh on open
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSwitchThread = (threadId) => {
    setCurrentThreadId(threadId)
    setCurrentThread(threadId)
    handleClose()
    // Reload page to switch thread
    window.location.reload()
  }

  const handleNewThread = () => {
    const newId = createNewThread()
    setCurrentThread(newId)
    handleClose()
    // Reload page with new thread
    window.location.reload()
  }

  const handleShare = async () => {
    if (!currentThreadId) return
    
    const shareUrl = getShareableUrl(currentThreadId)
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert('Share link copied to clipboard!')
    } catch (err) {
      // Fallback: show URL in prompt
      prompt('Share this URL:', shareUrl)
    }
    
    handleClose()
  }

  return (
    <Box>
      <IconButton
        onClick={handleClick}
        sx={{ color: '#fff' }}
        aria-label="thread menu"
      >
        <MenuIcon />
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 250, maxWidth: 350 }
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Conversations
          </Typography>
        </Box>
        
        <Divider />
        
        {/* Thread list */}
        {threads.length === 0 ? (
          <MenuItem disabled>
            <ListItemText primary="No threads yet" />
          </MenuItem>
        ) : (
          threads
            .sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed))
            .map((thread) => (
              <MenuItem
                key={thread.id}
                selected={thread.id === currentThreadId}
                onClick={() => handleSwitchThread(thread.id)}
              >
                <ListItemText
                  primary={thread.name}
                  secondary={new Date(thread.lastAccessed).toLocaleString()}
                  primaryTypographyProps={{
                    fontWeight: thread.id === currentThreadId ? 600 : 400
                  }}
                />
              </MenuItem>
            ))
        )}
        
        <Divider />
        
        {/* Actions */}
        <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleNewThread}
            fullWidth
            variant="outlined"
          >
            New Thread
          </Button>
          
          <IconButton
            size="small"
            onClick={handleShare}
            disabled={!currentThreadId}
            title="Share thread"
          >
            <ShareIcon fontSize="small" />
          </IconButton>
        </Box>
      </Menu>
    </Box>
  )
}
