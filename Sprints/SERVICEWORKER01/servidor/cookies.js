export function lerCookie(req, nome) {
  for (const par of (req.get('Cookie') ?? '').split(';')) {
    const igual = par.indexOf('=');
    if (igual < 0 || par.slice(0, igual).trim() !== nome) continue;
    try { return decodeURIComponent(par.slice(igual + 1).trim()); } catch { return null; }
  }
  return null;
}
