# Rede ATPS

Plataforma de networking profissional para Analistas Técnicos/as de Políticas Sociais (ATPS).

---

## O que é

A Rede ATPS é uma plataforma web onde cada analista cria e mantém seu perfil profissional e pode encontrar colegas por órgão, unidade, tema de atuação, formação ou cargo. Baseada na proposta da **Rede ATPS** idealizada pela Andeps em 2018, desenvolvida voluntariamente por um ATPS da carreira. Visual da Invicta Comunicação.

Sem feed e sem algoritmo de engajamento: cada pessoa vê quem procurou ou escolheu acompanhar.

---

## Funcionalidades

### Cadastro e verificação

- **Verificação do vínculo pelo CPF** — no cadastro, o CPF é consultado na API de Dados do Portal da Transparência: o cargo precisa indicar ATPS (ativo ou aposentado) e o nome informado precisa conferir com o do Portal. Confirmado → conta ativa na hora; não confirmado → conta `pendente_revisao` até um admin aprovar. CPF já cadastrado → a conta não é criada, o titular é avisado por e-mail e a tentativa vai para "Conflitos de CPF" no admin
- **Reserva quando o Portal cai** — se a API não responder, o vínculo é confirmado pela cópia local dos dados abertos do Portal (`base_atps`, ver [Operação](#operação)), pelos 6 dígitos do CPF que o Portal divulga e pelo nome. A cópia só confirma, nunca recusa (é mensal e não tem aposentados)
- **Cadastro pré-pronto** — com a Autorização de consulta do CPF aceita, campos em branco são preenchidos com dados do Portal: lotação (órgão e unidade de exercício, conferidos com o SIORG), cargo/função comissionada ("Coordenador(a)-Geral · FCE 1.13") e turma (pelo ano de ingresso no serviço público). Tudo marcado como "preenchido automaticamente — confira" e editável
- **Reverificação periódica** — o serviço `atps-tarefas` reconsulta o CPF a cada 180 dias; vínculo não confirmado → perfil oculto, aviso por e-mail e exclusão após 30 dias sem contestação. Contas aprovadas manualmente só geram alerta ao admin
- **Consentimento versionado** — Termo de Consentimento e Autorização de consulta do CPF em `backend/documentos_legais.py`, com versão e hash do texto; cada aceite/revogação vai para `consentimentos` (data, IP, navegador). Nova versão → reaceite obrigatório no próximo acesso

### Perfil

- **Lotação oficial** — ministério → secretaria → departamento → coordenação-geral → coordenação, em listas encadeadas com nomes e siglas oficiais do **SIORG**; o perfil guarda o código SIORG da unidade (`lotacao_siorg_id`), então renomeações oficiais chegam sozinhas aos perfis. Ainda dá para digitar uma unidade fora da lista
- **Perfil sempre atualizado** — a cada 30 dias o exercício e a função no Portal são conferidos; se mudaram, o titular recebe a sugestão "Atualizar meu perfil / Não, está certo". Nada muda sem o "sim", e uma sugestão descartada não volta
- **Em que posso ajudar** — texto livre (até 600 caracteres) no perfil, que também entra na busca
- **Formação, temas, contatos e links** — formação por nível (graduação a pós-doutorado), temas de atuação (atual ou anterior), contatos com controle de visibilidade, links do SouGov.br, Lattes e LinkedIn (só aceitos desses domínios), foto
- **Privacidade** — aba própria: ocultar o perfil sem excluir a conta, histórico das autorizações, exclusão definitiva da conta

### Encontrar pessoas

- **Busca** — várias palavras (cada uma precisa aparecer em algum campo: nome, lotação, cargo, "em que posso ajudar", temas, formação), sem diferenciar acentos e maiúsculas, tolerante a erros de digitação leves (PostgreSQL `unaccent` + `pg_trgm`); filtros por órgão, tema, nível de formação e favoritos, sincronizados com a URL
- **Ordenação** — escolhida por quem busca: perfis mais completos (rodízio diário estável entre páginas), nome ou chegada recente. Os favoritos vêm sempre primeiro
- **Favoritos e novidades** — favoritar é privado; quando um favorito muda de lotação, entra num tema atual ou registra formação nova, aparece o selo "Novidade" (retenção de 90 dias)
- **Novidades da rede** — no alto da busca: quem chegou à sua secretaria e à sua turma desde a última visita
- **Pessoas próximas** — no perfil, quem está mais perto na lotação (mesma coordenação > CG > departamento > secretaria > ministério), com temas em comum desempatando
- **Órgãos e unidades** — página de cada órgão e unidade do SIORG: competências oficiais, contato institucional, endereço, subunidades, quem da Rede está lá e os temas dessas pessoas

### Administração e público

- **Painel administrativo** — usuários (busca, filtros, edição, ativação, exclusão), estatísticas, conflitos de CPF, exportação CSV; roles `admin` e `andeps`
- **Cobertura** — ATPS na Rede × ATPS ativos de cada órgão (pela cópia local do Portal) e cadastros por dia
- **Página pública `/sobre`** — apresentação da Rede, sem nenhum perfil; números agregados só a partir de 30 perfis. Link na tela de login
- **Limite de e-mails** — 100 por hora e 300 por dia; acima disso só saem os essenciais (recuperação de senha, ativação de conta, avisos de segurança e de vínculo)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript, CSS Modules, Manrope, Tabler Icons |
| Backend | FastAPI (Python 3.12) |
| Banco | PostgreSQL 16 (+ extensões `unaccent` e `pg_trgm`) |
| ORM | SQLAlchemy 2 + Alembic |
| Servidor web | nginx |
| Containers | Docker + docker-compose |
| CI/CD | GitHub Actions (self-hosted runner) |
| Acesso público | Cloudflare Tunnel → `redeatps.org` |
| Dados externos | API do Portal da Transparência, dados abertos do SIAPE, SIORG |

---

## Arquitetura

```
GitHub (push em main)
  └── GitHub Actions — runner no servidor damaceno
        ├── escreve .env a partir do secret ENV_PROD (+ CPF_ENCRYPTION_KEY guardada no servidor)
        └── docker compose -f docker-compose.prod.yml up --build  →  alembic upgrade head
              ├── atps-frontend  (nginx + build React)  → 127.0.0.1:8512 → Cloudflare Tunnel → redeatps.org
              ├── atps-api       (FastAPI)  ── Portal da Transparência (API), SIORG (detalhe de unidades)
              ├── atps-tarefas   (tarefas.py --loop, uma vez por dia)
              └── db-network → postgres:5432/atps_db
```

Tarefas diárias (`backend/tarefas.py`): sincronizar o SIORG e propagar renomeações aos perfis, reverificar vínculos, conferir perfis no Portal (sugestões de atualização), excluir contas com vínculo vencido, avisar novos termos e apagar novidades antigas.

### Frontend: MFE-ready

Cada domínio isolado em `src/features/<domínio>/` com componentes e chamadas de API próprios. Permite extrair para Module Federation no futuro sem reescrever o código.

---

## Estrutura do Projeto

```
network-atps/
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/       # Login, cadastro, regularização, senha, documentos legais
│   │   │   ├── perfil/     # Edição (dados, formação/temas, privacidade) e perfil público
│   │   │   ├── busca/      # Busca, cards, favoritos, novidades da rede
│   │   │   ├── unidades/   # Órgãos e unidades (SIORG)
│   │   │   ├── sobre/      # Página pública
│   │   │   └── admin/      # Usuários, estatísticas, cobertura, conflitos
│   │   ├── shared/         # componentes, hooks (useAuth, useFavoritos), api/ e utils/
│   │   ├── index.css       # Tokens globais
│   │   └── App.tsx
│   ├── mock-api/           # API simulada da Invicta (npm run mock)
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/
│   ├── routers/
│   │   ├── auth.py         # Cadastro, login, sessão, senha
│   │   ├── perfil.py       # Perfil, regularização, sugestões, lotações, temas, pessoas próximas, foto
│   │   ├── busca.py        # Busca
│   │   ├── favoritos.py    # Favoritos e novidades dos favoritos
│   │   ├── unidades.py     # Páginas de órgãos e unidades
│   │   ├── rede.py         # Novidades da rede e números públicos
│   │   ├── documentos.py   # Documentos legais vigentes
│   │   └── admin.py        # Usuários, estatísticas, cobertura, exportação
│   ├── portal_transparencia.py  # Consulta de vínculo, exercício e função na API do Portal
│   ├── base_local.py        # Cópia local dos dados abertos (reserva + universo); extrair/importar
│   ├── siorg.py             # Cópia da estrutura oficial e detalhe das unidades
│   ├── lotacao_auto.py      # Casamento SIAPE ↔ SIORG e preenchimento automático
│   ├── lotacao_siorg.py     # Código SIORG no perfil e propagação de renomeações
│   ├── atualizacao.py       # Perfil sempre atualizado (sugestões)
│   ├── novidades.py         # Novidades dos favoritos
│   ├── documentos_legais.py # Termo e Autorização, versionados
│   ├── consentimentos.py, cpf_utils.py, email_utils.py, auth.py
│   ├── tarefas.py           # Serviço atps-tarefas
│   ├── models.py, schemas.py, database.py
│   └── alembic/
│
├── docker-compose.yml          # Desenvolvimento local
├── docker-compose.prod.yml     # Produção
└── .github/workflows/deploy.yml
```

---

## Navegação

- Não autenticado: `/login`, `/registrar`, `/esqueci-senha`, `/redefinir-senha`, `/sobre`
- Após login: `/busca`. Quem tem pendência (CPF, termos novos, vínculo suspenso) vê a regularização em tela cheia antes de usar a Rede
- `/analistas/:id` perfil, `/perfil` edição, `/unidades` e `/unidades/:id` órgãos e unidades, `/admin/*` painel

---

## Banco de Dados

```
analistas
  identidade e acesso: nome, email_pessoal, senha_hash, role (analista | andeps | admin), ativo
  CPF: cpf_hash (HMAC, impede duplicidade), cpf_cifrado (Fernet), cpf_verificado_em,
       vinculo_manual, vinculo_suspenso_em, pendente_revisao, motivo_pendencia
  lotação: ministerio/_sigla, secretaria/_sigla, departamento/_sigla, coordenacao_geral, coordenacao,
           lotacao_siorg_id, lotacao_origem
  perfil: cargo_fce, cargo_origem, turma, turma_origem, pode_ajudar, contatos e visibilidades,
          portal_url, linkedin_url, lattes_url, foto_path, perfil_oculto
  atualização: sugestao_atualizacao (JSON), sugestao_em, sugestao_descartada, conferido_portal_em
  outros: novidades_rede_vistas_em, termo_versao_notificada, reset de senha, bloqueio de login

formacoes, temas_atuacao        N por analista
consentimentos                  aceites e revogações (tipo, versão, hash, IP, navegador)
favoritos                       quem favoritou quem (+ visto_em)
eventos_perfil                  novidades de perfil (90 dias)
conflitos_cadastro              tentativas com CPF já cadastrado
unidades_siorg                  estrutura oficial (órgãos até divisões), sincronizada diariamente
unidades_siorg_detalhe          competência, contato e endereço (cache de 30 dias)
base_atps                       cópia dos ATPS ativos dos dados abertos do Portal (CPF só como HMAC)
envios_email                    tipo e hora de cada e-mail enviado (para o limite; sem destinatário)
```

Migrations versionadas via Alembic, aplicadas automaticamente no deploy.

---

## LGPD

A plataforma foi projetada com proteção de dados pessoais como requisito desde o início (Lei nº 13.709/2018). O texto que vale é o dos documentos vigentes em `backend/documentos_legais.py`; o resumo abaixo é só orientação.

### O que é exibido e para quem

| Dado | Quem vê |
|---|---|
| Nome, foto, lotação, cargo, turma, formação, temas, "em que posso ajudar", links | Usuários com conta verificada |
| E-mail e telefone institucionais | Usuários com conta verificada, se preenchidos |
| E-mail pessoal e celular | Ninguém, a menos que o titular autorize (revogável a qualquer momento) |
| Favoritos | Só quem favoritou |
| CPF | Ninguém, nem administradores |

Nenhum dado de perfil é acessível sem login. Perfis ocultos ou com vínculo suspenso somem da busca, das páginas de unidade e das novidades.

### Consentimento e bases legais

O cadastro exige dois aceites separados, versionados: o Termo de Consentimento e a Autorização de consulta do CPF. Exibição do perfil, contatos opcionais e consultas do CPF se baseiam no consentimento (art. 7º, I); conta e autenticação, na execução das regras de uso (art. 7º, V); segurança, prevenção de fraudes e a cópia dos dados abertos do Portal, no legítimo interesse (art. 7º, IX). Nunca editar uma versão publicada: publicar uma nova.

### CPF

Consultado no Portal da Transparência no cadastro, a cada 180 dias (vínculo) e a cada 30 dias (perfil atualizado). Guardado criptografado (`cpf_cifrado`, Fernet, chave em `CPF_ENCRYPTION_KEY`) e como HMAC (`cpf_hash`). Nunca exibido nem gravado em logs. Do Portal, só fica na conta o que for preenchido no perfil e uma sugestão pendente.

### Exclusão de conta

O titular pode excluir a conta no próprio perfil, com confirmação por senha. Perfil, formações, temas, favoritos (feitos e recebidos), novidades e foto são apagados na hora.

---

## Segurança

- Senhas com `bcrypt`; bloqueio de login após 5 tentativas incorretas (15 minutos)
- Sessão em cookies HttpOnly (flag Secure configurável), com refresh
- Redefinição de senha por token de uso único (hash `sha256`, válido por 1h)
- CPF criptografado (Fernet) e como HMAC; cópia local do Portal guarda só HMAC dos dígitos divulgados
- Fotos servidas só a usuários logados, reencodadas em JPEG (sem EXIF)
- Links externos aceitos só dos domínios esperados (gov.br, Lattes, LinkedIn)
- CSP restritiva no nginx; HTTPS via Cloudflare
- Validação de entrada com Pydantic (backend) e Zod (frontend)
- Variáveis de ambiente via `.env` (nunca no repositório)

---

## Operação

### Deploy

Push em `main` → GitHub Actions no servidor → `.env` escrito a partir do secret `ENV_PROD` → build → `alembic upgrade head` → smoke test. Se o secret não trouxer `CPF_ENCRYPTION_KEY`, o workflow usa a cópia em `~/backup-chaves/` no servidor; se trouxer uma chave diferente da guardada, o deploy para (trocar a chave tornaria os CPFs ilegíveis). **Guarde essa chave também fora do servidor.**

### Atualização mensal da cópia do Portal

Com o download em massa do Portal ("Servidores — SIAPE", arquivo `AAAAMM_Cadastro.csv`):

```bash
# no computador (não precisa do app configurado)
python backend/base_local.py extrair AAAAMM_Cadastro.csv > atps.csv
# no servidor, dentro do container da API
python base_local.py importar AAAAMM /tmp/atps.csv
```

Apague o `atps.csv` depois. Órgãos que o SIAPE ainda chama pelo nome antigo vão em `lotacao_auto.APELIDOS_ORGAO`.

### SIORG

Sincronizado pela tarefa diária. Para forçar: `python siorg.py` no container da API.

---

## Desenvolvimento local

### Pré-requisitos

- Python 3.12+, Node 22+, Docker
- Túnel SSH para o banco (PostgreSQL no servidor `damaceno`):

```bash
ssh -i ~/.ssh/id_ed25519 -p 2222 -L 5432:localhost:5432 -N rodigozeus@localhost
```

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # ou .venv\Scripts\activate no Windows
pip install -r requirements.txt
cp ../.env.example .env  # preencher DATABASE_URL, JWT_SECRET_KEY, CPF_HASH_SECRET e CPF_ENCRYPTION_KEY
uvicorn main:app --reload
# API em http://localhost:8000 (Swagger em /docs com ENABLE_DOCS=true)
```

Sem `PORTAL_TRANSPARENCIA_TOKEN`, a verificação usa só a cópia local (e, sem ela, todo cadastro fica pendente). Sem SMTP, os e-mails só aparecem no log.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env  # VITE_API_BASE_URL=/api
npm run dev            # http://localhost:5173
npm run mock           # opcional: API simulada da Invicta, sem backend
```
