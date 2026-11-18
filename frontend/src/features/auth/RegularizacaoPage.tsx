import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { perfilApi } from '@shared/api/perfil'
import { Button, Input } from '@shared/components'
import { cpfValido, formatCpf } from '@shared/utils/cpf'
import {
  AUTORIZACAO_CONSULTA_CPF, DocumentoBox, TERMO_CONSENTIMENTO, useDocumentosAtuais,
} from './DocumentosLegais'
import styles from './auth.module.css'

function mensagemErro(err: unknown, padrao: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : padrao
}

/**
 * Exibida no lugar das páginas internas enquanto o usuário tiver pendências:
 * informar o CPF (contas antigas), aceitar a versão atual dos termos ou aguardar
 * a análise de um vínculo suspenso. Excluir a conta continua sempre possível.
 */
export default function RegularizacaoPage() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const { documentos, versoes, carregado, erro: erroDocumentos } = useDocumentosAtuais()

  const [cpf, setCpf] = useState('')
  const [aceiteTermos, setAceiteTermos] = useState(false)
  const [aceiteCpf, setAceiteCpf] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [mostrarExclusao, setMostrarExclusao] = useState(false)
  const [senhaExclusao, setSenhaExclusao] = useState('')
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  if (!user) return null
  const pedeCpf = user.pendencias.includes('cpf')
  const pedeTermos = user.pendencias.includes('termos')
  const vinculoSuspenso = user.pendencias.includes('vinculo')
  const temFormulario = pedeCpf || pedeTermos

  const handleSair = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (pedeCpf && !cpfValido(cpf)) {
      setErro('CPF inválido.')
      return
    }
    if (pedeTermos && !(aceiteTermos && aceiteCpf)) {
      setErro('É necessário aceitar o Termo de Consentimento e autorizar a consulta do CPF.')
      return
    }
    setEnviando(true)
    try {
      const atualizado = await perfilApi.regularizar({
        cpf: pedeCpf ? cpf : undefined,
        aceite_termos: aceiteTermos,
        aceite_consulta_cpf: aceiteCpf,
        versoes,
      })
      updateUser(atualizado)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível concluir a atualização. Tente novamente.'))
    } finally {
      setEnviando(false)
    }
  }

  const handleExcluir = async () => {
    setExcluindo(true)
    setErroExclusao(null)
    try {
      await perfilApi.deleteMe(senhaExclusao)
      await handleSair()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setErroExclusao(status === 401 ? 'Senha incorreta.' : 'Erro ao excluir conta. Tente novamente.')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <p className={styles.brand}>Rede ATPS</p>
          <p className={styles.subtitle}>
            {vinculoSuspenso && !temFormulario ? 'Vínculo em verificação' : 'Atualização cadastral'}
          </p>
        </div>

        {vinculoSuspenso && (
          <div className={styles.pendingNotice}>
            <p>
              <strong>Não conseguimos confirmar seu vínculo como ATPS</strong> na verificação
              periódica junto ao Portal da Transparência. Seu perfil está oculto para os
              demais usuários.
            </p>
            <p>
              Se você continua na carreira (ou é aposentado(a) dela), responda ao e-mail que
              enviamos, de preferência com um comprovante de vínculo.
              {user.vinculo_exclusao_em && (
                <>
                  {' '}Sem confirmação, a conta será excluída em{' '}
                  <strong>{new Date(user.vinculo_exclusao_em).toLocaleDateString('pt-BR')}</strong>.
                </>
              )}
            </p>
          </div>
        )}

        {temFormulario && (
          <form className={styles.form} onSubmit={(e) => void handleEnviar(e)} noValidate>
            <p className={styles.notice}>
              {pedeCpf && pedeTermos
                ? 'Para continuar usando a Rede, informe seu CPF e leia e aceite a versão atual dos termos.'
                : pedeCpf
                  ? 'Para continuar usando a Rede, informe seu CPF.'
                  : 'Os termos da Rede foram atualizados. Para continuar, leia e aceite a nova versão.'}
            </p>

            {erro && <p className={styles.apiError}>{erro}</p>}

            {pedeCpf && (
              <div>
                <Input
                  label="CPF"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                />
                <p className={styles.notice} style={{ marginTop: 'var(--sp-2)' }}>
                  Usado para confirmar seu vínculo como ATPS no Portal da Transparência, agora e
                  periodicamente. Fica guardado criptografado e não é exibido a nenhum usuário.
                </p>
              </div>
            )}

            {pedeTermos && (
              <>
                {erroDocumentos && (
                  <p className={styles.apiError}>
                    Não foi possível carregar os termos. Recarregue a página.
                  </p>
                )}
                <div>
                  <DocumentoBox doc={documentos[TERMO_CONSENTIMENTO]} />
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={aceiteTermos}
                      onChange={(e) => setAceiteTermos(e.target.checked)}
                    />
                    Li e concordo com o Termo de Consentimento acima.
                  </label>
                </div>
                <div>
                  <DocumentoBox doc={documentos[AUTORIZACAO_CONSULTA_CPF]} />
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={aceiteCpf}
                      onChange={(e) => setAceiteCpf(e.target.checked)}
                    />
                    Autorizo a consulta do meu CPF ao Portal da Transparência, nos termos acima.
                  </label>
                </div>
              </>
            )}

            <Button type="submit" fullWidth loading={enviando} disabled={pedeTermos && !carregado}>
              Continuar
            </Button>
          </form>
        )}

        <div className={styles.footer}>
          <button
            type="button"
            onClick={() => void handleSair()}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'inherit' }}
          >
            Sair
          </button>
          {' · '}
          <button
            type="button"
            onClick={() => setMostrarExclusao((v) => !v)}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}
          >
            {temFormulario ? 'Não aceito — excluir minha conta' : 'Excluir minha conta'}
          </button>
        </div>

        {mostrarExclusao && (
          <div className={styles.form} style={{ marginTop: 'var(--sp-4)' }}>
            <p className={styles.notice}>
              A exclusão é <strong>irreversível</strong>: seu perfil, formações, temas, foto e
              autorizações são apagados da plataforma.
            </p>
            <Input
              type="password"
              label="Confirme sua senha"
              autoComplete="current-password"
              value={senhaExclusao}
              onChange={(e) => setSenhaExclusao(e.target.value)}
            />
            {erroExclusao && <p className={styles.apiError}>{erroExclusao}</p>}
            <Button
              type="button"
              variant="danger"
              fullWidth
              loading={excluindo}
              disabled={!senhaExclusao}
              onClick={() => void handleExcluir()}
            >
              Excluir definitivamente
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
