import { useState, type ReactNode } from 'react'
import type { AnalistaOut, AnalistaPublico, Formacao, Tema } from '@shared/api/types'
import { Badge, Tag } from '@shared/components'
import styles from './perfil.module.css'

type Profile = AnalistaOut | AnalistaPublico

interface OrgPart {
  label: string
  value: string
  sigla: string | null
}

const NIVEL_LABEL: Record<string, string> = {
  graduacao: 'Graduação',
  especializacao: 'Especialização',
  mestrado: 'Mestrado',
  doutorado: 'Doutorado',
}

function getInitials(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function fotoUrl(path: string | null) {
  return path ? `/${path}` : null
}

const WHATSAPP_MSG =
  'Olá! Sou Analista Técnico de Políticas Sociais também. Vi seu perfil na Rede ATPS e acho que podemos colaborar!'

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, '')
  const intl = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${intl}?text=${encodeURIComponent(WHATSAPP_MSG)}`
}

function buildOrgParts(p: Profile): OrgPart[] {
  const parts: OrgPart[] = []
  if (p.ministerio) parts.push({ label: 'Ministério', value: p.ministerio, sigla: p.ministerio_sigla })
  if (p.secretaria) parts.push({ label: 'Secretaria', value: p.secretaria, sigla: p.secretaria_sigla })
  if (p.departamento) parts.push({ label: 'Departamento', value: p.departamento, sigla: p.departamento_sigla })
  if (p.coordenacao_geral) parts.push({ label: 'CG', value: p.coordenacao_geral, sigla: null })
  if (p.coordenacao) parts.push({ label: 'Coordenação', value: p.coordenacao, sigla: null })
  return parts
}

export default function ProfileCard({ profile }: { profile: Profile }) {
  const foto = fotoUrl(profile.foto_path)
  const [imgError, setImgError] = useState(false)
  const orgParts = buildOrgParts(profile)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        {foto && !imgError ? (
          <img src={foto} alt={profile.nome} className={styles.avatar} onError={() => setImgError(true)} />
        ) : (
          <div className={styles.avatarInitials}>{getInitials(profile.nome)}</div>
        )}
        <div className={styles.cardHeaderInfo}>
          <h1 className={styles.profileName}>{profile.nome}</h1>
          {profile.cargo_fce && <p className={styles.profileCargo}>{profile.cargo_fce}</p>}
          {orgParts.length > 0 && (
            <p className={styles.profileOrg}>
              {orgParts.map((p, i) => (
                <span key={p.label}>
                  {i > 0 && ' › '}
                  {p.sigla ?? p.value}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className={styles.cardBody}>
        {orgParts.length > 0 && (
          <section className={styles.section}>
            <p className={styles.sectionTitle}>Órgão de exercício</p>
            {orgParts.map((p, i) => (
              <div key={p.label} className={styles.orgLine}>
                {'  '.repeat(i)}
                {i > 0 && <span className={styles.orgIndent}>↳ </span>}
                <span className={styles.orgLabel}>{p.label}: </span>
                {p.value}
                {p.sigla && <span className={styles.orgSigla}> ({p.sigla})</span>}
              </div>
            ))}
          </section>
        )}

        <section className={styles.section}>
          <p className={styles.sectionTitle}>Contato</p>
          <div className={styles.contactList}>
            {profile.telefone_institucional && (
              <ContactRow icon="phone">{profile.telefone_institucional}</ContactRow>
            )}
            {profile.email_institucional && (
              <ContactRow icon="mail">{profile.email_institucional}</ContactRow>
            )}
            {profile.email_pessoal && (
              <ContactRow icon="mail">{profile.email_pessoal}</ContactRow>
            )}
            {profile.celular && (
              <ContactRow icon="cell">
                <a href={whatsappHref(profile.celular)} target="_blank" rel="noopener noreferrer">
                  {profile.celular}
                </a>
              </ContactRow>
            )}
            {profile.portal_url && (
              <ContactRow icon="link">
                <a href={profile.portal_url} target="_blank" rel="noopener noreferrer">
                  {profile.portal_url}
                </a>
              </ContactRow>
            )}
          </div>
        </section>

        {profile.formacoes.length > 0 && (
          <section className={styles.section}>
            <p className={styles.sectionTitle}>Formação Acadêmica</p>
            <div className={styles.formacaoSection}>
              {profile.formacoes.map((f: Formacao) => (
                <div key={f.id} className={styles.formacaoItem}>
                  <Badge variant="primary">{NIVEL_LABEL[f.nivel] ?? f.nivel}</Badge>
                  <div>
                    <div className={styles.formacaoNome}>{f.curso}</div>
                    <div className={styles.formacaoInstituicao}>{f.instituicao}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {profile.temas.length > 0 && (
          <section className={styles.section}>
            <p className={styles.sectionTitle}>Temas de Atuação</p>
            <div className={styles.tagList}>
              {profile.temas.map((t: Tema) => (
                <Tag
                  key={t.id}
                  variant={t.em_exercicio_atual ? 'success' : 'neutral'}
                  active={t.em_exercicio_atual}
                >
                  {t.tema}
                </Tag>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function ContactRow({ icon, children }: { icon: 'mail' | 'phone' | 'cell' | 'link'; children: ReactNode }) {
  return (
    <div className={styles.contactItem}>
      <span className={styles.contactIcon}>
        {icon === 'mail' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        )}
        {icon === 'phone' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.93 2 2 0 0 1 3.59 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        )}
        {icon === 'cell' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        )}
        {icon === 'link' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </span>
      {children}
    </div>
  )
}
