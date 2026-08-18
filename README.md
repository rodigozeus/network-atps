# Rede ATPS

Plataforma de networking profissional para Analistas Técnicos/as de Políticas Sociais (ATPS).

**Status:** Fases 0–10 concluídas — https://redeatps.org

---

## O que é

A Rede ATPS é uma plataforma web onde cada analista cria e mantém seu perfil profissional e pode encontrar colegas por ministério, área de atuação, formação acadêmica ou tema de política pública. Baseada na proposta da **Rede ATPS** idealizada pela Andeps em 2018, desenvolvida voluntariamente por um ATPS da carreira.

---

## Funcionalidades

### Implementadas

- **Autenticação** — registro e login por e-mail pessoal (privado por padrão, compartilhado só com consentimento explícito); JWT com refresh token; rotas protegidas; após login redireciona direto para a busca
- **Redefinição de senha por e-mail** — fluxo "esqueci minha senha" com token de uso único (válido por 1h, hash `sha256` no banco); envio por SMTP configurável, com fallback para log no console em dev quando o SMTP não está configurado
- **Bloqueio por tentativas de login** — 5 tentativas incorretas bloqueiam a conta por 15 minutos
- **Validação de cadastro por lista de servidores** — nome informado no registro é conferido contra uma lista de ATPs (CSV carregado pelo admin); encontrado → conta ativada na hora; não encontrado → conta fica `pendente_revisao` até um admin aprovar manualmente
- **Perfil completo** — ministério → secretaria → departamento → CG → coordenação (com siglas), contatos, controle de visibilidade (celular e e-mail pessoal), cargo FCE, portal URL, turma (2012, 2016, CPNU 2024), foto de perfil
- **Formação acadêmica** — múltiplos registros por nível (graduação, especialização, mestrado, doutorado)
- **Temas de atuação** — lista dinâmica com flag de exercício atual (habilita busca por histórico)
- **Busca multi-critério** — palavra-chave geral, filtros por ministério, secretaria, tema e formação, combinados livremente; sincronizado com URL (compartilhável); scroll infinito no frontend (carrega a próxima página automaticamente ao aproximar do fim da lista)
- **Ordenação ponderada** — sem filtros ativos, perfis aparecem em ordem aleatória ponderada pela completude: cada campo preenchido (13 itens únicos — contatos, lotação, cargo, foto, formação, temas) aumenta o peso no sorteio; todos têm chance de aparecer no topo, mas perfis mais completos têm até 14× mais probabilidade; perfis sem foto são sempre exibidos ao final da lista
- **Painel administrativo Andeps** — gestão de usuários (busca, filtro por status/pendência, edição, ativação/desativação/reativação, exclusão permanente), estatísticas da carreira (por ministério, formação e tema, com gráficos), exportação CSV completa, tela de configurações para atualizar a lista de servidores; roles: `admin` (acesso total) e `andeps` (sem edição de perfil, sem exclusão)
- **Layout responsivo** — experiência otimizada para mobile: header compacto, sidebar de filtros colapsável, cards em coluna única em telas pequenas, padding adaptado em todos os formulários
- **Consentimento LGPD** — ativação de visibilidade de celular/e-mail pessoal exige confirmação explícita; celular exibido como link direto para o WhatsApp com mensagem pré-preenchida
- **CI/CD automático** — push em `main` → build → migrations Alembic → deploy no damaceno com smoke test

### Previstas (próximas fases)

- Notificação de perfil desatualizado
- Exportação do perfil em PDF
- Autenticação google.com

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | FastAPI (Python 3.12) |
| Banco | PostgreSQL 16 |
| ORM | SQLAlchemy + Alembic |
| Servidor web | nginx |
| Containers | Docker + docker-compose |
| CI/CD | GitHub Actions (self-hosted runner) |
| Acesso público | Cloudflare Tunnel → `redeatps.org` |

---

## Arquitetura

```
GitHub (push em main)
  └── GitHub Actions — runner damaceno-atps
        └── docker compose -f docker-compose.prod.yml up --build
              ├── atps-frontend  (nginx + React build)  → 127.0.0.1:8512
              │     Cloudflare Tunnel → redeatps.org
              └── atps-api       (FastAPI)
                    └── db-network → postgres:5432/atps_db
```

### Frontend: MFE-ready

Cada domínio isolado em `src/features/<domínio>/` com componentes, hooks e chamadas de API próprios. Permite extrair para Module Federation no futuro sem reescrever o código.

---

## Estrutura do Projeto

```
network-atps/
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/       # Login, registro, esqueci/redefinir senha
│   │   │   ├── perfil/     # Criação e edição de perfil
│   │   │   ├── busca/      # Busca e descoberta (scroll infinito)
│   │   │   └── admin/      # Painel Andeps (usuários, stats, exportação, configurações)
│   │   ├── shared/
│   │   │   ├── components/ # Button, Input, Card, Tag, Badge, Spinner, Layout
│   │   │   ├── hooks/      # useAuth, useApi
│   │   │   └── api/        # cliente axios + tipos TypeScript
│   │   ├── index.css       # Design tokens globais (cores, tipografia, espaçamento)
│   │   └── App.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
│
├── backend/
│   ├── routers/
│   │   ├── auth.py         # Registro, login, refresh, esqueci/redefinir senha, JWT
│   │   ├── perfil.py       # CRUD completo + foto upload
│   │   ├── busca.py        # Busca multi-critério paginada
│   │   └── admin.py        # Usuários, stats, exportação CSV, lista de servidores
│   ├── auth.py              # Hash de senha, tokens JWT, dependências de autenticação
│   ├── email_utils.py       # Envio de e-mail de redefinição de senha (SMTP)
│   ├── csv_utils.py         # Validação de nome contra a lista de servidores
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── alembic/
│   └── Dockerfile
│
├── docker-compose.yml          # Desenvolvimento local
├── docker-compose.prod.yml     # Produção
└── .github/workflows/deploy.yml
```

