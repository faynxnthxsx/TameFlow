import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { defineEventHandler, getQuery, sendRedirect } from 'h3'
import { httpsPost } from '../../utils/line'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string

  if (!code) {
    return sendRedirect(event, '/profile?error=NoCode')
  }

  const user = await serverSupabaseUser(event)
  if (!user) {
    return sendRedirect(event, '/login?redirect=/profile')
  }

  const config = useRuntimeConfig()
  const redirectUri = `${getRequestURL(event).origin}/api/line/callback`

  try {
    // 1. Exchange code for tokens
    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.lineLoginChannelId,
      client_secret: config.lineLoginChannelSecret
    }).toString()

    const rawResponse = await httpsPost({
      url: 'https://api.line.me/oauth2/v2.1/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postData
    })

    const tokenResponse = JSON.parse(rawResponse) as { id_token?: string }

    if (!tokenResponse?.id_token) {
      console.error('Failed to get token:', tokenResponse)
      return sendRedirect(event, '/profile?error=TokenFailed')
    }

    // 2. Decode ID Token (JWT) to extract LINE user ID
    const base64Url = tokenResponse.id_token.split('.')[1]
    if (!base64Url) {
      return sendRedirect(event, '/profile?error=invalid_token')
    }
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
    const lineUserId = payload.sub

    if (!lineUserId) {
      return sendRedirect(event, '/profile?error=NoLineId')
    }

    // 3. Save lineUserId to user profile
    const supabase = await serverSupabaseClient(event)
    const uid = user.sub

    const { error } = await supabase
      .from('user_profiles')
      .update({ line_user_id: lineUserId })
      .eq('id', uid)

    if (error) {
      console.error('Error updating profile:', error)
      return sendRedirect(event, '/profile?error=DbUpdateFailed')
    }

    return sendRedirect(event, '/settings?line_connected=true')
  } catch (err) {
    console.error('LINE OAuth Callback Error:', err)
    return sendRedirect(event, '/profile?error=CallbackError')
  }
})
