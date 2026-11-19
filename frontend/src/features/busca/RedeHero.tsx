import { useEffect, useRef } from 'react'
import type { AnalistaPublico } from '@shared/api/types'
import { Andeps, Avatar, LogoEmpilhado } from '@shared/components'
import styles from './RedeHero.module.css'

interface RedeHeroProps {
  analistas: AnalistaPublico[]
  onEscolher: (id: number) => void
}

// Estado de animação de cada nó (fora do React: muda a cada quadro)
interface No {
  a: AnalistaPublico
  el: HTMLButtonElement
  base: number
  hx: number; hy: number; x: number; y: number; vx: number; vy: number
  z: number; zEf: number; zFase: number; zVel: number
  f1: number; f2: number; p1: number; p2: number; p3: number
  lift: number; hover: number; hoverAlvo: number
  arrastando: boolean; arrastou: boolean; px: number; py: number
}

const ALCANCE_ARRASTO = 130 // quanto um nó pode se afastar da sua posição de origem
const RAIO_MOUSE = 170 // área de influência do cursor

// Gerador pseudoaleatório com semente, para a rede ficar sempre igual
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Topo da busca: rede de perfis interligados que se move devagar, reage ao mouse,
 * deixa arrastar os nós (com limite elástico) e traz os do fundo para a frente aos poucos.
 */
