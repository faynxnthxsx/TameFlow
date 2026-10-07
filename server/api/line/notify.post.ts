import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { linePush, buildFlexBubble, TF_PRIMARY } from '../../utils/line'

export default defineEventHandler(async (event) => {
  const { assigneeId, taskTitle, projectName, projectId } = await readBody(event)

  if (!assigneeId) return { error: 'Missing assigneeId' }

  const config = useRuntimeConfig()
  const token = config.lineBotChannelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return { error: 'LINE token not configured' }

  const supabase = serverSupabaseServiceRole(event)

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('line_user_id')
    .eq('id', assigneeId)
    .single()

  const lineUserId = (profile as any)?.line_user_id
  if (!lineUserId) return { error: 'User does not have a LINE User ID' }

  const taskUrl = projectId
    ? `http://localhost:3000/projects/${projectId}`
    : 'http://localhost:3000/'

  try {
    const bubble = buildFlexBubble({
      headerText: '🔔 มีงานใหม่มอบหมายให้คุณ!',
      bodyContents: [
        { type: 'text', text: `โปรเจกต์: ${projectName || 'ไม่ระบุ'}`, size: 'xs', color: '#888888', weight: 'bold' },
        { type: 'text', text: taskTitle, weight: 'bold', size: 'xl', margin: 'md', wrap: true },
        { type: 'separator', margin: 'lg' }
      ],
      footerLabel: 'ดูรายละเอียดงาน',
      footerUri: taskUrl
    })

    await linePush(token, lineUserId, [{ type: 'flex', altText: `🔔 มีงานใหม่: ${taskTitle}`, contents: bubble }])
    return { success: true }
  } catch (e) {
    console.error('Failed to send push message', e)
    return { error: 'Failed to send message' }
  }
})
