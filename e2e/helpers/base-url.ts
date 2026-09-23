// Puerto y URL del servidor de desarrollo que levanta Playwright: lo comparten la configuración,
// el precalentamiento de rutas y cualquier helper que necesite pegarle al servidor sin un `page`.
export const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3000";
export const playwrightBaseUrl = `http://127.0.0.1:${playwrightPort}`;