---

## Design e responsividade

O frontend usa **CSS Modules** com design tokens centralizados em `index.css` (paleta Andeps, tipografia Poppins, escala de espaçamento e sombras).

### Breakpoints

| Breakpoint | Comportamento |
|---|---|
| > 768px | Layout padrão desktop: sidebar de filtros visível, grid de cards multi-coluna |
| ≤ 768px | Sidebar colapsável (botão "Filtros" na barra de busca); grid se adapta |
| ≤ 640px | Header compacto: subtítulo e nome do usuário ocultos, botões menores, padding reduzido |
| ≤ 600px | Perfil: header empilhado, formulários em coluna única, padding reduzido |
| ≤ 480px | Cards de resultado em coluna única; padding dos formulários de auth reduzido |

### Fluxo de navegação

- Usuário não autenticado: redirecionado para `/login` ao tentar acessar qualquer rota da aplicação
- Após login: redirecionado automaticamente para `/busca`
- Após registro: redirecionado para `/login`
- `/esqueci-senha` → `/redefinir-senha?token=...`: fluxo de recuperação de senha, público (fora do `Layout` autenticado)
- Cadastro não encontrado na lista de servidores: fica pendente de revisão manual por um admin antes de poder logar

---

## Banco de Dados

```
analistas
  id, nome, senha_hash, criado_em, atualizado_em
  role: analista | andeps | admin
  ativo: bool (soft delete — desativação sem perda de dados)
  pendente_revisao: bool (cadastro não encontrado na lista de servidores)
  email_pessoal (obrigatório — identificador de acesso, privado por padrão)
  email_institucional (opcional)
  visibilidade_email_pessoal
  telefone_institucional (opcional)
  celular, visibilidade_celular
  ministerio, ministerio_sigla
  secretaria, secretaria_sigla
  departamento, departamento_sigla
  coordenacao_geral, coordenacao
  cargo_fce, portal_url, turma, foto_path
  reset_token_hash, reset_token_expires_em (redefinição de senha)
  login_tentativas_falhas, login_bloqueado_ate (bloqueio por tentativas)

formacoes  (N por analista)
  nivel: graduacao | especializacao | mestrado | doutorado
  curso, instituicao

temas_atuacao  (N por analista)
  tema, em_exercicio_atual
```

Migrations versionadas via Alembic, aplicadas automaticamente no deploy.

---

## LGPD

A plataforma foi projetada com proteção de dados pessoais como requisito desde o início, seguindo os princípios da **Lei Geral de Proteção de Dados (Lei nº 13.709/2018)**.

### Dados sensíveis e consentimento explícito

Celular e e-mail pessoal são tratados como dados de acesso restrito. Para torná-los visíveis a outros usuários, o analista precisa ativar a visibilidade no seu perfil — e ao fazer isso, um modal de confirmação é exibido com linguagem clara:

> *"Ao tornar seu celular visível, você autoriza a Rede ATPS a exibi-lo para os demais usuários cadastrados na plataforma, em conformidade com a LGPD. Você poderá revogar essa autorização a qualquer momento editando seu perfil."*

Somente após confirmação explícita o dado é marcado como visível. A revogação é imediata e sem fricção — basta desmarcar o toggle no perfil e salvar.

### O que é exibido e para quem

| Dado | Sem autorização | Com autorização |
|---|---|---|
| E-mail pessoal | Oculto (usado só para acesso) | Visível a usuários autenticados |
| E-mail institucional | Visível se preenchido (dado funcional) | — |
| Telefone institucional | Visível se preenchido (dado funcional) | — |
| Celular | Oculto | Visível a usuários autenticados (link WhatsApp) |

Nenhum dado de contato pessoal é exposto a visitantes não autenticados.

### Base legal

O tratamento dos dados pessoais dos analistas cadastrados tem como base legal o **legítimo interesse** no contexto de uma rede profissional de servidores públicos da carreira ATPS, conforme art. 7º, IX da LGPD, e o **consentimento explícito** (art. 7º, I) para os dados de contato de acesso opcional.

---

## Segurança

- Senhas com hash `bcrypt`
- Autenticação stateless com JWT (access 7d + refresh 30d)
- Redefinição de senha por token de uso único (hash `sha256`, validade de 1h, invalidado após o uso)
- Bloqueio de login após 5 tentativas incorretas (15 minutos)
- Validação de identidade no cadastro contra lista de servidores (nomes fora da lista exigem aprovação manual de um admin)
- HTTPS automático via Cloudflare
- Dados sensíveis (celular, e-mail pessoal) só exibidos após consentimento explícito e apenas para usuários autenticados
- Variáveis de ambiente via `.env` (nunca vão ao repositório)
- Validação de entrada com Pydantic (backend) e Zod (frontend)

---

## Desenvolvimento local

### Pré-requisitos

- Python 3.12+, Node 22+, Docker
- Túnel SSH ativo para o banco (PostgreSQL no servidor `damaceno`):

```bash
ssh -i ~/.ssh/id_ed25519 -p 2222 -L 5432:localhost:5432 -N rodigozeus@localhost
```

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # ou .venv\Scripts\activate no Windows
pip install -r requirements.txt
cp ../.env.example .env  # preencher DATABASE_URL e JWT_SECRET_KEY (SMTP é opcional — sem ele, o link de redefinição de senha só é logado no console)
uvicorn main:app --reload
# API disponível em http://localhost:8000
# Swagger UI em http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env  # VITE_API_BASE_URL=/api
npm run dev
# App disponível em http://localhost:5173
```
