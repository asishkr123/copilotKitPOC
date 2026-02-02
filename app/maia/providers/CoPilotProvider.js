'use client'

import { CopilotKit } from '@copilotkit/react-core'
import '@copilotkit/react-ui/styles.css'
import { getOrCreateThreadId } from '../../../utils/threads'

export const CopilotProvider = ({ children }) => {
  const threadId = getOrCreateThreadId()
  return (
    <CopilotKit
      threadId={threadId}
      enableInspector={true}
      runtimeUrl={`/api/chat?threadId=${threadId}`}
      agent="default"
    >
      {children}
    </CopilotKit>
  )
}