export default function RedeHero({ analistas, onEscolher }: RedeHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const simboloRef = useRef<HTMLHeadingElement>(null)
  const nosRef = useRef<Array<HTMLButtonElement | null>>([])
  const escolherRef = useRef(onEscolher)
  escolherRef.current = onEscolher

  const chave = analistas.map((a) => a.id).join(',')

  useEffect(() => {
    const hero = heroRef.current
    const canvas = canvasRef.current
    const tip = tipRef.current
    const simbolo = simboloRef.current
    const ctx = canvas?.getContext('2d')
    if (!hero || !canvas || !tip || !simbolo || !ctx || !analistas.length) return

    const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches
    const r = rng(7)
    const nos: No[] = analistas.flatMap((a, i) => {
      const el = nosRef.current[i]
      if (!el) return []
      return [{
        a, el, base: 66 + r() * 26,
        hx: 0, hy: 0, x: 0, y: 0, vx: 0, vy: 0,
        z: 0.5, zEf: 0.5, zFase: r() * Math.PI * 2, zVel: 0.1 + r() * 0.12,
        f1: 0.18 + r() * 0.2, f2: 0.11 + r() * 0.15, p1: r() * 6.3, p2: r() * 6.3, p3: r() * 6.3,
        lift: 0, hover: 0, hoverAlvo: 0, arrastando: false, arrastou: false, px: 0, py: 0,
      }]
    })

    let W = 0, H = 0, escala = 1, iniciado = false
    let links: Array<[number, number]> = []
    let vizinhos: number[][] = []
    let ligadosAoCentro: number[] = []
    let centro = { x: 0, y: 0, a: 1, b: 1, ra: 1, rb: 1 }

    function layout() {
      const mobile = W < 760
      const rr = rng(42)
      // No desktop a rede respeita a largura do conteúdo (1320px) e ganha respiro em cima e embaixo
      const margem = Math.max(0.06 * W, (W - Math.min(W - 32, 1320)) / 2 + 45)
      // em cima fica a barra do site; embaixo, a marca da ANDEPS
      const reg = mobile
        ? { x0: 0.08 * W, x1: 0.92 * W, y0: 0.34 * H, y1: 0.8 * H }
        : { x0: margem, x1: W - margem, y0: 0.27 * H, y1: 0.8 * H }
      // Área livre em volta do símbolo central (elipse)
      const sb = simbolo!.getBoundingClientRect()
      centro = {
        x: W / 2, y: H / 2,
        a: sb.width / 2 + (mobile ? 30 : 60), b: sb.height / 2 + (mobile ? 28 : 34),
        ra: sb.width / 2 + 16, rb: sb.height / 2 + 16,
      }
      const foraDoCentro = (p: { x: number; y: number }) => {
        const dx = p.x - centro.x, dy = p.y - centro.y
        const q = (dx / centro.a) ** 2 + (dy / centro.b) ** 2
        if (q < 1) {
          const k = 1 / Math.sqrt(q || 0.0001)
          p.x = centro.x + dx * k
          p.y = centro.y + dy * k
        }
      }
      const pts = nos.map(() => ({ x: reg.x0 + rr() * (reg.x1 - reg.x0), y: reg.y0 + rr() * (reg.y1 - reg.y0) }))
      const minD = Math.sqrt(((reg.x1 - reg.x0) * (reg.y1 - reg.y0)) / Math.max(1, nos.length)) * 0.95
      for (let it = 0; it < 220; it++) {
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y
          const d = Math.hypot(dx, dy) || 0.01
          if (d < minD) {
            const f = ((minD - d) / d) * 0.25
            pts[i].x -= dx * f; pts[i].y -= dy * f
            pts[j].x += dx * f; pts[j].y += dy * f
          }
        }
        pts.forEach((p) => {
          p.x = Math.min(reg.x1, Math.max(reg.x0, p.x))
          p.y = Math.min(reg.y1, Math.max(reg.y0, p.y))
          foraDoCentro(p)
        })
      }
      escala = mobile ? 0.46 : 0.78
      nos.forEach((n, i) => {
        n.hx = pts[i].x
        n.hy = pts[i].y
        if (!iniciado) { n.x = n.hx; n.y = n.hy }
        n.el.style.setProperty('--d', `${Math.round(n.base * escala)}px`)
      })
      iniciado = true

      // Ligações: 2 vizinhos mais próximos, sem atravessar o símbolo, + garantia de rede conectada
      const chaves = new Set<string>()
      links = []
      const cruzaCentro = (a: number, b: number) => {
        const ax = (pts[a].x - centro.x) / centro.ra, ay = (pts[a].y - centro.y) / centro.rb
        const bx = (pts[b].x - centro.x) / centro.ra, by = (pts[b].y - centro.y) / centro.rb
        const dx = bx - ax, dy = by - ay
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)))
        return Math.hypot(ax + dx * t, ay + dy * t) < 1
      }
      const ligar = (a: number, b: number, forcar = false) => {
        const k = a < b ? `${a}-${b}` : `${b}-${a}`
        if (a !== b && !chaves.has(k) && (forcar || !cruzaCentro(a, b))) { chaves.add(k); links.push([a, b]) }
      }
      const dist = (a: number, b: number) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)
      pts.forEach((_, i) => {
        pts.map((__, j) => j).filter((j) => j !== i).sort((a, b) => dist(i, a) - dist(i, b)).slice(0, 2).forEach((j) => ligar(i, j))
      })
      const pai = pts.map((_, i) => i)
      const raiz = (i: number): number => (pai[i] === i ? i : (pai[i] = raiz(pai[i])))
      links.forEach(([a, b]) => { pai[raiz(a)] = raiz(b) })
      for (;;) {
        let melhor: [number, number, number] | null = null
        for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) {
          if (raiz(i) !== raiz(j) && (!melhor || dist(i, j) < melhor[2])) melhor = [i, j, dist(i, j)]
        }
        if (!melhor) break
        ligar(melhor[0], melhor[1], true)
        pai[raiz(melhor[0])] = raiz(melhor[1])
      }
      for (let k = 0; k < 5; k++) ligar(Math.floor(rr() * pts.length), Math.floor(rr() * pts.length))
      ligadosAoCentro = pts.map((_, i) => i)
        .sort((a, b) => Math.hypot(pts[a].x - centro.x, pts[a].y - centro.y) - Math.hypot(pts[b].x - centro.x, pts[b].y - centro.y))
        .slice(0, 6)
      vizinhos = nos.map(() => [])
      links.forEach(([a, b]) => { vizinhos[a].push(b); vizinhos[b].push(a) })
    }

    let dpr = 1
    function redimensionar() {
      const rect = hero!.getBoundingClientRect()
      W = rect.width
      H = rect.height
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas!.width = W * dpr
      canvas!.height = H * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      layout()
    }
    const ro = new ResizeObserver(redimensionar)
    ro.observe(hero)
    redimensionar()

    // Mouse (suavizado)
    const mouse = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, inf: 0, tinf: 0 }
    const local = (e: PointerEvent) => {
      const b = hero.getBoundingClientRect()
      return { x: e.clientX - b.left, y: e.clientY - b.top }
    }
    const onMove = (e: PointerEvent) => {
      const p = local(e)
      mouse.tx = p.x; mouse.ty = p.y; mouse.tinf = e.pointerType === 'mouse' ? 1 : 0
    }
    const onLeave = () => { mouse.tinf = 0; mouse.tx = W / 2; mouse.ty = H / 2 }
    hero.addEventListener('pointermove', onMove)
    hero.addEventListener('pointerleave', onLeave)

    // Balão com nome e órgão
    let ativo: No | null = null
    const mostrarTip = (n: No) => {
      ativo = n
      tip.querySelector('strong')!.textContent = n.a.nome
      tip.querySelector('span')!.textContent = [n.a.cargo_fce, n.a.ministerio_sigla ?? n.a.ministerio].filter(Boolean).join(' · ')
      tip.classList.add(styles.show)
    }
    const esconderTip = (n: No) => {
      if (ativo === n && !n.arrastando) { ativo = null; tip.classList.remove(styles.show) }
    }

    // Arrastar (com limite) e clicar
    const remover: Array<() => void> = []
    nos.forEach((n) => {
      let inicio = { x: 0, y: 0 }, offX = 0, offY = 0
      const on = <K extends keyof HTMLElementEventMap>(tipo: K, fn: (e: HTMLElementEventMap[K]) => void) => {
        n.el.addEventListener(tipo, fn)
        remover.push(() => n.el.removeEventListener(tipo, fn))
      }
      on('pointerenter', () => { n.hoverAlvo = 1; mostrarTip(n) })
      on('pointerleave', () => { n.hoverAlvo = 0; esconderTip(n) })
      on('focus', () => { n.hoverAlvo = 1; mostrarTip(n) })
      on('blur', () => { n.hoverAlvo = 0; esconderTip(n) })
      on('pointerdown', (e) => {
        e.preventDefault()
        n.el.setPointerCapture(e.pointerId)
        const p = local(e)
        inicio = p
        n.arrastou = false
        offX = n.x - p.x
        offY = n.y - p.y
        n.px = n.x; n.py = n.y
        n.arrastando = true
        n.hoverAlvo = 1
        mostrarTip(n)
      })
      on('pointermove', (e) => {
        if (!n.arrastando) return
        const p = local(e)
        if (Math.hypot(p.x - inicio.x, p.y - inicio.y) > 5) n.arrastou = true
        n.px = p.x + offX
        n.py = p.y + offY
      })
      const soltar = (e: PointerEvent) => {
        if (!n.arrastando) return
        n.arrastando = false
        if (e.pointerType !== 'mouse') { n.hoverAlvo = 0; esconderTip(n) }
      }
      on('pointerup', soltar)
      on('pointercancel', soltar)
      on('click', () => {
        if (n.arrastou) { n.arrastou = false; return }
        escolherRef.current(n.a.id)
      })
    })

    // Limite elástico: quanto mais longe, mais resistência; nunca passa do alcance
    const limitar = (n: No, x: number, y: number): [number, number] => {
      const dx = x - n.hx, dy = y - n.hy
      const d = Math.hypot(dx, dy)
      if (!d) return [x, y]
      const permitido = ALCANCE_ARRASTO * (1 - Math.exp(-d / ALCANCE_ARRASTO))
      return [n.hx + (dx / d) * permitido, n.hy + (dy / d) * permitido]
    }

    let visivel = true
    const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting })
    io.observe(hero)

    let raf = 0
    const quadro = (ms: number) => {
      raf = requestAnimationFrame(quadro)
      if (!visivel) return
      const t = reduzir ? 0 : ms / 1000
      mouse.x += (mouse.tx - mouse.x) * 0.08
      mouse.y += (mouse.ty - mouse.y) * 0.08
      mouse.inf += (mouse.tinf - mouse.inf) * 0.06
      const arrastado = nos.find((n) => n.arrastando)
      const iArrastado = arrastado ? nos.indexOf(arrastado) : -1

      nos.forEach((n, i) => {
        // Profundidade: oscila devagar, trazendo os nós de trás para a frente
        n.z = 0.5 + 0.5 * Math.sin(t * n.zVel + n.zFase)
        n.hover += (n.hoverAlvo - n.hover) * 0.15
        n.lift += ((n.arrastando || n.hoverAlvo ? 1 : 0) - n.lift) * 0.08
        const z = n.z + (1 - n.z) * n.lift

        let tx: number, ty: number
        if (n.arrastando) {
          ;[tx, ty] = limitar(n, n.px, n.py)
        } else {
          const amp = 16 + 10 * (1 - n.z)
          tx = n.hx + Math.sin(t * n.f1 + n.p1) * amp + Math.sin(t * n.f2 + n.p3) * amp * 0.5
          ty = n.hy + Math.cos(t * n.f2 + n.p2) * amp + Math.sin(t * n.f1 * 0.7 + n.p1) * amp * 0.4
          // Paralaxe: os da frente acompanham o mouse, os do fundo vão no sentido oposto
          const par = (z - 0.4) * 46 * mouse.inf
          tx += ((mouse.x - W / 2) / W) * par
          ty += ((mouse.y - H / 2) / H) * par
          // Afastamento suave perto do cursor
          const dx = tx - mouse.x, dy = ty - mouse.y
          const d = Math.hypot(dx, dy) || 1
          if (d < RAIO_MOUSE && !arrastado) {
            const f = Math.pow(1 - d / RAIO_MOUSE, 2) * 30 * mouse.inf * (1 - n.hover)
            tx += (dx / d) * f
            ty += (dy / d) * f
          }
          // Vizinhos de um nó arrastado acompanham um pouco
          if (arrastado && vizinhos[i]?.includes(iArrastado)) {
            tx += (arrastado.x - arrastado.hx) * 0.22
            ty += (arrastado.y - arrastado.hy) * 0.22
          }
          // Mantém o símbolo central livre durante o movimento
          const cx = tx - centro.x, cy = ty - centro.y
          const q = (cx / centro.a) ** 2 + (cy / centro.b) ** 2
          if (q < 1) {
            const kq = 1 / Math.sqrt(q || 0.0001)
            tx = centro.x + cx * kq
            ty = centro.y + cy * kq
          }
        }

        const k = n.arrastando ? 0.28 : 0.045
        n.vx = (n.vx + (tx - n.x) * k) * (n.arrastando ? 0.55 : 0.84)
        n.vy = (n.vy + (ty - n.y) * k) * (n.arrastando ? 0.55 : 0.84)
        n.x += n.vx
        n.y += n.vy

        n.zEf = z
        const s = (0.6 + 0.52 * z) * (1 + 0.1 * n.hover)
        const blur = Math.max(0, 0.42 - z) * 5
        n.el.style.transform = `translate3d(${n.x.toFixed(2)}px, ${n.y.toFixed(2)}px, 0) scale(${s.toFixed(3)})`
        n.el.style.opacity = (0.5 + 0.5 * z).toFixed(3)
        n.el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : ''
        n.el.style.zIndex = String(10 + Math.round(z * 100))
      })

      // Linhas entre os nós
      ctx.clearRect(0, 0, W, H)
      ctx.lineCap = 'round'
      links.forEach(([a, b]) => {
        const A = nos[a], B = nos[b]
        const zMin = Math.min(A.zEf, B.zEf)
        const foco = Math.max(A.lift, B.lift)
        ctx.strokeStyle = `rgba(255,255,255,${(0.14 + 0.36 * zMin + 0.45 * foco).toFixed(3)})`
        ctx.lineWidth = 0.8 + 1.2 * zMin + foco
        ctx.beginPath()
        ctx.moveTo(A.x, A.y)
        ctx.lineTo(B.x, B.y)
        ctx.stroke()
      })
      // Linhas do símbolo até os nós vizinhos, saindo da borda da elipse
      ligadosAoCentro.forEach((i) => {
        const N = nos[i]
        const dx = N.x - centro.x, dy = N.y - centro.y
        const kk = 1 / Math.sqrt((dx / centro.ra) ** 2 + (dy / centro.rb) ** 2 || 1)
        if (kk >= 1) return
        ctx.strokeStyle = `rgba(255,255,255,${(0.2 + 0.4 * N.zEf + 0.4 * N.lift).toFixed(3)})`
        ctx.lineWidth = 1 + 1.2 * N.zEf + N.lift
        ctx.beginPath()
        ctx.moveTo(centro.x + dx * kk, centro.y + dy * kk)
        ctx.lineTo(N.x, N.y)
        ctx.stroke()
      })

      if (ativo) {
        const d = ativo.base * escala * (0.6 + 0.52 * ativo.zEf) * (1 + 0.1 * ativo.hover)
        const tw = tip.offsetWidth
        const x = Math.min(W - tw - 12, Math.max(12, ativo.x - tw / 2))
        tip.style.transform = `translate(${x}px, ${ativo.y + d / 2 + 10}px)`
      }
    }
    raf = requestAnimationFrame(quadro)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      remover.forEach((fn) => fn())
    }
    // a rede só é refeita quando muda o conjunto de pessoas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return (
    <div className={styles.hero} ref={heroRef}>
      <canvas className={styles.canvas} ref={canvasRef} aria-hidden />
      <div className={styles.nos}>
        {analistas.map((a, i) => (
          <button
            key={a.id}
            type="button"
            className={styles.no}
            ref={(el) => { nosRef.current[i] = el }}
            aria-label={`${a.nome}${a.ministerio_sigla ? `, ${a.ministerio_sigla}` : ''}. Ver card`}
          >
            <Avatar id={a.id} nome={a.nome} fotoPath={a.foto_path} tamanho={100} className={styles.face} />
          </button>
        ))}
      </div>
      <div className={styles.tip} ref={tipRef} aria-hidden>
        <strong />
        <span />
      </div>
      <h1 className={styles.simbolo} ref={simboloRef}>
        <LogoEmpilhado />
      </h1>
      <Andeps className={styles.andeps} altura={30} />

    </div>
  )
}
