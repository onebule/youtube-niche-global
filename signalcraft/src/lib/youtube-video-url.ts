export function parseYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);
    const isYouTubeHost = url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com') || url.hostname === 'youtu.be';
    if (!isYouTubeHost) return null;
    const id = url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/i)?.[1] || (url.hostname === 'youtu.be' ? url.pathname.match(/^\/([\w-]{11})/i)?.[1] : null);
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
