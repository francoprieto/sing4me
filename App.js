import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import Slider from '@react-native-community/slider';

const STORAGE_KEY = '@sing4me_songs';
const BACKGROUND_COLORS = ['#000000', '#ffffff', '#111111', '#071e3d', '#2b1f2b', '#1b3a31'];
const HIGHLIGHT_COLORS = ['#ffeb3b', '#ff8a65', '#67f3ff', '#91ff96', '#ff99ff', '#ffffff', 'transparent'];
const FONT_SIZES = [18, 22, 26, 30, 34, 38];

const emptySong = {
  id: null,
  title: '',
  lyrics: '',
  config: {
    backgroundColor: '#000000',
    fontSize: 26,
    lineHighlights: {},
    autoScroll: false,
    autoScrollSpeed: 0.5,
  },
};

export default function App() {
  const [songs, setSongs] = useState([]);
  const [screen, setScreen] = useState('list');
  const [activeSong, setActiveSong] = useState(null);
  const [draftSong, setDraftSong] = useState(emptySong);
  const [lyricsLines, setLyricsLines] = useState(['']);
  const [configValues, setConfigValues] = useState(emptySong.config);
  const [loading, setLoading] = useState(true);
  
  const viewScrollRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const currentScrollPositionRef = useRef(0);

  useEffect(() => {
    console.log('App mounted, loading songs...');
    loadSongs();
  }, []);

  useEffect(() => {
    if (screen === 'view') {
      activateKeepAwake();
      
      // Start auto-scroll if enabled
      if (activeSong?.config?.autoScroll && viewScrollRef.current) {
        currentScrollPositionRef.current = 0;
        const speed = (activeSong.config.autoScrollSpeed || 0.5) * 2; // Convert to pixels per interval
        
        autoScrollIntervalRef.current = setInterval(() => {
          currentScrollPositionRef.current += speed;
          viewScrollRef.current?.scrollTo({
            y: currentScrollPositionRef.current,
            animated: false,
          });
        }, 100);
      }
    } else {
      deactivateKeepAwake();
      
      // Clear auto-scroll interval
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    }
    
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    };
  }, [screen, activeSong?.config?.autoScroll, activeSong?.config?.autoScrollSpeed]);

  const sortedSongs = useMemo(() => [...songs].sort((a, b) => a.title.localeCompare(b.title)), [songs]);
  const safeAreaStyle = [
    styles.container,
    Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight || 0 } : null,
  ];

  async function loadSongs() {
    try {
      console.log('loadSongs: starting...');
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      console.log('loadSongs: retrieved from storage', saved);
      const parsed = saved ? JSON.parse(saved) : [];
      console.log('loadSongs: parsed songs', parsed);
      setSongs(parsed);
    } catch (error) {
      console.error('Failed to load songs', error);
    } finally {
      console.log('loadSongs: setting loading to false');
      setLoading(false);
    }
  }

  async function persistSongs(nextSongs) {
    try {
      setSongs(nextSongs);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSongs));
    } catch (error) {
      console.error('Failed to save songs', error);
    }
  }

  function openAddSong() {
    setDraftSong(emptySong);
    setLyricsLines(['']);
    setScreen('edit');
  }

  function openEditSong(song) {
    setDraftSong(song);
    setLyricsLines(song.lyrics.length ? song.lyrics.split(/\r?\n/) : ['']);
    setScreen('edit');
  }

  function openConfigureSong(song) {
    setActiveSong(song);
    setConfigValues({
      backgroundColor: song.config.backgroundColor || '#000000',
      fontSize: song.config.fontSize || 26,
      lineHighlights: song.config.lineHighlights || {},
      autoScroll: song.config.autoScroll || false,
      autoScrollSpeed: song.config.autoScrollSpeed || 0.5,
    });
    setScreen('configure');
  }

  function openViewSong(song) {
    setActiveSong(song);
    setScreen('view');
  }

  function updateDraftTitle(title) {
    setDraftSong(current => ({ ...current, title }));
  }

  function updateLyricsText(text) {
    const lines = text.split(/\r?\n/);
    setDraftSong(current => ({ ...current, lyrics: text }));
    setLyricsLines(lines.length ? lines : ['']);
  }

  function moveLine(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= lyricsLines.length) return;
    const nextLines = [...lyricsLines];
    const [line] = nextLines.splice(index, 1);
    nextLines.splice(nextIndex, 0, line);
    setLyricsLines(nextLines);
    setDraftSong(current => ({ ...current, lyrics: nextLines.join('\n') }));
  }

  function updateLineText(index, value) {
    const nextLines = [...lyricsLines];
    nextLines[index] = value;
    setLyricsLines(nextLines);
    setDraftSong(current => ({ ...current, lyrics: nextLines.join('\n') }));
  }

  function addNewLine(index) {
    const nextLines = [...lyricsLines];
    nextLines.splice(index + 1, 0, '');
    setLyricsLines(nextLines);
    setDraftSong(current => ({ ...current, lyrics: nextLines.join('\n') }));
  }

  function deleteLine(index) {
    if (lyricsLines.length === 1) {
      setLyricsLines(['']);
      setDraftSong(current => ({ ...current, lyrics: '' }));
      return;
    }
    const nextLines = [...lyricsLines];
    nextLines.splice(index, 1);
    setLyricsLines(nextLines);
    setDraftSong(current => ({ ...current, lyrics: nextLines.join('\n') }));
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync();
    if (!text) {
      Alert.alert('Clipboard is empty', 'Please copy the lyrics first.');
      return;
    }
    updateLyricsText(text);
  }

  function saveDraftSong() {
    const title = draftSong.title.trim();
    const lyrics = lyricsLines.join('\n').trim();
    if (!title) {
      Alert.alert('Missing title', 'Enter a song title before saving.');
      return;
    }
    if (!lyrics) {
      Alert.alert('Missing lyrics', 'Enter some lyrics before saving.');
      return;
    }
    const newSong = {
      ...draftSong,
      title,
      lyrics,
      config: draftSong.config || emptySong.config,
      id: draftSong.id || Date.now().toString(),
    };
    const nextSongs = songs.filter(song => song.id !== newSong.id).concat(newSong);
    persistSongs(nextSongs);
    setScreen('list');
  }

  function saveConfiguration() {
    const updatedSong = {
      ...activeSong,
      config: {
        backgroundColor: configValues.backgroundColor,
        fontSize: configValues.fontSize,
        lineHighlights: configValues.lineHighlights,
        autoScroll: configValues.autoScroll,
        autoScrollSpeed: configValues.autoScrollSpeed,
      },
    };
    const nextSongs = songs.map(song => (song.id === updatedSong.id ? updatedSong : song));
    persistSongs(nextSongs);
    setScreen('list');
  }

  function setHighlightColor(lineIndex, color) {
    setConfigValues(current => {
      const nextHighlights = { ...current.lineHighlights };
      if (color === 'transparent') {
        delete nextHighlights[lineIndex];
      } else {
        nextHighlights[lineIndex] = color;
      }
      return { ...current, lineHighlights: nextHighlights };
    });
  }

  function renderSongItem({ item }) {
    return (
      <View style={styles.songItem}>
        <Text style={styles.songTitle}>{item.title}</Text>
        <View style={styles.songActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openEditSong(item)}>
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => openConfigureSong(item)}>
            <Text style={styles.actionText}>Configure</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.viewButton} onPress={() => openViewSong(item)}>
            <Text style={styles.viewText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <Text style={styles.loadingText}>Loading songs…</Text>
      </SafeAreaView>
    );
  }

  if (screen === 'edit') {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>{draftSong.id ? 'Editar canción' : 'Nueva letra'}</Text>
          <Text style={styles.sectionNote}>Guarda letras y ajusta cada línea sin perder nada.</Text>
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={draftSong.title}
            onChangeText={updateDraftTitle}
            placeholder="Song title"
            placeholderTextColor="#999"
            style={styles.input}
          />

          <View style={styles.clipboardRow}>
            <Text style={styles.label}>Lyrics</Text>
            <TouchableOpacity style={styles.clipboardButton} onPress={pasteFromClipboard}>
              <Text style={styles.clipboardText}>Paste from clipboard</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={draftSong.lyrics}
            onChangeText={updateLyricsText}
            placeholder="Enter lyrics here"
            placeholderTextColor="#999"
            multiline
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
          />

          <Text style={styles.subheading}>Re-arrange lyrics</Text>
          {lyricsLines.map((line, index) => (
            <View key={`${index}-${line}`} style={styles.lineRow}>
              <TextInput
                value={line}
                onChangeText={value => updateLineText(index, value)}
                placeholder="Line text"
                placeholderTextColor="#999"
                style={styles.lineInput}
              />
              <View style={styles.lineControls}>
                <TouchableOpacity style={styles.lineControlButton} onPress={() => moveLine(index, -1)}>
                  <Text style={styles.controlText}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.lineControlButton} onPress={() => moveLine(index, 1)}>
                  <Text style={styles.controlText}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.lineControlButton} onPress={() => addNewLine(index)}>
                  <Text style={styles.controlText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.lineControlButton} onPress={() => deleteLine(index)}>
                  <Text style={styles.controlText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

        </ScrollView>
        <View style={styles.floatingActions} pointerEvents="box-none">
          <TouchableOpacity style={[styles.floatingBubble, styles.floatingBubblePrimary]} onPress={saveDraftSong}>
            <Text style={styles.floatingBubbleText}>💾</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.floatingBubble, styles.floatingBubbleSecondary]} onPress={() => setScreen('list')}>
            <Text style={styles.floatingBubbleText}>✕</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'configure' && activeSong) {
    const lines = activeSong.lyrics.length ? activeSong.lyrics.split(/\r?\n/) : [''];
    return (
      <SafeAreaView style={safeAreaStyle}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Configura {activeSong.title}</Text>
          <Text style={styles.sectionNote}>Cambia fondo, tamaño y destaca las líneas claves.</Text>
          <Text style={styles.label}>Background color</Text>
          <View style={styles.colorPalette}>
            {BACKGROUND_COLORS.map(color => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  configValues.backgroundColor === color && styles.colorSwatchSelected,
                ]}
                onPress={() => setConfigValues(current => ({ ...current, backgroundColor: color }))}
              />
            ))}
          </View>

          <Text style={styles.label}>Font size</Text>
          <View style={styles.fontSizeRow}>
            {FONT_SIZES.map(size => (
              <TouchableOpacity
                key={size}
                style={[styles.fontSizeButton, configValues.fontSize === size && styles.fontSizeSelected]}
                onPress={() => setConfigValues(current => ({ ...current, fontSize: size }))}
              >
                <Text style={styles.fontSizeText}>{size}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.subheading}>Highlight lines</Text>
          {lines.map((line, index) => (
            <View key={`${index}-${line}`} style={styles.highlightBlock}>
              <Text style={styles.highlightLine}>{line || ''}</Text>
              <View style={styles.colorPaletteSmall}>
                {HIGHLIGHT_COLORS.map(color => (
                  <TouchableOpacity
                    key={`${index}-${color}`}
                    style={[styles.highlightSwatch, { backgroundColor: color, borderColor: configValues.lineHighlights[index] === color ? '#fff' : '#555' }]}
                    onPress={() => setHighlightColor(index, color)}
                  />
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.subheading}>Auto Scroll</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable auto scroll</Text>
            <TouchableOpacity
              style={[styles.toggle, configValues.autoScroll && styles.toggleActive]}
              onPress={() => setConfigValues(current => ({ ...current, autoScroll: !current.autoScroll }))}
            >
              <Text style={styles.toggleText}>{configValues.autoScroll ? '✓' : ''}</Text>
            </TouchableOpacity>
          </View>

          {configValues.autoScroll && (
            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Scroll speed: {(configValues.autoScrollSpeed).toFixed(1)}x</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.1}
                maximumValue={0.9}
                step={0.1}
                value={configValues.autoScrollSpeed}
                onValueChange={(value) => setConfigValues(current => ({ ...current, autoScrollSpeed: value }))}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#555"
                thumbTintColor="#fff"
              />
            </View>
          )}

        </ScrollView>
        <View style={styles.floatingActions} pointerEvents="box-none">
          <TouchableOpacity style={[styles.floatingBubble, styles.floatingBubblePrimary]} onPress={saveConfiguration}>
            <Text style={styles.floatingBubbleText}>💾</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.floatingBubble, styles.floatingBubbleSecondary]} onPress={() => setScreen('list')}>
            <Text style={styles.floatingBubbleText}>✕</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'view' && activeSong) {
    const lines = activeSong.lyrics.length ? activeSong.lyrics.split(/\r?\n/) : [''];
    const viewConfig = activeSong.config || emptySong.config;
    const titleColor = viewConfig.backgroundColor === '#ffffff' ? '#111827' : '#ffffff';
    const viewSafeArea = [
      styles.viewContainer,
      { backgroundColor: viewConfig.backgroundColor || '#000' },
      Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight || 0 } : null,
    ];
    return (
      <SafeAreaView style={viewSafeArea}>
        <StatusBar
          barStyle={viewConfig.backgroundColor === '#ffffff' ? 'dark-content' : 'light-content'}
          backgroundColor={viewConfig.backgroundColor || '#000'}
        />
        <View style={[styles.viewHeader, styles.viewHeaderElevated]}>
          <Text style={[styles.viewTitle, { color: titleColor }]}>{activeSong.title}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => setScreen('list')}>
            <Text style={[styles.closeText, { color: titleColor }]}>Volver</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          ref={viewScrollRef}
          style={styles.viewScroll} 
          contentContainerStyle={styles.viewContent}
          scrollEventThrottle={16}
          onScroll={(event) => {
            currentScrollPositionRef.current = event.nativeEvent.contentOffset.y;
          }}
        >
          <Text style={[styles.viewSubtitle, { color: titleColor }]}>Desliza para navegar tus letras</Text>
          {lines.map((line, index) => {
            const highlight = viewConfig.lineHighlights?.[index];
            const useLightText = highlight && highlight !== 'transparent';
            return (
              <Text
                key={`${index}-${line}`}
                style={{
                  color: useLightText ? '#000' : '#fff',
                  backgroundColor: highlight === 'transparent' ? 'transparent' : highlight || 'transparent',
                  fontSize: viewConfig.fontSize || 26,
                  marginBottom: 0,
                  lineHeight: (viewConfig.fontSize || 26) * 1.1,
                }}
              >
                {line}
              </Text>
            );
          })}
        </ScrollView>
        <View style={[styles.floatingActions, styles.floatingActionsView]} pointerEvents="box-none">
          <TouchableOpacity style={[styles.floatingBubble, styles.floatingBubbleSecondary]} onPress={() => setScreen('list')}>
            <Text style={styles.floatingBubbleText}>✕</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={safeAreaStyle}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>Sing4Me</Text>
          <Text style={styles.appSubtitle}>{sortedSongs.length} canciones guardadas</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddSong}>
          <Text style={styles.addText}>+ Nueva letra</Text>
        </TouchableOpacity>
      </View>
      {sortedSongs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No hay canciones aún</Text>
          <Text style={styles.emptyText}>Comienza creando una letra para verla aquí.</Text>
        </View>
      ) : (
        <FlatList
          data={sortedSongs}
          keyExtractor={item => item.id}
          renderItem={renderSongItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
  },
  viewContainer: {
    flex: 1,
  },
  viewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  viewHeaderElevated: {
    backgroundColor: '#00000055',
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff22',
  },
  viewSubtitle: {
    fontSize: 14,
    marginBottom: 18,
    opacity: 0.85,
  },
  viewTitle: {
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff22',
    borderRadius: 10,
  },
  closeText: {
    color: '#fff',
    fontWeight: '600',
  },
  viewScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  viewContent: {
    paddingBottom: 32,
  },
  header: {
    marginTop: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  appTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
  },
  appSubtitle: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minWidth: 140,
  },
  addText: {
    color: '#fff',
    fontWeight: '700',
  },
  listContainer: {
    paddingBottom: 32,
  },
  songItem: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  songTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  songActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  songButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 10,
    marginBottom: 8,
  },
  smallButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  actionButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 10,
    marginBottom: 8,
  },
  viewButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  viewText: {
    color: '#111827',
    fontWeight: '700',
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#cbd5e1',
    fontSize: 16,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  formContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  heading: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionNote: {
    color: '#94a3b8',
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 18,
  },
  textArea: {
    minHeight: 140,
  },
  clipboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clipboardButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2563eb',
    borderRadius: 12,
  },
  clipboardText: {
    color: '#fff',
    fontWeight: '600',
  },
  subheading: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  lineRow: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  lineInput: {
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  lineControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  lineControlButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    minWidth: 42,
    alignItems: 'center',
  },
  controlText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    marginLeft: 8,
  },
  secondaryText: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '700',
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  colorSwatchSelected: {
    borderColor: '#ffffff',
    borderWidth: 3,
    shadowColor: '#ffffff',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  fontSizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  fontSizeButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fontSizeSelected: {
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  fontSizeText: {
    color: '#fff',
    fontWeight: '700',
  },
  floatingActions: {
    position: 'absolute',
    right: 16,
    top: 140,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  floatingActionsView: {
    top: undefined,
    bottom: 24,
  },
  floatingBubble: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  floatingBubblePrimary: {
    backgroundColor: '#10b981',
  },
  floatingBubbleSecondary: {
    backgroundColor: '#374151',
  },
  floatingBubbleText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  highlightBlock: {
    marginBottom: 14,
  },
  highlightLine: {
    color: '#e2e8f0',
    marginBottom: 10,
    fontSize: 16,
  },
  colorPaletteSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  highlightSwatch: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
  },
  loadingText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  toggleLabel: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '500',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  toggleActive: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  toggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sliderContainer: {
    marginBottom: 20,
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 8,
  },
});
