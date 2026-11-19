import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { IconCheck, IconZoomIn, IconZoomOut } from '@tabler/icons-react'
import styles from './perfil.module.css'

const LADO_MAXIMO = 1600 // mesmo limite do servidor

/** Recorta a imagem escolhida no quadrado indicado e devolve um JPEG (até 1600 px). */
async function recortar(url: string, area: Area): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = url
  })
  const lado = Math.min(LADO_MAXIMO, Math.round(area.width))
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, lado, lado)
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, lado, lado)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('recorte'))), 'image/jpeg', 0.92))
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' })
}

/** Etapa de enquadramento depois de escolher a foto: arrastar e dar zoom na moldura redonda. */
export default function RecorteFoto({ arquivo, onPronto, onCancelar }: {
  arquivo: File
  onPronto: (f: File) => void
  onCancelar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [url] = useState(() => URL.createObjectURL(arquivo))
  const [posicao, setPosicao] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    dialogo.current?.showModal()
    return () => URL.revokeObjectURL(url)
  }, [url])

  const aoMudar = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  const confirmar = async () => {
    if (!area) return
    setSalvando(true)
    setErro('')
    try {
      onPronto(await recortar(url, area))
    } catch {
      setErro('Não foi possível recortar esta imagem. Tente outra.')
      setSalvando(false)
    }
  }

  return (
    <dialog ref={dialogo} className={styles.recorte} aria-labelledby="titulo-recorte"
      onCancel={(e) => { e.preventDefault(); onCancelar() }}>
      <h2 id="titulo-recorte">Enquadre sua foto</h2>
      <p className={styles.ajuda}>Arraste para posicionar e use o zoom. O círculo mostra como ela vai aparecer.</p>
      <div className={styles.recorteArea}>
        <Cropper image={url} crop={posicao} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
          minZoom={1} maxZoom={4} onCropChange={setPosicao} onZoomChange={setZoom} onCropComplete={aoMudar} />
      </div>
      <label className={styles.recorteZoom}>
        <IconZoomOut size={18} aria-hidden />
        <input type="range" min={1} max={4} step={0.01} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
        <IconZoomIn size={18} aria-hidden />
      </label>
      {erro && <p className={styles.erro} role="alert">{erro}</p>}
      <div className={styles.confirmarAcoes}>
        <button type="button" className={[styles.botao, styles.secundario].join(' ')} onClick={onCancelar}>Cancelar</button>
        <button type="button" className={[styles.botao, styles.primario].join(' ')} disabled={!area || salvando}
          onClick={() => void confirmar()}>
          <IconCheck size={18} aria-hidden />{salvando ? 'Recortando…' : 'Usar esta foto'}
        </button>
      </div>
    </dialog>
  )
}
