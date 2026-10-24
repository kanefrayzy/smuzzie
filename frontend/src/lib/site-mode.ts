// The site has two modes: design (Smuzzie's graphic design, the original site)
// and dev (website development). The mode is part of the URL so both versions
// are indexable and shareable: /dev and anything under it is dev mode.

export type SiteMode = 'design' | 'dev';

export const MODE_HOME: Record<SiteMode, string> = { design: '/', dev: '/dev' };

// Keep in sync with --accent in globals.css
export const MODE_COLOR: Record<SiteMode, string> = { design: '#e63946', dev: '#34f596' };

export function modeFromPath(pathname: string | null): SiteMode {
  return pathname === '/dev' || pathname?.startsWith('/dev/') ? 'dev' : 'design';
}
