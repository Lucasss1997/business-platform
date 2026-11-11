type EmailOffer = {
  p24: number;
  p12: number | null;
  email: string;
  phone: string;
  logoUrl: string;
  photoUrl: string;
  internal: boolean;
};

const website = "https://www.mltconsultants.co.uk";

function escape(value: string) {
  return value.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]!));
}

const money = (value: number) => new Intl.NumberFormat("en-GB", {
  style: "currency", currency: "GBP",
  minimumFractionDigits: 0, maximumFractionDigits: 2
}).format(value);

export function renderInstagridOfferEmail({
  p24, p12, email, phone, logoUrl, photoUrl, internal
}: EmailOffer) {
      const totals = `24-month total: ${money(p24 * 24)} excluding VAT.` +
        (p12 !== null ? ` 12-month total: ${money(p12 * 12)} excluding VAT.` : "");

      const alternative = p12 !== null
        ? `<p style="margin:0;padding:20px 0;font-size:19px;border-top:2px solid #287328">12-month option: <strong>${escape(money(p12))} + VAT / month</strong></p>`
        : "";

      const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Instagrid ONE rental - MLT Consultants</title>
</head>
<body style="margin:0;padding:0;background:#e9e7e2;color:#141b17;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">
Instagrid ONE: ${escape(money(p24))} + VAT per month over 24 months. No deposit. No upfront rental payment.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9e7e2">
<tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#f5f3ef">
<tr><td style="padding:18px 28px 4px">
<a href="${website}"><img src="${escape(logoUrl)}" width="100" alt="MLT Consultants" style="display:block;border:0;width:100px!important;max-width:100px!important;height:auto!important"></a>
</td></tr>
<tr><td style="padding:8px 28px 8px">
<h1 style="margin:0;font-size:38px;line-height:1.08;font-weight:900;letter-spacing:-1px">SERIOUS POWER.<br>SIMPLE RENTAL.</h1>
<div style="margin-top:20px;width:75px;height:6px;background:#287328"></div>
<h2 style="margin:25px 0 12px;font-size:27px">Instagrid ONE</h2>
<p style="margin:0;color:#287328;font-size:62px;line-height:1.1;font-weight:900">${escape(money(p24))}</p>
<p style="margin:8px 0 0;font-size:21px">+ VAT / month</p>
<p style="margin:8px 0 0;font-size:19px">24-month rental</p>
</td></tr>
<tr><td align="center" style="padding:0 20px">
<a href="${escape("mailto:" + email)}"><img src="${escape(photoUrl)}" width="380" alt="Instagrid ONE portable battery power unit" style="display:block;width:100%;max-width:380px;height:auto!important;border:0"></a>
</td></tr>
<tr><td style="padding:16px 28px 8px">
<p style="margin:0 0 22px;font-size:24px;line-height:1.3;font-weight:700">No deposit. No upfront<br>rental payment.</p>
<p style="margin:0 0 18px;font-size:17px;line-height:1.6;font-weight:700">3,600 W continuous &nbsp;|&nbsp; 18 kW peak &nbsp;|&nbsp; 20 kg</p>
<p style="margin:0 0 24px;font-size:18px;line-height:1.6">Portable, rechargeable power for your next job. Tell us what you need to power and let's discuss the right setup.</p>
${alternative}
</td></tr>
<tr><td style="padding:28px;background:#141b17;color:#ffffff">
<h2 style="margin:0 0 22px;font-size:25px;line-height:1.2">LET'S TALK PORTABLE POWER.</h2>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="background:#287328;border-radius:4px">
<a href="${escape("mailto:" + email + "?subject=Instagrid%20ONE%20rental%20enquiry")}" style="display:inline-block;padding:15px 21px;color:#ffffff;font-size:17px;font-weight:700;text-decoration:none">Enquire about rental</a>
</td></tr></table>
<p style="margin:24px 0 8px;font-size:16px;line-height:1.6;word-break:break-word"><a href="${escape("mailto:" + email)}" style="color:#ffffff">${escape(email)}</a></p>
${phone ? `<p style="margin:0 0 8px;font-size:16px">${escape(phone)}</p>` : ""}
<p style="margin:0 0 22px;font-size:16px"><a href="${website}" style="color:#ffffff">mltconsultants.co.uk</a></p>
<p style="margin:0 0 10px;font-size:12px;line-height:1.6">Rentals exclude VAT. Unit returned at the end of the agreed term. Warranty cover subject to applicable terms and exclusions. Full rental terms supplied with your quotation.</p>
<p style="margin:0;font-size:12px;line-height:1.6">${escape(totals)}</p>
</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;line-height:1.6;color:#526052">
${internal ? "Internal preview for the signed-in user only. No customer audience selected. This test does not send or approve your saved customer campaign." : ""}
</td></tr>
</table>
</td></tr></table>
</body></html>`;

      const plainText = [
        "MLT Consultants", "", "SERIOUS POWER. SIMPLE RENTAL.", "",
        "Instagrid ONE",
        `${money(p24)} + VAT per month. 24-month rental.`,
        "No deposit. No upfront rental payment.", "",
        "3,600 W continuous. 18 kW peak. 20 kg.",
        "Portable, rechargeable power for your next job.", "",
        ...(p12 !== null ? [`12-month option: ${money(p12)} + VAT per month.`, ""] : []),
        "Tell us what you need to power and let's discuss the right setup.",
        email, ...(phone ? [phone] : []), website, "",
        "Rentals exclude VAT. Unit returned at the end of the agreed term.",
        "Warranty cover subject to applicable terms and exclusions.",
        "Full rental terms supplied with your quotation.",
        totals, ...(internal ? ["", "Internal preview for the signed-in user only."] : [])
      ].join("\n");
  return { html, plainText };
}