'use client'

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useChatContext } from '@copilotkit/react-ui'
import { useCopilotChatInternal } from '@copilotkit/react-core'
import './maia-input.css'

const MAX_NEWLINES = 6

function PersonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
    </svg>
  )
}

/**
 * Custom CopilotChat Input: pill-shaped field with avatar, placeholder
 * "How may I help you today?", send button, and disclaimer below.
 * Matches InputProps from @copilotkit/react-ui (no push-to-talk).
 */
export function MaiaInput({
  inProgress,
  onSend,
  chatReady = false,
  onStop,
  onUpload,
  hideStopButton = false
}) {
  const context = useChatContext()
  const { interrupt } = useCopilotChatInternal()
  const textareaRef = useRef(null)
  const [text, setText] = useState('')
  const [isComposing, setIsComposing] = useState(false)

  const handleDivClick = (e) => {
    const target = e.target
    if (target.closest('button')) return
    if (target.tagName === 'TEXTAREA') return
    textareaRef.current?.focus()
  }

  const send = useCallback(() => {
    if (inProgress) return
    onSend(text)
    setText('')
    textareaRef.current?.focus()
  }, [inProgress, onSend, text])

  // Minimal auto-resize for textarea
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const line = 24
    const max = line * MAX_NEWLINES
    ta.style.height = `${Math.min(ta.scrollHeight, max)}px`
  }, [])
  useEffect(() => { adjustHeight() }, [text, adjustHeight])

  const isInProgress = inProgress
  const { buttonIcon, buttonAlt } = useMemo(() => {
    if (!chatReady) return { buttonIcon: context.icons.spinnerIcon, buttonAlt: 'Loading' }
    return isInProgress && !hideStopButton && chatReady
      ? { buttonIcon: context.icons.stopIcon, buttonAlt: 'Stop' }
      : { buttonIcon: context.icons.sendIcon, buttonAlt: 'Send' }
  }, [isInProgress, chatReady, hideStopButton, context.icons.stopIcon, context.icons.sendIcon])

  const canSend = !isInProgress && text.trim().length > 0 && !interrupt
  const canStop = isInProgress && !hideStopButton
  const sendDisabled = !canSend && !canStop

  return (
    <div className="maiaInputContainer">
      <div
        className="maiaInputPill copilotKitInput"
        onClick={handleDivClick}
        role="presentation"
      >
        <div className="maiaInputAvatar" aria-hidden>
          <PersonIcon />
        </div>
        <textarea
          ref={textareaRef}
          className="maiaInputTextarea"
          placeholder={context.labels.placeholder ?? 'How may I help you today?'}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
              e.preventDefault()
              if (canSend) send()
            }
          }}
        />
        <div className="maiaInputControls copilotKitInputControls">
          {onUpload && (
            <button type="button" onClick={onUpload} className="copilotKitInputControlButton">
              {context.icons.uploadIcon}
            </button>
          )}
          <div style={{ flexGrow: 1 }} />
          <button
            type="button"
            disabled={sendDisabled}
            onClick={isInProgress && !hideStopButton ? onStop : send}
            data-copilotkit-in-progress={inProgress}
            data-test-id={inProgress ? 'copilot-chat-request-in-progress' : 'copilot-chat-ready'}
            className="copilotKitInputControlButton maiaInputSend"
            aria-label={buttonAlt}
          >
            {buttonIcon}
          </button>
        </div>
      </div>
      <p className="maiaInputDisclaimer">Maia learns continuously, but may miss some details.</p>
    </div>
  )
}
