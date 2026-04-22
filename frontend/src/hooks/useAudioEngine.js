/**
 * hooks/useAudioEngine.js
 *
 * Motor de audio multi-canal basado en Web Audio API.
 * Maneja 6 stems sincronizados con controles individuales de
 * volumen, mute y solo, más controles globales de play/pause/seek.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { getStemUrl } from '../api/client'

const STEMS = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']

const DEFAULT_CHANNEL_STATE = () =>
  Object.fromEntries(
    STEMS.map((s) => [s, { volume: 0.8, muted: false, solo: false }])
  )

export function useAudioEngine(song) {
  // ── Estado de carga ──────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loaded,   setLoaded]   = useState(false)

  // ── Estado de reproducción ────────────────────────────────────────────────
  const [playing,   setPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,  setDuration]  = useState(0)

  // ── Estado de canales ─────────────────────────────────────────────────────
  const [channels, setChannels] = useState(DEFAULT_CHANNEL_STATE)

  // ── Refs de Web Audio API ─────────────────────────────────────────────────
  const ctxRef      = useRef(null)   // AudioContext
  const buffersRef  = useRef({})     // AudioBuffer por stem
  const sourcesRef  = useRef({})     // AudioBufferSourceNode por stem
  const gainNodesRef = useRef({})    // GainNode por stem
  const startTimeRef = useRef(0)     // ctx.currentTime cuando se llamó play()
  const offsetRef   = useRef(0)      // offset de reproducción en segundos
  const rafRef      = useRef(null)   // requestAnimationFrame ID

  // ── Limpiar todo al cambiar de canción ────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAll()
      ctxRef.current?.close()
    }
  }, [song?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carga de buffers ──────────────────────────────────────────────────────
  const loadBuffers = useCallback(async () => {
    if (!song || song.status !== 'done') return
    setLoading(true)
    setLoadError(null)
    setLoaded(false)

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioCtx()
      }
      const ctx = ctxRef.current

      // Crear GainNodes
      STEMS.forEach((stem) => {
        const gain = ctx.createGain()
        gain.gain.value = channels[stem].volume
        gain.connect(ctx.destination)
        gainNodesRef.current[stem] = gain
      })

      // Cargar los 6 buffers en paralelo
      const fetches = STEMS.map(async (stem) => {
        const url = getStemUrl(song.id, stem)
        const response = await fetch(url)
        if (!response.ok) throw new Error(`No se pudo cargar ${stem}: ${response.status}`)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        buffersRef.current[stem] = audioBuffer
        return audioBuffer
      })

      const results = await Promise.all(fetches)
      setDuration(Math.max(...results.map((b) => b.duration)))
      setLoaded(true)
      console.log('[AudioEngine] ✅ Todos los stems cargados')
    } catch (err) {
      console.error('[AudioEngine] Error cargando buffers:', err)
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [song])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers internos ─────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    STEMS.forEach((stem) => {
      try { sourcesRef.current[stem]?.stop() } catch (_) {}
      sourcesRef.current[stem] = null
    })
    setPlaying(false)
  }, [])

  const updateProgress = useCallback(() => {
    if (!ctxRef.current) return
    const elapsed = ctxRef.current.currentTime - startTimeRef.current
    const newTime = Math.min(offsetRef.current + elapsed, duration)
    setCurrentTime(newTime)

    if (newTime >= duration && duration > 0) {
      stopAll()
      offsetRef.current = 0
      setCurrentTime(0)
      return
    }
    rafRef.current = requestAnimationFrame(updateProgress)
  }, [duration, stopAll])

  // ── Calcular gain efectivo (mute/solo) ────────────────────────────────────
  const getEffectiveGain = useCallback((stemName, channelState) => {
    const hasSolo = STEMS.some((s) => channelState[s].solo)
    if (channelState[stemName].muted) return 0
    if (hasSolo && !channelState[stemName].solo) return 0
    return channelState[stemName].volume
  }, [])

  // ── Play ─────────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    if (!loaded || playing) return
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    STEMS.forEach((stem) => {
      const buffer = buffersRef.current[stem]
      if (!buffer) return

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(gainNodesRef.current[stem])
      source.start(0, offsetRef.current)
      sourcesRef.current[stem] = source
    })

    startTimeRef.current = ctx.currentTime
    setPlaying(true)
    rafRef.current = requestAnimationFrame(updateProgress)
  }, [loaded, playing, updateProgress])

  // ── Pause ────────────────────────────────────────────────────────────────
  const pause = useCallback(() => {
    if (!playing) return
    offsetRef.current += ctxRef.current.currentTime - startTimeRef.current
    stopAll()
  }, [playing, stopAll])

  // ── Seek ─────────────────────────────────────────────────────────────────
  const seek = useCallback((timeInSeconds) => {
    const wasPlaying = playing
    if (wasPlaying) stopAll()

    offsetRef.current = Math.max(0, Math.min(timeInSeconds, duration))
    setCurrentTime(offsetRef.current)

    if (wasPlaying) {
      // Reiniciar desde la nueva posición
      setTimeout(() => {
        const ctx = ctxRef.current
        if (ctx.state === 'suspended') ctx.resume()
        STEMS.forEach((stem) => {
          const buffer = buffersRef.current[stem]
          if (!buffer) return
          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.connect(gainNodesRef.current[stem])
          source.start(0, offsetRef.current)
          sourcesRef.current[stem] = source
        })
        startTimeRef.current = ctx.currentTime
        setPlaying(true)
        rafRef.current = requestAnimationFrame(updateProgress)
      }, 50)
    }
  }, [playing, duration, stopAll, updateProgress])

  // ── Set Volume ────────────────────────────────────────────────────────────
  const setVolume = useCallback((stemName, value) => {
    setChannels((prev) => {
      const next = { ...prev, [stemName]: { ...prev[stemName], volume: value } }
      const effectiveGain = getEffectiveGain(stemName, next)
      if (gainNodesRef.current[stemName]) {
        gainNodesRef.current[stemName].gain.setTargetAtTime(
          effectiveGain, ctxRef.current?.currentTime || 0, 0.01
        )
      }
      return next
    })
  }, [getEffectiveGain])

  // ── Toggle Mute ───────────────────────────────────────────────────────────
  const toggleMute = useCallback((stemName) => {
    setChannels((prev) => {
      const next = {
        ...prev,
        [stemName]: { ...prev[stemName], muted: !prev[stemName].muted }
      }
      const effectiveGain = getEffectiveGain(stemName, next)
      if (gainNodesRef.current[stemName]) {
        gainNodesRef.current[stemName].gain.setTargetAtTime(
          effectiveGain, ctxRef.current?.currentTime || 0, 0.01
        )
      }
      return next
    })
  }, [getEffectiveGain])

  // ── Toggle Solo ───────────────────────────────────────────────────────────
  const toggleSolo = useCallback((stemName) => {
    setChannels((prev) => {
      const next = {
        ...prev,
        [stemName]: { ...prev[stemName], solo: !prev[stemName].solo }
      }
      // Actualizar gains de todos los canales
      STEMS.forEach((s) => {
        const gain = getEffectiveGain(s, next)
        if (gainNodesRef.current[s]) {
          gainNodesRef.current[s].gain.setTargetAtTime(
            gain, ctxRef.current?.currentTime || 0, 0.01
          )
        }
      })
      return next
    })
  }, [getEffectiveGain])

  return {
    // Estado
    loading, loadError, loaded,
    playing, currentTime, duration,
    channels,
    // Acciones
    loadBuffers,
    play, pause, seek,
    setVolume, toggleMute, toggleSolo,
  }
}
