/**
 * api/client.js — Cliente Axios centralizado para la Music Hub API
 */
import axios from 'axios'

const BASE_URL = '/api'   // Proxeado por Vite hacia http://localhost:8000

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Interceptor de errores ─────────────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg = error.response?.data?.detail || error.message || 'Error desconocido'
    console.error('[API Error]', msg)
    return Promise.reject(new Error(msg))
  }
)

// ── Tracks ────────────────────────────────────────────────────────────────
export const uploadSong = (formData, onProgress) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })

export const fetchTracks = () => api.get('/tracks')

export const fetchTrack  = (id) => api.get(`/tracks/${id}`)

export const fetchStatus = (id) => api.get(`/tracks/${id}/status`)

export const deleteTrack = (id) => api.delete(`/tracks/${id}`)

// ── URL de stems para Web Audio API ───────────────────────────────────────
export const getStemUrl = (songId, stemName) =>
  `/stems/${songId}/${stemName}`

export default api
