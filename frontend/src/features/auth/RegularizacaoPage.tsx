import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconAlertCircle, IconAlertTriangle, IconShieldCheck, IconTrash } from '@tabler/icons-react'
import { useAuth } from '@shared/hooks/useAuth'
import { limparFavoritos } from '@shared/hooks/useFavoritos'
import { perfilApi } from '@shared/api/perfil'
import { Button, Input } from '@shared/components'
import { cpfValido, formatCpf } from '@shared/utils/cpf'
import TelaAcesso from './TelaAcesso'
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
  const { user, atualizarUsuario, logout } = useAuth()
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

  const sair = async (destino: string) => {
    limparFavoritos()
    await logout().catch(() => {})
    navigate(destino, { replace: true })
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (pedeCpf && !cpfValido(cpf)) {
      setErro('Esse CPF não é válido. Confira os números.')
      return
    }
    if (pedeTermos && !(aceiteTermos && aceiteCpf)) {
      setErro('Para continuar, aceite o Termo de Consentimento e autorize a consulta do CPF.')
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
      atualizarUsuario(atualizado)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível concluir a atualização. Tente de novo.'))
    } finally {
      setEnviando(false)
    }
  }

  const excluir = async () => {
    setExcluindo(true)
    setErroExclusao(null)
    try {
      await perfilApi.deleteMe(senhaExclusao)
      await sair('/login?excluido=1')
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setErroExclusao(status === 401 ? 'Senha incorreta.' : 'Não foi possível excluir agora. Tente de novo.')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <TelaAcesso
      titulo={vinculoSuspenso && !temFormulario ? 'Vínculo em verificação' : 'Atualização cadastral'}
      subtitulo={temFormulario
        ? pedeCpf && pedeTermos
          ? 'Para continuar usando a Rede, informe seu CPF e aceite a versão atual dos termos.'
          : pedeCpf
            ? 'Para continuar usando a Rede, informe seu CPF.'
            : 'Os termos da Rede foram atualizados. Para continuar, leia e aceite a nova versão.'
        : undefined}
      largo={pedeTermos}
    >
      {vinculoSuspenso && (
        <div className={styles.alerta} role="status">
          <IconAlertTriangle size={20} aria-hidden />
          <div>
            <p>
              <strong>Não conseguimos confirmar seu vínculo como ATPS</strong> na verificação
              periódica no Portal da Transparência. Por isso, seu perfil está oculto para as demais pessoas.
            </p>
            <p>
              Se você continua na carreira (ou se aposentou nela), responda ao e-mail que enviamos,
              de preferência com um comprovante de vínculo.
              {user.vinculo_exclusao_em && (
                <>
                  {' '}Sem confirmação, a conta será excluída em{' '}
                  <strong>{new Date(user.vinculo_exclusao_em).toLocaleDateString('pt-BR')}</strong>.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {temFormulario && (
        <form className={styles.form} onSubmit={(e) => void enviar(e)} noValidate>
          {erro && <p className={styles.apiError} role="alert"><IconAlertCircle size={18} aria-hidden />{erro}</p>}

          {pedeCpf && (
            <div>
              <Input label="CPF" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                aria-describedby="info-cpf" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} />
              <p className={styles.info} id="info-cpf">
                <IconShieldCheck size={18} aria-hidden />
                <span>Usado para confirmar seu vínculo como ATPS no Portal da Transparência, agora e periodicamente. Fica guardado criptografado e <strong>não é exibido a nenhum usuário</strong>.</span>
              </p>
            </div>
          )}

          {pedeTermos && (
            <>
              {erroDocumentos && (
                <p className={styles.apiError} role="alert">
                  <IconAlertCircle size={18} aria-hidden />
                  Não foi possível carregar os termos. Recarregue a página.
                </p>
              )}
              <div>
                <DocumentoBox doc={documentos[TERMO_CONSENTIMENTO]} />
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={aceiteTermos} onChange={(e) => setAceiteTermos(e.target.checked)} />
                  Li e concordo com o Termo de Consentimento acima.
                </label>
              </div>
              <div>
                <DocumentoBox doc={documentos[AUTORIZACAO_CONSULTA_CPF]} />
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={aceiteCpf} onChange={(e) => setAceiteCpf(e.target.checked)} />
                  Autorizo a consulta do meu CPF ao Portal da Transparência, nos termos acima.
                </label>
              </div>
            </>
          )}

          <Button type="submit" size="lg" fullWidth loading={enviando} disabled={pedeTermos && !carregado}>
            Continuar
          </Button>
        </form>
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.linkBtn} onClick={() => void sair('/login?saiu=1')}>Sair</button>
        {' · '}
        <button type="button" className={[styles.linkBtn, styles.linkDiscreto].join(' ')}
          aria-expanded={mostrarExclusao} onClick={() => setMostrarExclusao((v) => !v)}>
          {temFormulario ? 'Não aceito, excluir minha conta' : 'Excluir minha conta'}
        </button>
      </div>

      {mostrarExclusao && (
        <div className={[styles.form, styles.exclusao].join(' ')}>
          <p className={styles.apiError}>
            <IconAlertTriangle size={18} aria-hidden />
            <span>A exclusão é <strong>irreversível</strong>: seu perfil, formações, temas, foto e autorizações são apagados da plataforma.</span>
          </p>
          <Input type="password" label="Digite sua senha para confirmar" autoComplete="current-password"
            value={senhaExclusao} onChange={(e) => setSenhaExclusao(e.target.value)} error={erroExclusao ?? undefined} />
          <Button type="button" variant="danger" fullWidth loading={excluindo} disabled={!senhaExclusao}
            onClick={() => void excluir()}>
            <IconTrash size={18} aria-hidden />Excluir definitivamente
          </Button>
        </div>
      )}
    </TelaAcesso>
  )
}
