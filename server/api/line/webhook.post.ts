import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const events = body.events || []
  
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is missing')
    return { error: 'LINE token not configured' }
  }

  for (const ev of events) {
    if (ev.type === 'message' && ev.message.type === 'text') {
      const userId = ev.source.userId
      const replyToken = ev.replyToken

      try {
        await $fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: {
            replyToken: replyToken,
            messages: [
              {
                type: 'text',
                text: `ไอดีของคุณคือ:\n${userId}\n\nให้นำรหัสนี้ไปใส่ในหน้าตั้งค่าโปรไฟล์บน TeamFlow ได้เลยครับ!`
              }
            ]
          }
        })
      } catch (e) {
        console.error('Failed to reply to LINE message', e)
      }
    }
  }

  return 'ok'
})
