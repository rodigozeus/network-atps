import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconBuildingCommunity, IconCircleCheck, IconHeartHandshake, IconLock, IconSearch, IconStar,
} from '@tabler/icons-react'
import type { ResumoPublico } from '@shared/api/types'
import { api } from '@shared/api/client'
import { redeApi } from '@shared/api/unidades'
import { Andeps, LogoHorizontal, Rodape } from '@shared/components'
import auth from '@features/auth/auth.module.css'
import styles from './sobre.module.css'

/** Página pública de apresentação (sem login). Não mostra nenhum perfil, só números agregados. */
export default function SobrePage() {
  const [resumo, setResumo] = useState<ResumoPublico | null>(null)

  useEffect(() => {
    redeApi.resumo().then(setResumo).catch(() => {})
    try {
      if (!sessionStorage.getItem('visita-sobre')) {
        sessionStorage.setItem('visita-sobre', '1')
        void api.post('/publico/visita').catch(() => {})
      }
    } catch { /* sem sessionStorage */ }
    document.title = 'Conheça a Rede ATPS'
    return () => { document.title = 'Rede ATPS' }
  }, [])

  return (
    <div className={auth.page}>
      <main className={[auth.main, styles.main].join(' ')}>
        <Link to="/login" className={auth.logo} aria-label="Rede ATPS, ir para o login">
          <LogoHorizontal />
        </Link>

        <article className={styles.card}>
          <header className={styles.topo}>
            <h1>A rede dos Analistas Técnicos de Políticas Sociais</h1>
            <p className={styles.lead}>
              Encontre colegas da carreira pelo tema em que atuam, pelo órgão onde estão e pela formação, e saiba como
              falar com cada um.
            </p>
            {resumo?.analistas && (
              <p className={styles.numeros}>
                <strong>{resumo.analistas}</strong> analistas{resumo.orgaos ? <> em <strong>{resumo.orgaos}</strong> órgãos</> : null}
              </p>
            )}
            <div className={styles.acoes}>
              <Link to="/registrar" className={[styles.botao, styles.primario].join(' ')}>Criar minha conta</Link>
              <Link to="/login" className={styles.botao}>Já tenho conta</Link>
            </div>
          </header>

          <section className={styles.recursos} aria-label="O que dá para fazer">
            <div>
              <IconSearch size={24} aria-hidden />
              <h2>Encontre quem sabe</h2>
              <p>Busque por tema, órgão, cargo ou formação. Cada perfil conta em que a pessoa pode ajudar.</p>
            </div>
            <div>
              <IconBuildingCommunity size={24} aria-hidden />
              <h2>Explore o governo</h2>
              <p>Veja o que cada órgão e unidade faz, pela estrutura oficial do Governo Federal, e quem da carreira está lá.</p>
            </div>
            <div>
              <IconStar size={24} aria-hidden />
              <h2>Acompanhe quem importa</h2>
              <p>Favorite colegas e saiba quando mudam de área. Sem feed e sem algoritmo: você vê o que escolhe ver.</p>
            </div>
          </section>

          <div className={styles.colunas}>
            <section>
              <h2><IconHeartHandshake size={20} aria-hidden />Quem pode participar</h2>
              <ul>
                <li><IconCircleCheck size={18} aria-hidden />Analistas Técnicos de Políticas Sociais, ativos e aposentados.</li>
                <li><IconCircleCheck size={18} aria-hidden />O vínculo é confirmado automaticamente pelo CPF, no Portal da Transparência.</li>
                <li><IconCircleCheck size={18} aria-hidden />A participação é voluntária e não depende de filiação à ANDEPS.</li>
              </ul>
            </section>
            <section>
              <h2><IconLock size={20} aria-hidden />Seus dados</h2>
              <ul>
                <li><IconCircleCheck size={18} aria-hidden />Perfis só aparecem para quem tem conta verificada na Rede.</li>
                <li><IconCircleCheck size={18} aria-hidden />Você decide se mostra e-mail pessoal e celular, e pode ocultar o perfil ou excluir a conta quando quiser.</li>
                <li><IconCircleCheck size={18} aria-hidden />O CPF fica guardado criptografado e nunca é exibido. Tudo conforme a LGPD.</li>
              </ul>
            </section>
          </div>

          <footer className={styles.mantida}>
            <span>Mantida pela</span>
            <Andeps altura={22} />
          </footer>
        </article>
      </main>
      <Rodape transparente />
    </div>
  )
}
