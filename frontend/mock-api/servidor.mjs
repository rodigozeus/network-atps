// API simulada da Rede ATPS — só para desenvolver e revisar o frontend sem o back-end.
// Uso: npm run mock  (porta 8000, a mesma que o proxy do Vite espera)
//
// Implementa os endpoints atuais e os novos propostos em docs/NOVO-VISUAL.md
// (/lotacoes, /temas, /favoritos, DELETE /perfil/foto e o filtro nivel_formacao da busca).
// Login: qualquer e-mail da lista com a senha "senha1234". Pessoa de teste: cecilia.sousa@email.com.
// Cadastro: o CPF 529.982.247-25 simula "encontrado no Portal da Transparência"; outros ficam pendentes.
// SEM_NOVOS=1 npm run mock  → imita o back-end de hoje, sem os endpoints novos (testa as alternativas do frontend).
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PASTA = dirname(fileURLToPath(import.meta.url))
const PORTA = Number(process.env.PORT ?? 8000)
const SEM_NOVOS = process.env.SEM_NOVOS === '1'
const SENHA = 'senha1234'
const CPF_ENCONTRADO = '52998224725'

const analistas = JSON.parse(readFileSync(join(PASTA, 'dados.json'), 'utf8'))
const senhas = new Map(analistas.map((a) => [a.id, SENHA]))
const favoritos = new Map() // id de quem favoritou -> Set de ids
let proximoId = Math.max(...analistas.map((a) => a.id)) + 1
let proximoItem = 10_000

const semAcento = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const contem = (campo, termo) => semAcento(campo).includes(semAcento(termo))

function publico(a) {
  const { role, ativo, pendente_revisao, criado_em, atualizado_em, visibilidade_email_pessoal, visibilidade_celular, ...resto } = a
  return {
    ...resto,
    email_pessoal: visibilidade_email_pessoal ? a.email_pessoal : null,
    celular: visibilidade_celular ? a.celular : null,
  }
}

const token = (id) => `mock.${id}`
function quemEsta(req) {
  const m = /^Bearer mock\.(\d+)$/.exec(req.headers.authorization ?? '')
  return m ? analistas.find((a) => a.id === Number(m[1]) && a.ativo) : undefined
}

async function corpo(req) {
  const partes = []
  for await (const p of req) partes.push(p)
  const bruto = Buffer.concat(partes)
  const tipo = req.headers['content-type'] ?? ''
  if (tipo.includes('application/json')) return JSON.parse(bruto.toString() || '{}')
  if (tipo.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(bruto.toString()))
  return bruto
}

function responder(res, status, dados) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(dados === undefined ? '' : JSON.stringify(dados))
}
const erro = (res, status, detail) => responder(res, status, { detail })

const rotas = []
const rota = (metodo, padrao, fn, { publica = false, novo = false } = {}) => {
  if (!(novo && SEM_NOVOS)) rotas.push({ metodo, padrao, fn, publica })
}

// ---------- Autenticação ----------
rota('POST', /^\/auth\/login$/, async (req, res) => {
  const { username, password } = await corpo(req)
  const a = analistas.find((x) => x.email_pessoal === username)
  if (!a || senhas.get(a.id) !== password) return erro(res, 401, 'Credenciais inválidas')
  if (!a.ativo) {
    return erro(res, 403, a.pendente_revisao
      ? 'Cadastro pendente de verificação. Não foi possível confirmar automaticamente seu vínculo como ATPS junto ao Portal da Transparência. Aguarde a análise de um administrador — você receberá um e-mail assim que sua conta for ativada.'
      : 'Conta inativa. Entre em contato com um administrador.')
  }
  responder(res, 200, { access_token: token(a.id), refresh_token: token(a.id), token_type: 'bearer' })
}, { publica: true })

rota('POST', /^\/auth\/refresh$/, async (req, res) => {
  const { refresh_token } = await corpo(req)
  responder(res, 200, { access_token: refresh_token, refresh_token, token_type: 'bearer' })
}, { publica: true })

rota('POST', /^\/auth\/register$/, async (req, res) => {
  const b = await corpo(req)
  if (analistas.some((a) => a.email_pessoal === b.email_pessoal)) return erro(res, 409, 'E-mail ou CPF já cadastrado')
  const encontrado = String(b.cpf).replace(/\D/g, '') === CPF_ENCONTRADO
  const agora = new Date().toISOString()
  const a = {
    id: proximoId++, nome: b.nome, email_pessoal: b.email_pessoal, email_institucional: null,
    telefone_institucional: b.telefone_institucional ?? null, celular: null,
    visibilidade_email_pessoal: false, visibilidade_celular: false,
    ministerio: null, ministerio_sigla: null, secretaria: null, secretaria_sigla: null,
    departamento: null, departamento_sigla: null, coordenacao_geral: null, coordenacao: null,
    cargo_fce: null, portal_url: null, linkedin_url: null, lattes_url: null, turma: null, foto_path: null, role: 'analista',
    ativo: encontrado, pendente_revisao: !encontrado, criado_em: agora, atualizado_em: agora,
    formacoes: [], temas: [],
  }
  analistas.push(a)
  senhas.set(a.id, b.senha)
  responder(res, 201, a)
}, { publica: true })

