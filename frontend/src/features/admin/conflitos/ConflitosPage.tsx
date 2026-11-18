import { useEffect, useState } from 'react'
import { getConflitos, resolverConflito, type ConflitoCadastro } from '../api/admin'
import styles from '../admin.module.css'

export default function ConflitosPage() {
  const [items, setItems] = useState<ConflitoCadastro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getConflitos()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  async function handleResolver(c: ConflitoCadastro) {
    if (!window.confirm('Marcar esta tentativa como resolvida? Ela sairá da lista.')) return
    try {
      await resolverConflito(c.id)
      setItems((prev) => prev.filter((i) => i.id !== c.id))
    } catch {
      // silencioso — mantém o item na lista
    }
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Conflitos de CPF ({items.length})</h1>
      </div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--sp-5)' }}>
        Tentativas de cadastro com um CPF que já pertence a uma conta. A nova conta não foi criada;
        o titular da conta existente e a pessoa que tentou o cadastro receberam e-mail. Entre em
        contato com os dois para esclarecer antes de marcar como resolvido.
      </p>

      {loading ? (
        <p className={styles.empty}>Carregando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Nenhum conflito pendente.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome informado</th>
                <th>E-mail informado</th>
                <th>Conta existente</th>
                <th>E-mail da conta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.criado_em).toLocaleString('pt-BR')}</td>
                  <td>{c.nome_informado}</td>
                  <td>{c.email_informado}</td>
                  <td>{c.analista_nome}</td>
                  <td>{c.analista_email}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        onClick={() => void handleResolver(c)}
                        style={{ fontSize: 'var(--font-xs)', padding: '4px 10px', borderRadius: 'var(--r)', border: 'none', background: '#dcfce7', color: '#15803d', cursor: 'pointer' }}
                      >
                        Resolvido
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
