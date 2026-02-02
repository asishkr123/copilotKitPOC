'use client'

// Re-export canonical MaiaChat from maia/chat. CoPilotProvider in layout
// supplies CopilotKit; do not wrap with another CopilotKit here.
export { MaiaChat } from '../../maia/chat/MaiaChat'