rota('POST', /^\/auth\/(esqueci-senha|redefinir-senha)$/, (_req, res) =>
  responder(res, 200, { detail: 'Se o e-mail informado estiver cadastrado, enviaremos instruções para redefinição de senha.' }),
{ publica: true })

// ---------- Perfil ----------
rota('GET', /^\/(perfil\/me|auth\/me)$/, (_req, res, eu) => responder(res, 200, eu))

rota('PUT', /^\/perfil\/me$/, async (req, res, eu) => {
  Object.assign(eu, await corpo(req), { atualizado_em: new Date().toISOString() })
  responder(res, 200, eu)
})

rota('DELETE', /^\/perfil\/me$/, async (req, res, eu) => {
  const { senha } = await corpo(req)
  if (senha !== senhas.get(eu.id)) return erro(res, 401, 'Senha incorreta')
  analistas.splice(analistas.indexOf(eu), 1)
  responder(res, 204)
})

rota('POST', /^\/perfil\/foto$/, async (req, res, eu) => {
  await corpo(req) // a simulação não guarda a imagem: usa uma foto de exemplo
  eu.foto_path = 'uploads/fotos/1763099172_9182.jpg'
  responder(res, 200, eu)
})
rota('DELETE', /^\/perfil\/foto$/, (_req, res, eu) => { eu.foto_path = null; responder(res, 200, eu) }, { novo: true })

rota('POST', /^\/perfil\/formacao$/, async (req, res, eu) => {
  const f = { id: proximoItem++, ...(await corpo(req)) }
  eu.formacoes.push(f)
  responder(res, 201, f)
})
rota('DELETE', /^\/perfil\/formacao\/(\d+)$/, (_req, res, eu, [id]) => {
  eu.formacoes = eu.formacoes.filter((f) => f.id !== Number(id))
  responder(res, 204)
})
rota('POST', /^\/perfil\/tema$/, async (req, res, eu) => {
  const t = { id: proximoItem++, em_exercicio_atual: true, ...(await corpo(req)) }
  eu.temas.push(t)
  responder(res, 201, t)
})
rota('DELETE', /^\/perfil\/tema\/(\d+)$/, (_req, res, eu, [id]) => {
  eu.temas = eu.temas.filter((t) => t.id !== Number(id))
  responder(res, 204)
})

function contagemTemas() {
  const cont = new Map()
  analistas.filter((a) => a.ativo).forEach((a) => a.temas.forEach((t) => cont.set(t.tema, (cont.get(t.tema) ?? 0) + 1)))
  return [...cont].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt'))
}
rota('GET', /^\/perfil\/temas\/sugestoes$/, (_req, res, _eu, _m, q) =>
  responder(res, 200, contagemTemas().filter(([t]) => contem(t, q.get('q') ?? '')).slice(0, 8).map(([t]) => t)))

// Novo: catálogo de temas para o filtro da busca
rota('GET', /^\/temas$/, (_req, res) => responder(res, 200, contagemTemas().map(([tema, total]) => ({ tema, total }))), { novo: true })

rota('GET', /^\/analistas\/(\d+)$/, (_req, res, _eu, [id]) => {
  const a = analistas.find((x) => x.id === Number(id) && x.ativo)
  return a ? responder(res, 200, publico(a)) : erro(res, 404, 'Analista não encontrado')
})

