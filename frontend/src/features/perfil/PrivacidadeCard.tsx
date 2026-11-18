import { useEffect, useRef, useState } from 'react'
import { IconEyeOff } from '@tabler/icons-react'
import type { AnalistaOut, Consentimento } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import styles from './perfil.module.css'

const ROTULOS: Record<string, string> = {
  termo_consentimento: 'Termo de Consentimento',
  autorizacao_consulta_cpf: 'Consulta do CPF ao Portal da Transparência',
  exibir_perfil: 'Exibição do perfil',
  exibir_email_pessoal: 'Exibição do e-mail pessoal',
  exibir_celular: 'Exibição do celular',
}

function data(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function ultimoAceite(consentimentos: Consentimento[], tipo: string) {
  return [...consentimentos].reverse().find((c) => c.tipo === tipo && c.acao === 'aceito')
}

interface Props {
  profile: AnalistaOut
  onChange: (updated: AnalistaOut) => void
}

/** Aba "Privacidade" da edição do perfil: visibilidade do perfil e autorizações dadas. */
export default function PrivacidadeCard({ profile, onChange }: Props) {
  const [consentimentos, setConsentimentos] = useState<Consentimento[]>([])
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const dialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    perfilApi.getPrivacidade().then(setConsentimentos).catch(() => {})
  }, [profile.perfil_oculto, profile.visibilidade_email_pessoal, profile.visibilidade_celular])

  const alterarVisibilidade = async (oculto: boolean) => {
    setSalvando(true)
    setErro('')
    try {
      onChange(await perfilApi.updateMe({ perfil_oculto: oculto }))
      dialogo.current?.close()
    } catch {
      setErro('Não foi possível alterar a visibilidade agora. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const documentos = ['termo_consentimento', 'autorizacao_consulta_cpf'].map((tipo) => ({
    tipo,
    aceite: ultimoAceite(consentimentos, tipo),
  }))

  return (
    <>
      <section className={styles.secao}>
        <h2>Visibilidade do perfil<small>Vale para a busca e para quem tentar abrir o seu perfil.</small></h2>
        <label className={styles.chave}>
          <input
            type="checkbox"
            role="switch"
            checked={!profile.perfil_oculto}
            disabled={salvando}
            onChange={(e) => (e.target.checked ? void alterarVisibilidade(false) : dialogo.current?.showModal())}
          />
          <span className={styles.trilho} />
          {profile.perfil_oculto
            ? 'Seu perfil está oculto: ninguém o encontra na busca'
            : 'Perfil visível para as demais pessoas ATPS conectadas à Rede'}
        </label>
        {erro && <p className={styles.erro} role="alert">{erro}</p>}
        <p className={styles.ajuda}>
          A exibição do e-mail pessoal e do celular é escolhida na aba “Dados do perfil”.
          Hoje: e-mail pessoal {profile.visibilidade_email_pessoal ? 'visível' : 'oculto'};
          celular {profile.visibilidade_celular ? 'visível' : 'oculto'}.
        </p>
      </section>

      <section className={styles.secao}>
        <h2>Autorizações<small>Necessárias para participar da Rede. Para revogá-las, exclua sua conta no seu perfil.</small></h2>
        <ul className={styles.autorizacoes}>
          {documentos.map(({ tipo, aceite }) => (
            <li key={tipo}>
              <strong>{ROTULOS[tipo]}</strong>
              <span>
                {aceite
                  ? `Versão ${aceite.documento_versao}, aceita em ${data(aceite.criado_em)}`
                  : 'Aceite anterior ao registro de versões'}
              </span>
            </li>
          ))}
        </ul>

        <button type="button" className={[styles.botao, styles.leve, styles.historicoBtn].join(' ')}
          aria-expanded={mostrarHistorico} onClick={() => setMostrarHistorico((v) => !v)}>
          {mostrarHistorico ? 'Ocultar histórico de autorizações' : 'Ver histórico de autorizações'}
        </button>

        {mostrarHistorico && (
          <ul className={styles.historico}>
            {consentimentos.length === 0 && <li>Nenhum registro.</li>}
            {[...consentimentos].reverse().map((c, i) => (
              <li key={i}>
                {data(c.criado_em)}: {ROTULOS[c.tipo] ?? c.tipo}
                {c.documento_versao ? ` (versão ${c.documento_versao})` : ''}, {c.acao === 'aceito' ? 'autorizado' : 'revogado'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <dialog ref={dialogo} className={styles.confirmar} aria-labelledby="titulo-ocultar">
        <span className={styles.icoAlerta}><IconEyeOff size={24} aria-hidden /></span>
        <h2 id="titulo-ocultar">Ocultar seu perfil?</h2>
        <p>
          Seu perfil deixa de aparecer na busca e não pode ser aberto pelas demais pessoas.
          A conta continua ativa e você pode voltar a exibi-lo quando quiser.
        </p>
        {erro && <p className={styles.erro} role="alert">{erro}</p>}
        <div className={styles.confirmarAcoes}>
          <button type="button" className={styles.acao} onClick={() => dialogo.current?.close()} autoFocus>Cancelar</button>
          <button type="button" className={[styles.acao, styles.perigoCheio].join(' ')} disabled={salvando}
            onClick={() => void alterarVisibilidade(true)}>
            <IconEyeOff size={19} aria-hidden />{salvando ? 'Ocultando…' : 'Ocultar perfil'}
          </button>
        </div>
      </dialog>
    </>
  )
}
