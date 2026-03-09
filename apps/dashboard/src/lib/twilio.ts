import twilio from 'twilio'

/**
 * Send an SMS notification to all numbers in TWILIO_SEND_TO (pipe-delimited).
 * Best-effort: errors are logged but never thrown.
 */
export function sendSmsNotification(message: string): void {
  const sid = process.env.TWILIO_SID
  const token = process.env.TWILIO_TOKEN
  const from = process.env.TWILIO_NUMBER
  const sendTo = process.env.TWILIO_SEND_TO

  if (!sid || !token || !from || !sendTo) {
    console.warn('[Twilio] Missing env vars, skipping SMS notification')
    return
  }

  const client = twilio(sid, token)
  const numbers = sendTo.split('|').map(n => n.trim()).filter(Boolean)

  for (const number of numbers) {
    const to = number.startsWith('+') ? number : `+1${number}`
    client.messages
      .create({ body: message, from, to })
      .catch(err => console.error(`[Twilio] Failed to send SMS to ${to}:`, err.message))
  }
}