// ---------- Busca ----------
rota('GET', /^\/busca$/, (_req, res, eu, _m, q) => {
  let lista = analistas.filter((a) => a.ativo)
  const p = (k) => q.get(k)
  if (p('q')) lista = lista.filter((a) => [a.nome, a.ministerio, a.ministerio_sigla, a.secretaria, a.secretaria_sigla, ...a.temas.map((t) => t.tema)].some((c) => contem(c, p('q'))))
  if (p('ministerio')) lista = lista.filter((a) => contem(a.ministerio, p('ministerio')) || contem(a.ministerio_sigla, p('ministerio')))
  if (p('secretaria')) lista = lista.filter((a) => contem(a.secretaria, p('secretaria')) || contem(a.secretaria_sigla, p('secretaria')))
  if (p('tema')) lista = lista.filter((a) => a.temas.some((t) => contem(t.tema, p('tema'))))
  if (p('formacao')) lista = lista.filter((a) => a.formacoes.some((f) => contem(f.curso, p('formacao')) || contem(f.instituicao, p('formacao'))))
  if (p('nivel_formacao') && !SEM_NOVOS) lista = lista.filter((a) => a.formacoes.some((f) => f.nivel === p('nivel_formacao')))
  if (p('favoritos') === 'true' && !SEM_NOVOS) lista = lista.filter((a) => favoritos.get(eu.id)?.has(a.id))
  const tamanho = Math.min(100, Number(p('page_size') ?? 20))
  const pagina = Math.max(1, Number(p('page') ?? 1))
  const total = lista.length
  responder(res, 200, {
    items: lista.slice((pagina - 1) * tamanho, pagina * tamanho).map(publico),
    total, page: pagina, page_size: tamanho, pages: Math.max(1, Math.ceil(total / tamanho)),
  })
})

// ---------- Novos: lotações e favoritos ----------
const CAMPOS = {
  ministerio: ['ministerio', 'ministerio_sigla'],
  secretaria: ['secretaria', 'secretaria_sigla'],
  departamento: ['departamento', 'departamento_sigla'],
  coordenacao_geral: ['coordenacao_geral', null],
  coordenacao: ['coordenacao', null],
}
rota('GET', /^\/lotacoes$/, (_req, res, _eu, _m, q) => {
  const nivel = q.get('nivel')
  if (!CAMPOS[nivel]) return erro(res, 422, 'nivel inválido')
  const ordem = Object.keys(CAMPOS)
  const acima = ordem.slice(0, ordem.indexOf(nivel)).filter((k) => q.get(k))
  const cont = new Map()
  analistas.filter((a) => a.ativo && acima.every((k) => a[k] === q.get(k))).forEach((a) => {
    const [campoNome, campoSigla] = CAMPOS[nivel]
    if (!a[campoNome]) return
    const atual = cont.get(a[campoNome]) ?? { nome: a[campoNome], sigla: campoSigla ? a[campoSigla] : null, total: 0 }
    atual.total++
    cont.set(a[campoNome], atual)
  })
  responder(res, 200, [...cont.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')))
}, { novo: true })

rota('GET', /^\/favoritos\/ids$/, (_req, res, eu) => responder(res, 200, [...(favoritos.get(eu.id) ?? [])]), { novo: true })
rota('PUT', /^\/favoritos\/(\d+)$/, (_req, res, eu, [id]) => {
  if (!analistas.some((a) => a.id === Number(id))) return erro(res, 404, 'Analista não encontrado')
  if (!favoritos.has(eu.id)) favoritos.set(eu.id, new Set())
  favoritos.get(eu.id).add(Number(id))
  responder(res, 204)
}, { novo: true })
rota('DELETE', /^\/favoritos\/(\d+)$/, (_req, res, eu, [id]) => { favoritos.get(eu.id)?.delete(Number(id)); responder(res, 204) }, { novo: true })

// ---------- Admin (o mínimo para o painel abrir) ----------
rota('GET', /^\/admin\/usuarios$/, (_req, res) => responder(res, 200, { items: [], total: 0, page: 1, page_size: 20, pages: 1 }))

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  try {
    if (req.method === 'GET' && url.pathname.startsWith('/uploads/fotos/')) {
      const arquivo = join(PASTA, 'fotos', url.pathname.split('/').pop() ?? '')
      res.writeHead(200, { 'content-type': 'image/jpeg' })
      return res.end(readFileSync(arquivo))
    }
    for (const r of rotas) {
      const m = r.padrao.exec(url.pathname)
      if (!m || r.metodo !== req.method) continue
      const eu = quemEsta(req)
      if (!r.publica && !eu) return erro(res, 401, 'Não autenticado')
      return await r.fn(req, res, eu, m.slice(1), url.searchParams)
    }
    erro(res, 404, 'Not Found')
  } catch (e) {
    console.error(e)
    erro(res, 500, 'Erro na API simulada')
  }
}).on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e
  console.error(`A porta ${PORTA} já está em uso — a API (simulada ou real) provavelmente já está rodando.`)
  console.error(`Para usar outra porta: PORT=8001 npm run mock (e ajuste o proxy em vite.config.ts).`)
  process.exit(1)
}).listen(PORTA, () => console.log(`API simulada em http://localhost:${PORTA} (senha de todos: ${SENHA})${SEM_NOVOS ? ' — sem os endpoints novos' : ''}`))
