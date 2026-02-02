/**
 * Chat UI config for client customization (CSS and layout).
 * Use when mounting MaiaChat: <MaiaChat chatConfig={myChatConfig} />
 *
 * @example
 * // Apply custom class to the chat root and a styled wrapper
 * const chatConfig = {
 *   className: 'my-chat-root',
 *   wrapperClassName: 'my-chat-wrapper',
 *   wrapperSx: { maxWidth: 480, borderRadius: 2, boxShadow: 2 }
 * }
 */

/**
 * @typedef {{
 *   className?: string
 *   wrapperClassName?: string
 *   wrapperSx?: object
 * }} ChatUIConfig
 */

/** @type {ChatUIConfig} */
export const defaultChatConfig = {
  className: undefined,
  wrapperClassName: undefined,
  wrapperSx: undefined
}

/**
 * Merges a partial config with defaults. Values in `overrides` take precedence.
 * @param {Partial<ChatUIConfig>} [overrides]
 * @returns {ChatUIConfig}
 */
export function mergeChatConfig(overrides) {
  if (!overrides || typeof overrides !== 'object') return { ...defaultChatConfig }
  return {
    className: overrides.className ?? defaultChatConfig.className,
    wrapperClassName: overrides.wrapperClassName ?? defaultChatConfig.wrapperClassName,
    wrapperSx: overrides.wrapperSx ?? defaultChatConfig.wrapperSx
  }
}
