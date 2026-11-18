import { useEffect, useState } from 'react'
import type { AnalistaOut, Consentimento } from '@shared/api/types'
import { perfilApi } from '@shared/api/perfil'
import { Button } from '@shared/components'
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

export default function PrivacidadeCard({ profile, onChange }: Props) {
  const [consentimentos, setConsentimentos] = useState<Consentimento[]>([])
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [confirmarOcultar, setConfirmarOcultar] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    perfilApi.getPrivacidade().then(setConsentimentos).catch(() => {})
  }, [profile.perfil_oculto, profile.visibilidade_email_pessoal, profile.visibilidade_celular])

  const alterarVisibilidade = async (oculto: boolean) => {
    setSalvando(true)
    try {
      onChange(await perfilApi.updateMe({ perfil_oculto: oculto }))
    } finally {
      setSalvando(false)
      setConfirmarOcultar(false)
    }
  }

  const documentos = ['termo_consentimento', 'autorizacao_consulta_cpf'].map((tipo) => ({
    tipo,
    aceite: ultimoAceite(consentimentos, tipo),
  }))

  return (
    <div className={styles.formCard} style={{ marginTop: 'var(--sp-6)' }}>
      <p className={styles.formCardTitle}>Privacidade</p>

      <div className={styles.visibilityRow}>
        <input
          id="vis-perfil"
          type="checkbox"
          className={styles.toggle}
          checked={!profile.perfil_oculto}
          disabled={salvando}
          onChange={(e) => (e.target.checked ? void alterarVisibilidade(false) : setConfirmarOcultar(true))}
        />
        <label htmlFor="vis-perfil" className={styles.toggleLabel}>
          {profile.perfil_oculto
            ? 'Seu perfil está oculto — ninguém o encontra na busca'
            : 'Perfil visível para os demais ATPS logados na Rede'}
        </label>
      </div>

      <ul style={{ margin: 'var(--sp-4) 0 0', paddingLeft: 'var(--sp-5)', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
        {documentos.map(({ tipo, aceite }) => (
          <li key={tipo}>
            {ROTULOS[tipo]}:{' '}
            {aceite ? `versão ${aceite.documento_versao}, aceita em ${data(aceite.criado_em)}` : 'aceite anterior ao registro de versões'}
          </li>
        ))}
        <li>E-mail pessoal: {profile.visibilidade_email_pessoal ? 'visível' : 'oculto'} para os demais usuários</li>
        <li>Celular: {profile.visibilidade_celular ? 'visível' : 'oculto'} para os demais usuários</li>
      </ul>

      <p style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
        A exibição do e-mail pessoal e do celular pode ser alterada em "Editar Perfil". O Termo de
        Consentimento e a autorização de consulta do CPF são necessários para participar da Rede —
        para revogá-los, exclua sua conta.
      </p>

      <button
        type="button"
        onClick={() => setMostrarHistorico((v) => !v)}
        style={{ background: 'none', border: 'none', padding: 0, marginTop: 'var(--sp-3)', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-sm)' }}
      >
        {mostrarHistorico ? 'Ocultar histórico de autorizações' : 'Ver histórico de autorizações'}
      </button>

      {mostrarHistorico && (
        <ul style={{ margin: 'var(--sp-3) 0 0', paddingLeft: 'var(--sp-5)', fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
          {consentimentos.length === 0 && <li>Nenhum registro.</li>}
          {[...consentimentos].reverse().map((c, i) => (
            <li key={i}>
              {data(c.criado_em)} — {ROTULOS[c.tipo] ?? c.tipo}
              {c.documento_versao ? ` (versão ${c.documento_versao})` : ''}: {c.acao === 'aceito' ? 'autorizado' : 'revogado'}
            </li>
          ))}
        </ul>
      )}

      {confirmarOcultar && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Ocultar seu perfil?</p>
            <p className={styles.modalText}>
              Seu perfil deixará de aparecer na busca e não poderá ser aberto pelos demais usuários.
              Sua conta continua ativa e você pode voltar a exibi-lo a qualquer momento.
            </p>
            <div className={styles.modalActions}>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmarOcultar(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" loading={salvando} onClick={() => void alterarVisibilidade(true)}>
                Ocultar perfil
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
