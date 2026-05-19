import { useCallback, useEffect, useRef, useState } from "react";
import { getStemUrl } from "../api/client";
import type {
  ChannelState,
  ChannelsState,
  SongResponse,
  StemName,
} from "../types";
import { STEM_NAMES, defaultChannelsState } from "../types";

interface AudioEngineState {
  loading: boolean;
  loadError: string | null;
  loaded: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  channels: ChannelsState;
  levels: Record<string, number>;
  pitch: number;
  speed: number;
  metronome: boolean;
  analyserNodes: Record<string, AnalyserNode>;
}

interface AudioEngineActions {
  loadBuffers: () => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (stem: StemName, value: number) => void;
  toggleMute: (stem: StemName) => void;
  toggleSolo: (stem: StemName) => void;
  resetMix: () => void;
  updatePitch: (value: number) => void;
  updateSpeed: (value: number) => void;
  setMetronome: (value: boolean) => void;
}

export type AudioEngine = AudioEngineState & AudioEngineActions;

export function useAudioEngine(song: SongResponse | null): AudioEngine {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [metronome, setMetronome] = useState(false);
  const [levels, setLevels] = useState<Record<string, number>>(
    Object.fromEntries(STEM_NAMES.map((s) => [s, 0])),
  );
  const [channels, setChannels] = useState<ChannelsState>(
    defaultChannelsState(),
  );

  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  const sourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const analyserNodesRef = useRef<Record<string, AnalyserNode>>({});
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);
  const playingRef = useRef(false);
  const durationRef = useRef(0);

  const clearAudioResources = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    STEM_NAMES.forEach((stem) => {
      try {
        sourcesRef.current[stem]?.stop();
        sourcesRef.current[stem]?.disconnect();
      } catch {
        /* empty */
      }
      sourcesRef.current[stem] = null!;
      buffersRef.current[stem] = null!;
      try {
        gainNodesRef.current[stem]?.disconnect();
        analyserNodesRef.current[stem]?.disconnect();
      } catch {
        /* empty */
      }
    });

    buffersRef.current = {};
    sourcesRef.current = {};
    gainNodesRef.current = {};
    analyserNodesRef.current = {};

    setLoaded(false);
    setPlaying(false);
    playingRef.current = false;
    setLevels(Object.fromEntries(STEM_NAMES.map((s) => [s, 0])));
    setCurrentTime(0);
    offsetRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      clearAudioResources();
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
      }
    };
  }, [song?.id, clearAudioResources]);

  const loadBuffers = useCallback(async () => {
    if (!song || song.status !== "done") return;
    clearAudioResources();
    setLoading(true);
    setLoadError(null);

    try {
      const AudioCtx = window.AudioContext;
      if (!ctxRef.current || ctxRef.current.state === "closed") {
        ctxRef.current = new AudioCtx();
      }
      const ctx = ctxRef.current;

      STEM_NAMES.forEach((stem) => {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserNodesRef.current[stem] = analyser;

        const gain = ctx.createGain();
        gain.gain.value = channels[stem].volume;

        analyser.connect(gain);
        gain.connect(ctx.destination);
        gainNodesRef.current[stem] = gain;
      });

      const fetches = STEM_NAMES.map(async (stem) => {
        const url = getStemUrl(song.id, stem);
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`No se pudo cargar ${stem}: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        buffersRef.current[stem] = audioBuffer;
        return audioBuffer;
      });

      const results = await Promise.all(fetches);
      setDuration(Math.max(...results.map((b) => b.duration)));
      setLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [song, clearAudioResources, channels]);

  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    STEM_NAMES.forEach((stem) => {
      try {
        sourcesRef.current[stem]?.stop();
      } catch {
        /* empty */
      }
      sourcesRef.current[stem] = null!;
    });
    setPlaying(false);
    playingRef.current = false;
    setLevels(Object.fromEntries(STEM_NAMES.map((s) => [s, 0])));
  }, []);

  const updateProgress = useCallback(() => {
    if (!ctxRef.current || !playingRef.current) return;

    const elapsed =
      ctxRef.current.currentTime - startTimeRef.current;
    const dur = durationRef.current;
    const newTime = Math.min(offsetRef.current + elapsed, dur);

    setCurrentTime(newTime);

    const newLevels: Record<string, number> = {};
    STEM_NAMES.forEach((stem) => {
      const analyser = analyserNodesRef.current[stem];
      if (analyser) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        newLevels[stem] = avg / 255;
      } else {
        newLevels[stem] = 0;
      }
    });
    setLevels(newLevels);

    if (newTime >= dur && dur > 0) {
      stopAll();
      offsetRef.current = 0;
      setCurrentTime(0);
      return;
    }
    rafRef.current = requestAnimationFrame(updateProgress);
  }, [stopAll]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const getEffectiveGain = useCallback(
    (stemName: StemName, channelState: ChannelsState) => {
      const hasSolo = STEM_NAMES.some((s) => channelState[s].solo);
      if (channelState[stemName].muted) return 0;
      if (hasSolo && !channelState[stemName].solo) return 0;
      return channelState[stemName].volume;
    },
    [],
  );

  const play = useCallback(() => {
    if (!loaded || playing) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    STEM_NAMES.forEach((stem) => {
      const buffer = buffersRef.current[stem];
      if (!buffer) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.detune.value = pitch * 100;

      source.connect(analyserNodesRef.current[stem]);
      source.start(0, offsetRef.current);
      sourcesRef.current[stem] = source;
    });

    startTimeRef.current = ctx.currentTime;
    setPlaying(true);
    playingRef.current = true;
    rafRef.current = requestAnimationFrame(updateProgress);
  }, [loaded, playing, speed, pitch, updateProgress]);

  const pause = useCallback(() => {
    if (!playing || !ctxRef.current) return;
    offsetRef.current +=
      ctxRef.current.currentTime - startTimeRef.current;
    stopAll();
  }, [playing, stopAll]);

  const seek = useCallback(
    (timeInSeconds: number) => {
      const wasPlaying = playing;
      if (wasPlaying) stopAll();

      offsetRef.current = Math.max(
        0,
        Math.min(timeInSeconds, duration),
      );
      setCurrentTime(offsetRef.current);

      if (wasPlaying) {
        setTimeout(() => {
          const ctx = ctxRef.current;
          if (!ctx) return;
          if (ctx.state === "suspended") ctx.resume();
          STEM_NAMES.forEach((stem) => {
            const buffer = buffersRef.current[stem];
            if (!buffer) return;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = speed;
            source.detune.value = pitch * 100;
            source.connect(analyserNodesRef.current[stem]);
            source.start(0, offsetRef.current);
            sourcesRef.current[stem] = source;
          });
          startTimeRef.current = ctx.currentTime;
          setPlaying(true);
          playingRef.current = true;
          rafRef.current = requestAnimationFrame(updateProgress);
        }, 50);
      }
    },
    [playing, duration, stopAll, updateProgress, speed, pitch],
  );

  const setVolume = useCallback(
    (stemName: StemName, value: number) => {
      setChannels((prev) => {
        const next = {
          ...prev,
          [stemName]: { ...prev[stemName], volume: value },
        };
        const effectiveGain = getEffectiveGain(stemName, next);
        if (gainNodesRef.current[stemName]) {
          gainNodesRef.current[stemName].gain.setTargetAtTime(
            effectiveGain,
            ctxRef.current?.currentTime || 0,
            0.01,
          );
        }
        return next;
      });
    },
    [getEffectiveGain],
  );

  const updatePitch = useCallback((newPitch: number) => {
    setPitch(newPitch);
    STEM_NAMES.forEach((s) => {
      if (sourcesRef.current[s]) {
        sourcesRef.current[s].detune.setTargetAtTime(
          newPitch * 100,
          ctxRef.current?.currentTime || 0,
          0.05,
        );
      }
    });
  }, []);

  const updateSpeed = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      const wasPlaying = playing;
      if (wasPlaying) pause();
      if (wasPlaying) setTimeout(play, 10);
    },
    [playing, pause, play],
  );

  const toggleMute = useCallback(
    (stemName: StemName) => {
      setChannels((prev) => {
        const next = {
          ...prev,
          [stemName]: { ...prev[stemName], muted: !prev[stemName].muted },
        } as ChannelsState;
        const effectiveGain = getEffectiveGain(stemName, next);
        if (gainNodesRef.current[stemName]) {
          gainNodesRef.current[stemName].gain.setTargetAtTime(
            effectiveGain,
            ctxRef.current?.currentTime || 0,
            0.01,
          );
        }
        return next;
      });
    },
    [getEffectiveGain],
  );

  const resetMix = useCallback(() => {
    const newState = defaultChannelsState();
    setChannels(newState);

    STEM_NAMES.forEach((s) => {
      const gain = newState[s].volume;
      if (gainNodesRef.current[s]) {
        gainNodesRef.current[s].gain.setTargetAtTime(
          gain,
          ctxRef.current?.currentTime || 0,
          0.05,
        );
      }
    });
  }, []);

  const toggleSolo = useCallback(
    (stemName: StemName) => {
      setChannels((prev) => {
        const next = {
          ...prev,
          [stemName]: { ...prev[stemName], solo: !prev[stemName].solo },
        } as ChannelsState;
        STEM_NAMES.forEach((s) => {
          const gain = getEffectiveGain(s, next);
          if (gainNodesRef.current[s]) {
            gainNodesRef.current[s].gain.setTargetAtTime(
              gain,
              ctxRef.current?.currentTime || 0,
              0.01,
            );
          }
        });
        return next;
      });
    },
    [getEffectiveGain],
  );

  return {
    loading,
    loadError,
    loaded,
    playing,
    currentTime,
    duration,
    channels,
    levels,
    pitch,
    speed,
    metronome,
    analyserNodes: analyserNodesRef.current,
    loadBuffers,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    toggleSolo,
    resetMix,
    updatePitch,
    updateSpeed,
    setMetronome,
  };
}
