import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';

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

  useEffect(() => {
    loadSongs();
  }, []);

  useEffect(() => {
    if (screen === 'view') {
      activateKeepAwake();
    } else {
      deactivateKeepAwake();
    }
  }, [screen]);

  const sortedSongs = useMemo(() => [...songs].sort((a, b) => a.title.localeCompare(b.title)), [songs]);

  async function loadSongs() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      setSongs(parsed);
    } catch (error) {
      console.error('Failed to load songs', error);
    } finally {
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
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading songs…</Text>
      </SafeAreaView>
    );
  }

  if (screen === 'edit') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>{draftSong.id ? 'Edit song' : 'Add new song lyric'}</Text>
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

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.primaryButton, styles.saveButton]} onPress={saveDraftSong}>
              <Text style={styles.primaryText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.cancelButton]} onPress={() => setScreen('list')}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'configure' && activeSong) {
    const lines = activeSong.lyrics.length ? activeSong.lyrics.split(/\r?\n/) : [''];
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Configure {activeSong.title}</Text>
          <Text style={styles.label}>Background color</Text>
          <View style={styles.colorPalette}>
            {BACKGROUND_COLORS.map(color => (
              <TouchableOpacity
                key={color}
                style={[styles.colorSwatch, { backgroundColor: color, borderColor: configValues.backgroundColor === color ? '#fff' : '#333' }]}
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

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.primaryButton, styles.saveButton]} onPress={saveConfiguration}>
              <Text style={styles.primaryText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.cancelButton]} onPress={() => setScreen('list')}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'view' && activeSong) {
    const lines = activeSong.lyrics.length ? activeSong.lyrics.split(/\r?\n/) : [''];
    const viewConfig = activeSong.config || emptySong.config;
    return (
      <SafeAreaView style={[styles.viewContainer, { backgroundColor: viewConfig.backgroundColor || '#000' }]}> 
        <View style={styles.viewHeader}>
          <Text style={[styles.viewTitle, { fontSize: 20, color: viewConfig.backgroundColor === '#ffffff' ? '#000' : '#fff' }]}>{activeSong.title}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => setScreen('list')}>
            <Text style={styles.closeText}>Back</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.viewScroll} contentContainerStyle={styles.viewContent}>
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
                  marginBottom: 10,
                  lineHeight: (viewConfig.fontSize || 26) * 1.4,
                }}
              >
                {line}
              </Text>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>Sing4Me</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddSong}>
          <Text style={styles.addText}>+ Add new song lyric</Text>
        </TouchableOpacity>
      </View>
      {sortedSongs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No songs yet. Add a song lyric to begin.</Text>
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
    padding: 16,
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
  },
  appTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  viewButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
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
  emptyText: {
    color: '#cbd5e1',
    fontSize: 16,
  },
  formContainer: {
    flex: 1,
    paddingTop: 16,
  },
  heading: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 18,
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
    gap: 12,
    marginBottom: 16,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
  },
  fontSizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
});
