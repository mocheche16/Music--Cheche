/**
 * components/UploadZone.jsx
 *
 * Drag & drop de archivos MP3/WAV con barra de progreso de upload,
 * polling de estado y feedback visual del procesamiento.
 */
import { useState, useRef, useCallback } from 'react'
import { uploadSong, fetchStatus } from '../api/client'

const POLLING_INTERVAL = 4000  // ms

export default function UploadZone({ onUploadComplete }) {
  const [dragging, setDragging]         = useState(false)
  const [file, setFile]                 = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [phase, setPhase]               = useState('idle') // idle|uploading|processing|done|error
  const [statusMsg, setStatusMsg]       = useState('')
  const inputRef                        = useRef(null)
  const pollingRef                      = useRef(null)

  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
  }

  const startPolling = useCallback((songId) => {
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await fetchStatus(songId)
        if (data.status === 'done') {
          stopPolling()
          setPhase('done')
          setStatusMsg('¡Procesamiento completado!')
          onUploadComplete?.()
        } else if (data.status === 'error') {
          stopPolling()
          setPhase('error')
          setStatusMsg(`Error: ${data.error_msg || 'Procesamiento fallido'}`)
        } else {
          setStatusMsg('Demucs está separando los stems... (puede tardar varios minutos)')
        }
      } catch (err) {
        console.error('[Polling error]', err)
      }
    }, POLLING_INTERVAL)
  }, [onUploadComplete])

  const handleFile = useCallback(async (selectedFile) => {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/x-m4a']
    if (!allowed.includes(selectedFile.type) && !selectedFile.name.match(/\.(mp3|wav|flac|ogg|m4a)$/i)) {
      setPhase('error')
      setStatusMsg('Formato no soportado. Usa MP3, WAV, FLAC o OGG.')
      return
    }

    // Validar tamaño (50MB = 50 * 1024 * 1024 bytes)
    const MAX_SIZE = 50 * 1024 * 1024
    if (selectedFile.size > MAX_SIZE) {
      setPhase('error')
      setStatusMsg('El archivo es demasiado grande. El límite es de 50MB.')
      return
    }

    setFile(selectedFile)
    setPhase('uploading')
    setUploadProgress(0)
    setStatusMsg('Subiendo archivo...')

    try {
      const form = new FormData()
      form.append('file', selectedFile)

      const { data } = await uploadSong(form, setUploadProgress)
      setPhase('processing')
      setStatusMsg('Archivo recibido. Iniciando análisis con Librosa y Demucs...')
      startPolling(data.song_id)
    } catch (err) {
      setPhase('error')
      setStatusMsg(`Error al subir: ${err.message}`)
    }
  }, [startPolling])

  // ── Drag & Drop handlers ─────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const onDrop      = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }
  const onFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) handleFile(selected)
  }

  const reset = () => {
    stopPolling()
    setFile(null)
    setPhase('idle')
    setStatusMsg('')
    setUploadProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isIdle = phase === 'idle'

  return (
    <div className="upload-zone-wrapper animate-fade-in">
      <div
        className={`upload-zone glass-card ${dragging ? 'upload-zone--dragging' : ''} ${phase !== 'idle' ? 'upload-zone--active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => isIdle && inputRef.current?.click()}
        id="upload-dropzone"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && isIdle && inputRef.current?.click()}
        aria-label="Zona de carga de archivos de audio"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.flac,.ogg,.m4a,audio/*"
          onChange={onFileChange}
          style={{ display: 'none' }}
          id="file-input"
        />

        {/* IDLE STATE */}
        {isIdle && (
          <div className="upload-idle">
            <div className="upload-icon">🎵</div>
            <h3>Arrastra tu canción aquí</h3>
            <p>o haz clic para seleccionar un archivo</p>
            <div className="upload-formats">
              <span>MP3</span><span>WAV</span><span>FLAC</span><span>OGG</span>
            </div>
          </div>
        )}

        {/* UPLOADING STATE */}
        {phase === 'uploading' && (
          <div className="upload-progress-state">
            <div className="upload-filename">📁 {file?.name}</div>
            <div className="upload-progress-label">Subiendo... {uploadProgress}%</div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* PROCESSING STATE */}
        {phase === 'processing' && (
          <div className="upload-processing-state">
            <div className="processing-animation">
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
            </div>
            <div className="upload-filename">🎛️ {file?.name}</div>
            <p className="processing-msg">{statusMsg}</p>
            <p className="processing-hint">Este proceso puede tardar 5-30 minutos según el hardware</p>
          </div>
        )}

        {/* DONE STATE */}
        {phase === 'done' && (
          <div className="upload-done-state">
            <div className="done-icon">✅</div>
            <h3>Procesamiento completado</h3>
            <p>{file?.name}</p>
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); reset() }}>
              Subir otra canción
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {phase === 'error' && (
          <div className="upload-error-state">
            <div className="error-icon">❌</div>
            <h3>Error</h3>
            <p>{statusMsg}</p>
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); reset() }}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      <style>{`
        .upload-zone-wrapper { margin-bottom: 32px; }

        .upload-zone {
          padding: 48px 32px;
          text-align: center;
          cursor: pointer;
          border: 2px dashed var(--clr-border);
          transition: all var(--transition-normal);
          user-select: none;
          min-height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .upload-zone:hover,
        .upload-zone--dragging {
          border-color: var(--clr-primary);
          background: rgba(108, 99, 255, 0.06);
          box-shadow: 0 0 32px var(--clr-primary-glow);
        }
        .upload-zone--active { cursor: default; }

        .upload-idle h3 { font-size: 18px; font-weight: 700; margin: 12px 0 6px; }
        .upload-idle p  { color: var(--clr-text-secondary); font-size: 14px; }

        .upload-icon  { font-size: 48px; }
        .upload-formats {
          display: flex; gap: 8px; justify-content: center; margin-top: 16px;
        }
        .upload-formats span {
          padding: 3px 10px;
          background: var(--clr-bg-elevated);
          border-radius: var(--radius-full);
          font-size: 11px; font-weight: 600;
          color: var(--clr-text-muted);
          letter-spacing: 0.05em;
        }

        .upload-filename {
          font-weight: 600; font-size: 15px; margin-bottom: 12px;
          color: var(--clr-text-primary);
        }
        .upload-progress-label { font-size: 13px; color: var(--clr-text-secondary); margin-bottom: 8px; }
        .upload-progress-state, .upload-processing-state,
        .upload-done-state, .upload-error-state {
          width: 100%; max-width: 400px;
        }

        /* Waveform animation */
        .processing-animation {
          display: flex; align-items: flex-end; justify-content: center;
          gap: 5px; height: 50px; margin-bottom: 20px;
        }
        .wave-bar {
          display: block; width: 6px; border-radius: 3px;
          background: var(--grad-primary);
          animation: wave 1.2s ease-in-out infinite;
        }
        .wave-bar:nth-child(1) { animation-delay: 0s;    height: 20px; }
        .wave-bar:nth-child(2) { animation-delay: 0.15s; height: 35px; }
        .wave-bar:nth-child(3) { animation-delay: 0.3s;  height: 45px; }
        .wave-bar:nth-child(4) { animation-delay: 0.45s; height: 30px; }
        .wave-bar:nth-child(5) { animation-delay: 0.6s;  height: 18px; }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.6; }
          50%       { transform: scaleY(1.0); opacity: 1; }
        }

        .processing-msg  { font-size: 14px; color: var(--clr-warning); margin-bottom: 6px; }
        .processing-hint { font-size: 12px; color: var(--clr-text-muted); }

        .done-icon, .error-icon { font-size: 42px; margin-bottom: 12px; }
        .upload-done-state h3  { color: var(--clr-success); margin-bottom: 6px; }
        .upload-error-state h3 { color: var(--clr-error); margin-bottom: 6px; }
        .upload-done-state p,
        .upload-error-state p  { font-size: 14px; color: var(--clr-text-secondary); margin-bottom: 16px; }
      `}</style>
    </div>
  )
}
