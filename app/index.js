import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import VideoPanel from '../components/VideoPanel';
import Sidebar from '../components/Sidebar';
import BottomBar from '../components/BottomBar';
import NavBar from '../components/NavBar';
import Countdown from '../components/Countdown';
import { loadChannels } from '../constants/channels';
import { fetchLiveMatches } from '../services/api';
import { COLORS } from '../constants/theme';

const COMPACT_BREAK = 800;

export default function LiveMatch() {
  const [matches, setMatches] = useState([]);
  const [matchA, setMatchA] = useState(null);
  const [matchB, setMatchB] = useState(null);
  const [matchC, setMatchC] = useState(null);
  const [channelA, setChannelA] = useState(null);
  const [channelB, setChannelB] = useState(null);
  const [channelC, setChannelC] = useState(null);
  const [focused, setFocused] = useState('A');
  const [layout, setLayout] = useState('full');
  const [giant, setGiant] = useState(false);
  const [focusKey, setFocusKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadChannels(true).then(() => {
        if (active) setFocusKey((k) => k + 1);
      });
      return () => { active = false; };
    }, [])
  );

  const matchARef = useRef(null);
  const matchBRef = useRef(null);

  const fetchData = useCallback(async () => {
    const data = await fetchLiveMatches();
    setMatches(data);

    setMatchA((prev) => {
      const match = prev ? data.find((m) => m.id === prev.id) : null;
      return match || data.find((m) => m.status === 'live') || data[0] || null;
    });

    setMatchB((prev) => {
      const match = prev ? data.find((m) => m.id === prev.id) : null;
      if (match) return match;
      const idA = matchARef.current?.id || data[0]?.id;
      return data.find((m) => m.id !== idA) || data[1] || null;
    });
  }, []);

  useEffect(() => { matchARef.current = matchA; }, [matchA]);
  useEffect(() => { matchBRef.current = matchB; }, [matchB]);

  useEffect(() => {
    if (!matchA || !matchB) return;
    setMatchC((prev) => {
      if (prev && matches.find((m) => m.id === prev.id)) return prev;
      const ids = [matchA.id, matchB.id];
      const third = matches.find((m) => !ids.includes(m.id));
      return third || matches[2] || null;
    });
  }, [matchA, matchB, matches]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const promoteToMain = useCallback((target) => {
    if (target === 'B') {
      setMatchA(matchB);
      setMatchB(matchA);
      setChannelA(channelB);
      setChannelB(channelA);
      setFocused('A');
    } else if (target === 'C') {
      setMatchA(matchC);
      setMatchC(matchA);
      setChannelA(channelC);
      setChannelC(channelA);
      setFocused('A');
    }
  }, [matchA, matchB, matchC, channelA, channelB, channelC]);

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < COMPACT_BREAK;
  const scale = Math.min(1, Math.max(0.7, windowWidth / 1920));
  const padding = compact ? 6 : 20 * scale;
  const gap = compact ? 6 : 12 * scale;

  const activeMatch = focused === 'A' ? matchA : focused === 'B' ? matchB : matchC;
  const hasContent = matches.some((m) => m.status !== 'upcoming');
  const bottomH = hasContent
    ? (compact ? 110 : 200 * scale)
    : (compact ? 100 : 150);

  return (
    <View style={[styles.container, { padding }]}>
      {!giant && <NavBar />}

      {/* Layout bar between NavBar and video */}
      {!giant && (
        <View style={[styles.layoutBar, { paddingVertical: compact ? 2 : 6 * scale, paddingHorizontal: compact ? 6 : 4 }]}>
          <Pressable
            style={[styles.layoutBtn, layout === 'full' && styles.layoutBtnActive, { paddingHorizontal: compact ? 8 : 12 * scale, paddingVertical: compact ? 4 : 6 * scale, borderRadius: compact ? 4 : 6 * scale }]}
            onPress={() => { setLayout('full'); setGiant(false); }}
            onFocus={() => { setLayout('full'); }}
          >
            <Text style={[styles.layoutLabel, layout === 'full' && styles.layoutLabelActive, { fontSize: compact ? 11 : 11 * scale }]}>FULL</Text>
          </Pressable>
          <Pressable
            style={[styles.layoutBtn, layout === 'split' && styles.layoutBtnActive, { paddingHorizontal: compact ? 8 : 12 * scale, paddingVertical: compact ? 4 : 6 * scale, borderRadius: compact ? 4 : 6 * scale }]}
            onPress={() => { setLayout('split'); setGiant(false); }}
            onFocus={() => { setLayout('split'); }}
          >
            <Text style={[styles.layoutLabel, layout === 'split' && styles.layoutLabelActive, { fontSize: compact ? 11 : 11 * scale }]}>SPLIT</Text>
          </Pressable>
          <Pressable
            style={[styles.layoutBtn, layout === 'triple' && styles.layoutBtnActive, { paddingHorizontal: compact ? 8 : 12 * scale, paddingVertical: compact ? 4 : 6 * scale, borderRadius: compact ? 4 : 6 * scale }]}
            onPress={() => { setLayout('triple'); setGiant(false); }}
            onFocus={() => { setLayout('triple'); }}
          >
            <Text style={[styles.layoutLabel, layout === 'triple' && styles.layoutLabelActive, { fontSize: compact ? 11 : 11 * scale }]}>1+2</Text>
          </Pressable>
        </View>
      )}

      {/* Main content: video + sidebar */}
      {!giant && (
        <View style={styles.mainRow}>
          {/* Video panels */}
          <View style={styles.videoArea}>

            {/* FULL: 1 big panel */}
            {layout === 'full' && (
              <View style={styles.fullPanel}>
                <VideoPanel
                  key={`full-${focusKey}`}
                  match={matchA} channelId={channelA} onChannelChange={setChannelA}
                  onFocus={() => setFocused('A')} focused muted={false}
                />
                <Pressable style={[styles.giantBtn, { top: compact ? 4 : 8, right: compact ? 4 : 8, paddingHorizontal: compact ? 6 : 10 * scale, paddingVertical: compact ? 4 : 6 * scale, borderRadius: compact ? 4 : 6 * scale }]} onPress={() => setGiant(true)}>
                  <Text style={[styles.giantBtnText, { fontSize: compact ? 12 : 13 * scale }]}>⛶</Text>
                </Pressable>
              </View>
            )}

            {/* SPLIT: 2 equal panels */}
            {layout === 'split' && (
              <View style={styles.splitRow}>
                <View style={styles.splitHalf}>
                  <VideoPanel
                    key={`split-a-${focusKey}`}
                    match={matchA} channelId={channelA} onChannelChange={setChannelA}
                    onFocus={() => setFocused('A')} focused={focused === 'A'} muted={false}
                  />
                </View>
                {!compact && <View style={styles.divider} />}
                <View style={styles.splitHalf}>
                  <VideoPanel
                    key={`split-b-${focusKey}`}
                    match={matchB} channelId={channelB} onChannelChange={setChannelB}
                    onFocus={() => setFocused('B')} focused={focused === 'B'} muted
                  />
                </View>
              </View>
            )}

            {/* TRIPLE: 1 big left + 2 small stacked right */}
            {layout === 'triple' && (
              <View style={styles.tripleRow}>
                <View style={styles.tripleMain}>
                  <VideoPanel
                    key={`triple-a-${focusKey}`}
                    match={matchA} channelId={channelA} onChannelChange={setChannelA}
                    onFocus={() => setFocused('A')} focused={focused === 'A'} muted={false}
                  />
                </View>
                {!compact && <View style={styles.dividerSm} />}
                <View style={styles.tripleSide}>
                  <View style={styles.tripleSmall}>
                    <VideoPanel
                      key={`triple-b-${focusKey}`}
                      match={matchB} channelId={channelB} onChannelChange={setChannelB}
                      onFocus={() => promoteToMain('B')} focused={false} muted
                    />
                  </View>
                  <View style={styles.tripleSmall}>
                    <VideoPanel
                      key={`triple-c-${focusKey}`}
                      match={matchC} channelId={channelC} onChannelChange={setChannelC}
                      onFocus={() => promoteToMain('C')} focused={false} muted
                    />
                  </View>
                </View>
              </View>
            )}

          </View>

          {/* Sidebar */}
          {!compact && <Sidebar match={activeMatch} matches={matches} />}
        </View>
      )}

      {/* Bottom: Countdown or BottomBar */}
      {!giant && (
        <View style={[styles.bottomRow, { height: bottomH }]}>
          {!hasContent ? (
            <View style={styles.countdownBox}>
              <Countdown />
            </View>
          ) : (
            <BottomBar compact={compact} margin={padding} />
          )}
        </View>
      )}

      {/* GIANT: fullscreen overlay */}
      {layout === 'full' && giant && (
        <View style={styles.giantContainer}>
          <VideoPanel
            key={`giant-${focusKey}`}
            match={matchA} channelId={channelA} onChannelChange={setChannelA}
            onFocus={() => setFocused('A')} focused muted={false}
          />
          <Pressable style={[styles.giantBtn, { top: compact ? 10 : 20, right: compact ? 10 : 20, paddingHorizontal: compact ? 8 : 12 * scale, paddingVertical: compact ? 5 : 8 * scale, borderRadius: compact ? 4 : 6 * scale }]} onPress={() => setGiant(false)}>
            <Text style={[styles.giantBtnText, { fontSize: compact ? 11 : 11 * scale }]}>SALIR</Text>
          </Pressable>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  layoutBar: {
    flexDirection: 'row',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.panel,
  },
  layoutBtn: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: '#333',
  },
  layoutBtnActive: { backgroundColor: COLORS.goldDim, borderColor: COLORS.gold },
  layoutLabel: { color: COLORS.dim, fontWeight: '600', letterSpacing: 1 },
  layoutLabelActive: { color: COLORS.gold },

  // Main row: video + sidebar
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  videoArea: {
    flex: 1,
    paddingBottom: 4,
  },

  // Full
  fullPanel: {
    flex: 1,
  },

  // Split
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  splitHalf: {
    flex: 1,
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 9,
  },

  // Triple
  tripleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tripleMain: {
    flex: 3,
  },
  tripleSide: {
    flex: 2,
    justifyContent: 'space-between',
  },
  tripleSmall: {
    flex: 1,
  },
  dividerSm: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 9,
  },

  // Giant
  giantBtn: {
    position: 'absolute',
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 110,
  },
  giantBtnText: { color: COLORS.gold, fontWeight: '600', letterSpacing: 1 },
  giantContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100,
    padding: 0,
  },

  // Bottom
  bottomRow: {
    flexShrink: 0,
  },
  countdownBox: {
    backgroundColor: COLORS.panel,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
});
