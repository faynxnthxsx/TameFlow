/**
 * Shared LINE API utilities for TeamFlow.
 *
 * Consolidates the duplicated `node:https` request pattern and Flex Message
 * construction that was previously copy-pasted across notify, webhook, and
 * callback endpoints.
 *
 * Uses `node:https` instead of `$fetch`/`undici` to work around a known
 * Node.js issue where `undici` times out resolving `api.line.me` over IPv6
 * on Windows.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** TeamFlow brand colour used across Flex Messages. */
export const TF_PRIMARY = '#0ea5e9'

/** LINE brand green. */
export const LINE_GREEN = '#00B900'

// ─── HTTPS helper ────────────────────────────────────────────────────────────

interface HttpsPostOptions {
  url: string
  headers: Record<string, string>
  body: string
}

/**
 * Lightweight POST wrapper around `node:https`.
 * Returns the raw response body as a string.
 */
export async function httpsPost(opts: HttpsPostOptions): Promise<string> {
  const https = await import('node:https')

  return new Promise<string>((resolve, reject) => {
    const req = https.request(opts.url, {
      method: 'POST',
      headers: {
        ...opts.headers,
        'Content-Length': String(Buffer.byteLength(opts.body))
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => (data += chunk))
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.write(opts.body)
    req.end()
  })
}

// ─── LINE Messaging helpers ──────────────────────────────────────────────────

/**
 * Send a reply message via the LINE Reply API.
 */
export async function lineReply(token: string, replyToken: string, messages: unknown[]) {
  const body = JSON.stringify({ replyToken, messages })
  return httpsPost({
    url: 'https://api.line.me/v2/bot/message/reply',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body
  })
}

/**
 * Send a push message via the LINE Push API.
 */
export async function linePush(token: string, to: string, messages: unknown[]) {
  const body = JSON.stringify({ to, messages })
  return httpsPost({
    url: 'https://api.line.me/v2/bot/message/push',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body
  })
}

// ─── Flex Message builders ───────────────────────────────────────────────────

/** Build a simple Flex bubble with a coloured header, body rows, and an optional footer button. */
export function buildFlexBubble(opts: {
  headerText: string
  bodyContents: unknown[]
  footerLabel?: string
  footerUri?: string
}) {
  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: TF_PRIMARY,
      contents: [{ type: 'text', text: opts.headerText, color: '#ffffff', weight: 'bold', size: 'md' }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: opts.bodyContents
    }
  }

  if (opts.footerLabel && opts.footerUri) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [{
        type: 'button',
        style: 'primary',
        color: TF_PRIMARY,
        action: { type: 'uri', label: opts.footerLabel, uri: opts.footerUri }
      }]
    }
  }

  return bubble
}

/** Create a horizontal key-value row for a Flex body. */
export function flexRow(label: string, value: string, valueColor?: string) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'md',
    contents: [
      { type: 'text', text: label, color: '#888888', size: 'sm' },
      { type: 'text', text: value, weight: 'bold', align: 'end', ...(valueColor ? { color: valueColor } : {}) }
    ]
  }
}
