import { getChannelsFromServer } from '../services/subscription';

const IS_WEB = typeof window !== 'undefined' && !!window.document;
const PROXY_BASE = 'https://dashtv.onrender.com';

// En web el proxy va a Render. En native (APK) la URL se usa directa.
// Cada canal puede tener noProxy:true para saltar el proxy
function proxyUrl(url, noProxy) {
  if (!url || !IS_WEB || noProxy) return url;
  return `${PROXY_BASE}/proxy/video?url=${encodeURIComponent(url)}`;
}

const DEFAULTS = [
  { id: 'telefe', name: 'Telefe', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
  { id: 'dsports', name: 'DSports', country: 'Argentina', logo: null, streamUrl: null, note: 'Deportes en vivo' },
  { id: 'espn', name: 'ESPN', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
  { id: 'tycsports', name: 'TyC Sports', country: 'Argentina', logo: null, streamUrl: null, note: 'Disponible durante el Mundial' },
];

export const CHANNELS = [...DEFAULTS];

let _loaded = false;

export async function loadChannels(force = false) {
  if (_loaded && !force) return;
  _loaded = false;
  try {
    const server = await getChannelsFromServer();
    if (server && server.length > 0) {
      CHANNELS.length = 0;
      CHANNELS.push(...server.map((ch) => ({
        ...ch,
        streamUrl: proxyUrl(ch.streamUrl, ch.noProxy),
      })));
    }
  } catch {}
  _loaded = true;
}


