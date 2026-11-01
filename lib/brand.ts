// The logo files in /public are small copies of /public/logo.png made for the site:
// logo-mark.png for light backgrounds and logo-mark-light.png (white arrow) for dark ones.
// The favicons are app/icon.png, app/favicon.ico and app/apple-icon.png.
export const BRAND = {
  name: 'WearSketch',
  logo: '/logo-mark.png',
  logoLight: '/logo-mark-light.png',
  tagline: 'Sketch it in 3D. We print it and deliver it to your door.',
  city: 'Delhi', // the only delivery area for now; shown only at checkout
  email: 'wearsketchh@gmail.com', // support email shown on the help, about, privacy and terms pages and in the footer
  whatsapp: '', // e.g. '919876543210' to show a WhatsApp button on the help page
};

// Our email as a link that opens a new message to us in Gmail (in a new tab).
export const gmailLink = (to = BRAND.email) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`;
