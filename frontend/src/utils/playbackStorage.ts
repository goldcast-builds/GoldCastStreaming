import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_KEY_PREFIX = '@goldcast_playback_progress_';

export interface WatchProgress {
  streamId: string | number;
  title?: string;
  poster?: string;
  positionMillis: number;
  durationMillis: number;
  updatedAt: number;
}

// Salva a minutagem do filme ou série
export async function savePlaybackPosition(
  streamId: string | number,
  positionMillis: number,
  durationMillis: number,
  metadata?: { title?: string; poster?: string }
) {
  try {
    // Se faltarem menos de 30 segundos ou passou de 95% do filme, considera concluído e limpa
    if (durationMillis > 0 && positionMillis / durationMillis > 0.95) {
      await AsyncStorage.removeItem(`${PROGRESS_KEY_PREFIX}${streamId}`);
      return;
    }

    const data: WatchProgress = {
      streamId,
      positionMillis,
      durationMillis,
      updatedAt: Date.now(),
      ...metadata,
    };

    await AsyncStorage.setItem(`${PROGRESS_KEY_PREFIX}${streamId}`, JSON.stringify(data));
  } catch (error) {
    console.error('Erro ao salvar progresso:', error);
  }
}

// Recupera a minutagem salva
export async function getPlaybackPosition(streamId: string | number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`${PROGRESS_KEY_PREFIX}${streamId}`);
    if (!raw) return 0;
    const data: WatchProgress = JSON.parse(raw);
    return data.positionMillis || 0;
  } catch {
    return 0;
  }
}