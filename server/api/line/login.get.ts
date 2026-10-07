import { defineEventHandler, getCookie, setCookie, sendRedirect } from 'h3'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  
  // Create a random state for security
  const state = Math.random().toString(36).substring(7)
  setCookie(event, 'line_auth_state', state, { maxAge: 60 * 10 }) // 10 mins

  const redirectUri = `${getRequestURL(event).origin}/api/line/callback`
  
  const lineLoginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
  lineLoginUrl.searchParams.append('response_type', 'code')
  lineLoginUrl.searchParams.append('client_id', config.lineLoginChannelId)
  lineLoginUrl.searchParams.append('redirect_uri', redirectUri)
  lineLoginUrl.searchParams.append('state', state)
  lineLoginUrl.searchParams.append('scope', 'profile openid')
  lineLoginUrl.searchParams.append('bot_prompt', 'normal') // Prompt user to add bot!

  return sendRedirect(event, lineLoginUrl.toString())
})
