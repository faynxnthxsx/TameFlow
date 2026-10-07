import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { lineReply, buildFlexBubble, flexRow, TF_PRIMARY } from '../../utils/line'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const events = body.events || []

  const config = useRuntimeConfig()
  const token = config.lineBotChannelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return { error: 'LINE token not configured' }

  const supabase = serverSupabaseServiceRole(event)

  for (const ev of events) {
    if (ev.type !== 'message' || ev.message.type !== 'text') continue

    const lineUserId = ev.source.userId
    const replyToken = ev.replyToken
    const userMessage: string = ev.message.text.trim()

    // Default reply
    let replyMessage: unknown = {
      type: 'text',
      text: '💡 พิมพ์ "สรุปงาน" หรือ "งานค้าง" เพื่อดูงานที่คุณต้องทำนะครับ'
    }

    const isTaskQuery = userMessage.includes('งาน') || userMessage.toLowerCase().includes('task')

    if (isTaskQuery) {
      const origin = getRequestURL(event).origin
      replyMessage = await buildTaskSummary(supabase, lineUserId, origin)
    }

    try {
      await lineReply(token, replyToken, [replyMessage])
    } catch (e) {
      console.error('Failed to reply to LINE message', e)
    }
  }

  return 'ok'
})

// ─── Task summary builder ────────────────────────────────────────────────────

async function buildTaskSummary(supabase: any, lineUserId: string, origin: string): Promise<unknown> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .eq('line_user_id', lineUserId)
    .single()

  if (!profile) {
    return {
      type: 'text',
      text: '❌ ไม่พบข้อมูลบัญชีของคุณครับ\nกรุณาไปที่เว็บ TeamFlow > หน้า Settings แล้วกด "เชื่อมต่อบัญชี LINE" ก่อนนะครับ'
    }
  }

  const { data: tasks } = await supabase
    .from('tasks')
    .select('title, status, due_date, project:projects(name)')
    .eq('assignee_id', profile.id)
    .neq('status', 'done')

  if (!tasks || tasks.length === 0) {
    return {
      type: 'flex',
      altText: '🎉 ไม่มีงานค้าง',
      contents: buildFlexBubble({
        headerText: '🎉 เยี่ยมมาก!',
        bodyContents: [
          { type: 'text', text: `คุณ ${profile.display_name} ไม่มีงานค้างเลยครับ\nพักผ่อนได้เต็มที่!`, wrap: true }
        ]
      })
    }
  }

  return {
    type: 'flex',
    altText: '📋 สรุปงานของคุณ',
    contents: buildSummaryBubble(profile.display_name, tasks, origin)
  }
}

// ─── Flex summary card ───────────────────────────────────────────────────────

function buildSummaryBubble(displayName: string, tasks: any[], origin: string) {
  const todo = tasks.filter(t => t.status === 'todo').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length

  const today = new Date()
  const nearDeadline = tasks.filter(t => {
    if (!t.due_date) return false
    const diffDays = Math.ceil((new Date(t.due_date).getTime() - today.getTime()) / 86_400_000)
    return diffDays >= 0 && diffDays <= 3
  })

  // Body contents
  const bodyContents: unknown[] = [
    flexRow('งานค้างทั้งหมด:', `${tasks.length} งาน`, TF_PRIMARY),
    flexRow('🔹 ยังไม่เริ่ม (To Do)', `${todo}`),
    flexRow('⏳ กำลังทำ (In Progress)', `${inProgress}`),
    { type: 'separator', margin: 'xl' }
  ]

  // Near-deadline section
  if (nearDeadline.length > 0) {
    bodyContents.push({ type: 'text', text: '⚠️ งานที่ต้องรีบส่ง (ใน 3 วัน)', weight: 'bold', color: '#ef4444', margin: 'xl', size: 'sm' })
    nearDeadline.slice(0, 3).forEach(t => {
      const pName = Array.isArray(t.project) ? t.project[0]?.name : t.project?.name
      bodyContents.push({
        type: 'box', layout: 'vertical', margin: 'md',
        contents: [
          { type: 'text', text: `▪ ${t.title}`, weight: 'bold', size: 'sm', wrap: true },
          { type: 'text', text: pName || 'TeamFlow', size: 'xs', color: '#888888' }
        ]
      })
    })
    if (nearDeadline.length > 3) {
      bodyContents.push({ type: 'text', text: `...และอื่นๆ อีก ${nearDeadline.length - 3} งาน`, size: 'xs', color: '#888888', margin: 'md' })
    }
  } else {
    bodyContents.push({ type: 'text', text: '✅ ไม่มีงานที่ใกล้ถึงกำหนดส่ง', weight: 'bold', color: '#22c55e', margin: 'xl', size: 'sm' })
  }

  return buildFlexBubble({
    headerText: `📋 สรุปงานของคุณ ${displayName}`,
    bodyContents,
    footerLabel: 'เข้าสู่เว็บ TeamFlow',
    footerUri: origin
  })
}
