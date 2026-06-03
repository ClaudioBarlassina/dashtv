import { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, useWindowDimensions } from 'react-native';
import { CHANNELS, extractDirectUrl } from '../constants/channels';
import { COLORS } from '../constants/theme';

async function loadHls() {
  if (typeof window !== 'undefined' && window.Hls) return window.Hls;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    s.onload = () => resolve(window.Hls);
    s.onerror = () => reject(new Error('Failed to load hls.js'));
    document.head.appendChild(s);
  });
}

function getStatusFromVideo(video) {
  if (!video) return 'idle';
  if (video.readyState === 0) return 'loading';
  if (video.paused && video.readyState > 0) return 'idle';
  if (video.readyState >= 3) return 'playing';
  if (video.error) return 'error';
  return 'loading';
}

export default function VideoPanel({ match, channelId, onChannelChange, onFocus, focused, muted = true }) {
  const { width: windowWidth } = useWindowDimensions();
  const scale = Math.min(1, Math.max(0.7, windowWidth / 1920));
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [hlsReady, setHlsReady] = useState(false);

  const channel = CHANNELS.find((c) => c.id === channelId) || CHANNELS[0];
  const streamUrl = channel?.streamUrl || null;
  const fallbackRef = useRef(false);

  useEffect(() => {
    loadHls().then(() => setHlsReady(true)).catch(() => {});
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || !hlsReady) return;

    let active = true;
    fallbackRef.current = false;

    async function setup(url) {
      const Hls = window.Hls;
      if (!Hls) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (active) {
            video.play().catch(() => {});
          }
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal && active) {
            // Fallback: si la URL proxeada falla, reintentar con URL directa
            if (!fallbackRef.current) {
              fallbackRef.current = true;
              const direct = extractDirectUrl(url);
              if (direct) {
                setup(direct);
                return;
              }
            }
            setStatus('error');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
      }
    }

    setup(streamUrl);

    return () => {
      active = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, hlsReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onEvent() { setStatus(getStatusFromVideo(video)); }
    function onError() { setStatus('error'); }

    video.addEventListener('loadstart', onEvent);
    video.addEventListener('canplay', onEvent);
    video.addEventListener('playing', onEvent);
    video.addEventListener('waiting', onEvent);
    video.addEventListener('stalled', onEvent);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('loadstart', onEvent);
      video.removeEventListener('canplay', onEvent);
      video.removeEventListener('playing', onEvent);
      video.removeEventListener('waiting', onEvent);
      video.removeEventListener('stalled', onEvent);
      video.removeEventListener('error', onError);
    };
  }, [streamUrl]);

  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, []);

  const handleChannelChange = useCallback((id) => {
    onChannelChange?.(id);
  }, [onChannelChange]);

  const isLive = match?.status === 'live';

  useEffect(() => {
    setStatus('loading');
  }, [streamUrl]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onFocus?.()}
      style={[styles.panel, focused && styles.panelFocused, { borderRadius: 8 * scale }]}
    >
      <View style={[styles.channelStrip, { height: 34 * scale, paddingHorizontal: 8 * scale, gap: 4 * scale }]}>
        {CHANNELS.map((ch) => {
          const active = ch.id === channelId;
          return (
            <Pressable
              key={ch.id}
              style={[styles.chBtn, active && styles.chBtnActive, { paddingHorizontal: 10 * scale, paddingVertical: 4 * scale, borderRadius: 4 * scale, gap: 3 * scale }]}
              onPress={() => handleChannelChange(ch.id)}
            >
              <Text style={[styles.chLabel, active && styles.chLabelActive, { fontSize: 11 * scale }]}>
                {ch.name.toUpperCase()}
              </Text>
              {active && status === 'playing' && (
                <Text style={[styles.liveDot, { fontSize: 7 * scale }]}>●</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {streamUrl ? (
        <video
          ref={videoRef}
          style={styles.video}
          autoPlay
          muted={muted}
          playsInline
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={[styles.phIcon, { fontSize: 28 * scale }]}>📡</Text>
          <Text style={[styles.phTitle, { fontSize: 16 * scale }]}>{channel.name}</Text>
          <Text style={[styles.phSub, { fontSize: 12 * scale }]}>{channel.note || ''}</Text>
          <Text style={[styles.phHint, { fontSize: 10 * scale, marginTop: 4 * scale }]}>Elegí un canal arriba</Text>
        </View>
      )}

      {streamUrl && status === 'loading' && (
        <View style={[styles.overlay, { top: 34 * scale }]}>
          <Text style={[styles.loadingText, { fontSize: 13 * scale }]}>Conectando...</Text>
        </View>
      )}
      {streamUrl && status === 'error' && (
        <View style={[styles.overlay, { top: 34 * scale }]}>
          <Text style={[styles.errorText, { fontSize: 14 * scale }]}>Sin señal</Text>
        </View>
      )}

      {match && match.status !== 'upcoming' && (
        <View style={[styles.badge, isLive && styles.badgeLive, { top: 42 * scale, left: 10 * scale, paddingHorizontal: 12 * scale, paddingVertical: 5 * scale, borderRadius: 4 * scale, gap: 6 * scale }]}>
          {isLive && <View style={[styles.badgeDot, { width: 8 * scale, height: 8 * scale, borderRadius: 4 * scale }]} />}
          <Text style={[styles.badgeText, { fontSize: 10 * scale }]}>
            {isLive ? 'EN VIVO' : 'FINALIZADO'}
          </Text>
        </View>
      )}

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  panelFocused: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  channelStrip: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  chBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chBtnActive: { backgroundColor: COLORS.goldDim },
  chLabel: { color: COLORS.dim, fontWeight: '600', letterSpacing: 1 },
  chLabelActive: { color: COLORS.gold },
  liveDot: { color: COLORS.live },
  video: { flex: 1, width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  phIcon: {},
  phTitle: { color: COLORS.white, fontWeight: 'bold' },
  phSub: { color: COLORS.dim },
  phHint: { color: COLORS.gold, fontStyle: 'italic' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingText: { color: COLORS.gold, fontWeight: '600' },
  errorText: { color: COLORS.dim, fontWeight: '600' },
  badge: {
    position: 'absolute',
    backgroundColor: COLORS.panel,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeLive: { backgroundColor: COLORS.live },
  badgeDot: { backgroundColor: '#fff' },
  badgeText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
  infoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoText: { color: COLORS.dim, fontWeight: '600' },
  infoDate: { color: COLORS.gold, fontWeight: '700' },

});