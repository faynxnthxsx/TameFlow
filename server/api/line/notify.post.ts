import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { assigneeId, taskTitle, projectName } = body

  if (!assigneeId) {
    return { error: 'Missing assigneeId' }
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return { error: 'LINE token not configured' }
  }

  // Get the Supabase client (service role to bypass RLS if needed)
  const supabase = serverSupabaseServiceRole(event)

  // Fetch the user's LINE User ID
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('line_user_id')
    .eq('id', assigneeId)
    .single()

  const lineUserId = profile?.line_user_id

  if (!lineUserId) {
    return { error: 'User does not have a LINE User ID' }
  }

  try {
    await $fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: {
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: `🔔 มีงานใหม่มอบหมายให้คุณ!\n\nโปรเจกต์: ${projectName || 'ไม่ระบุ'}\nชื่องาน: ${taskTitle}\n\nอย่าลืมเข้าไปตรวจสอบใน TeamFlow นะครับ!`
          }
        ]
      }
    })
    return { success: true }
  } catch (e) {
    console.error('Failed to send push message', e)
    return { error: 'Failed to send message' }
  }
})
