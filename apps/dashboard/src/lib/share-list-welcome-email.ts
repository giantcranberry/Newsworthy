// Share List welcome email. Used both to send the email and to render the
// preview on the Share List settings page, so the two always match.
// No server-only imports: this module is also bundled for the client.

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildShareListWelcomeEmail({
  companyName,
  inviteMsg,
  recipientName,
  addedBy,
  highlightMessage = false,
}: {
  companyName: string
  inviteMsg: string
  recipientName?: string | null
  // Brand's primary PR contact, shown as "… on Newsworthy.ai by {name}" when set
  addedBy?: string | null
  // Preview only: color the brand's customizable message so it stands out
  highlightMessage?: boolean
}) {
  const brand = escapeHtml(companyName)
  const name = recipientName?.trim()
  // Greeting only when we know who it's for
  const greeting = name ? `<p>Hi ${escapeHtml(name)},</p>` : ''
  const message = escapeHtml(inviteMsg).replace(/\n/g, '<br/>')
  const by = addedBy?.trim() ? ` by ${escapeHtml(addedBy.trim())}` : ''
  const messageColor = highlightMessage ? '#0e7490' : '#333'

  return {
    subject: `You've been added to the ${companyName} Share List`,
    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${greeting}
            <p>You have been added to the <strong>${brand}</strong> Share List on Newsworthy.ai${by}.</p>
            <p style="color: ${messageColor}; background: #f9f9f9; padding: 12px; border-radius: 6px;">${message}</p>
            <p>Sincerely,<br/>${brand}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">
              You can unsubscribe from this list at any time by clicking the unsubscribe link in future emails.
            </p>
          </div>
        `,
  }
}
