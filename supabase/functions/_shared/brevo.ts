// BrevoService — envoi d'emails transactionnels. BACKEND UNIQUEMENT.
// La clé BREVO_API_KEY doit être configurée comme secret Supabase Edge Function :
//   supabase secrets set BREVO_API_KEY=xxxx
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

interface LicenseEmailData { plan: string; expiresAt: string }

export async function sendLicenseEmail(toEmail: string, data: LicenseEmailData) {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('EMAIL_SENDER') || 'support@mbeuk.us';
  const senderName = Deno.env.get('EMAIL_SENDER_NAME') || 'MbeukAgri';
  if (!apiKey) { console.warn('[BrevoService] BREVO_API_KEY manquant — email non envoyé'); return; }

  const expiresDate = new Date(data.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `
  <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;background:#F0FBF4;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(10,31,16,.08)">
      <div style="background:linear-gradient(160deg,#0A1A0F,#1B7F4B);padding:28px;text-align:center;color:#fff">
        <div style="font-size:28px;margin-bottom:6px">🌾</div>
        <div style="font-weight:700;font-size:18px">MbeukAgri</div>
      </div>
      <div style="padding:28px">
        <h2 style="color:#0A0A0B;font-size:20px;margin:0 0 12px">Votre licence a été activée avec succès 🎉</h2>
        <p style="color:#44444A;font-size:14px;line-height:1.6">Félicitations ! Votre abonnement <strong>${data.plan}</strong> est maintenant actif jusqu'au <strong>${expiresDate}</strong>.</p>
        <div style="background:#F0FBF4;border-radius:8px;padding:14px 16px;margin:20px 0;font-size:13px;color:#163D22">
          <div><strong>Compte :</strong> ${toEmail}</div>
          <div><strong>Plan :</strong> ${data.plan}</div>
          <div><strong>Expire le :</strong> ${expiresDate}</div>
        </div>
        <a href="${Deno.env.get('APP_URL') || 'https://www.mbeuk.us'}" style="display:inline-block;background:#1B7F4B;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px">Ouvrir l'application</a>
        <p style="color:#9B9BA4;font-size:12px;margin-top:24px">Besoin d'aide ? Contactez-nous sur WhatsApp : <a href="https://wa.me/237676571765" style="color:#1B7F4B">wa.me/237676571765</a></p>
      </div>
    </div>
  </div>`;

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail }],
      subject: 'Votre licence a été activée avec succès',
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[BrevoService] échec envoi email', res.status, errText);
    // retry simple (une tentative supplémentaire)
    await new Promise((r) => setTimeout(r, 1500));
    await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { email: senderEmail, name: senderName }, to: [{ email: toEmail }], subject: 'Votre licence a été activée avec succès', htmlContent: html }),
    }).catch(() => {});
  }
}
