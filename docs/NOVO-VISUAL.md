# Novo visual da Rede ATPS — guia de implantação

Este guia acompanha o ramo `novo-visual`. Ele explica o que mudou no frontend, o que o back-end precisa ganhar e em que ordem implantar.

O frontend continua com a mesma pilha: React 18, TypeScript, Vite, react-router, react-hook-form, zod, axios e CSS Modules. **Só o frontend foi alterado.** Os endpoints novos estão descritos aqui, com código sugerido, para quem cuida do back-end.

> **Dá para publicar o frontend antes do back-end.** Cada recurso que depende de endpoint novo tem uma alternativa provisória, descrita na [seção 4](#4-o-que-acontece-sem-cada-endpoint-novo). Com o back-end atual, nada quebra; só alguns recursos ficam limitados.

---

## Sumário

1. [Como rodar](#1-como-rodar)
2. [O que mudou no frontend](#2-o-que-mudou-no-frontend)
3. [O que o back-end precisa ganhar](#3-o-que-o-back-end-precisa-ganhar)
4. [O que acontece sem cada endpoint novo](#4-o-que-acontece-sem-cada-endpoint-novo)
5. [Fluxo de cadastro e verificação no Portal da Transparência](#5-fluxo-de-cadastro-e-verificação-no-portal-da-transparência)
6. [Ordem sugerida de implantação](#6-ordem-sugerida-de-implantação)
7. [Checklist de testes](#7-checklist-de-testes)
8. [Pontos em aberto](#8-pontos-em-aberto)

---

## 1. Como rodar

### Com o back-end real

O fluxo de sempre funciona como antes: o Vite repassa `/api` e `/uploads` para `localhost:8000`.

```bash
cd frontend
npm install
npm run dev
```

### Sem o back-end, com a API simulada

`frontend/mock-api/` traz uma API falsa em Node, sem dependências. Ela usa 20 pessoas de exemplo e responde aos endpoints atuais e aos novos. Serve para revisar o visual sem banco de dados.

```bash
cd frontend
npm run mock     # terminal 1: API simulada em localhost:8000
npm run dev      # terminal 2: frontend em localhost:5173
```

Dados de acesso da simulação:

- **Login:** `cecilia.sousa@email.com`, senha `senha1234`. Essa pessoa é administradora na simulação.
- **Cadastro com CPF encontrado no Portal:** use o CPF `529.982.247-25`. A conta fica ativa e a pessoa vai direto para "Complete seu perfil".
- **Cadastro pendente:** qualquer outro CPF válido deixa o cadastro pendente.
- **Imitar o back-end de hoje**, sem os endpoints novos: `SEM_NOVOS=1 npm run mock`.

A pasta `mock-api/` é só para desenvolvimento. Ela está no `.dockerignore` e não entra na imagem de produção.

---

## 2. O que mudou no frontend

### 2.1 Nova fonte: Manrope

A fonte da interface passou de **Poppins**, vinda do Google Fonts, para **Manrope**.

| | Antes | Agora |
|---|---|---|
| Fonte | Poppins, `<link>` para fonts.googleapis.com no `index.html` | Manrope variável (pesos 200 a 800), pacote npm `@fontsource-variable/manrope` |
| Onde é carregada | `index.html` | `src/main.tsx`: `import '@fontsource-variable/manrope'` |
| Variável CSS | `--font: 'Poppins', …` | `--font: 'Manrope Variable', 'Manrope', …` em `src/index.css` |

O arquivo da fonte agora vai **dentro do build**, e o site não depende mais do Google Fonts para exibir o texto.

Nada a fazer no nginx nem no Dockerfile: `npm ci` baixa o pacote e o Vite copia os arquivos `.woff2` para `dist/assets`.

> Licença: Manrope usa a SIL Open Font License 1.1, que permite uso comercial e embutir a fonte.

### 2.2 Ícones

Entrou a biblioteca `@tabler/icons-react` (licença MIT). Cada ícone é um componente React importado individualmente, como `<IconSearch />`, então o build leva só os ícones usados.

### 2.3 Tokens de design (`src/index.css`)

As variáveis antigas (`--color-*`, `--sp-*`, `--r-*` etc.) **foram mantidas**, porque as telas de administração ainda usam. As novas ficam no fim do `:root`:

| Variável | Uso |
|---|---|
| `--card`, `--ink`, `--muted`, `--line` | fundo de cartão, texto, texto secundário e linhas divisórias |
| `--btn`, `--btn-hover` | botões neutros redondos (contatos) |
| `--edu-*`, `--topic-*` | chips de formação (lilás) e de temas (laranja) |
| `--gradiente-marca` | gradiente laranja de assinatura (topo da busca e telas de acesso) |
| `--barra-h`, `--conteudo` | altura da barra fixa (72px) e largura do conteúdo (1320px) |
| `--r-card`, `--sombra-card` | raio e sombra dos cards |

Também mudou `--color-background`, de `#f4f5f7` para `#eef0f3`.

### 2.4 Rotas

As rotas são as mesmas, sem nenhuma nova:

| Rota | Antes | Agora |
|---|---|---|
| `/login` | cartão simples | fundo laranja, logo em branco e aviso ao sair ou excluir a conta |
| `/registrar` | ao confirmar, mandava para o login | ao confirmar no Portal, **entra sozinho e abre "Complete seu perfil"** ([seção 5](#5-fluxo-de-cadastro-e-verificação-no-portal-da-transparência)) |
| `/esqueci-senha`, `/redefinir-senha` | cartão simples | mesmo visual das telas de acesso; a lógica não mudou |
| `/busca` | lista de resultados | rede animada no topo, cards ou linhas, filtros com rolagem infinita |
| `/analistas/:id` | card do perfil | perfil completo sem abreviações; no próprio perfil: Editar e Excluir |
| `/perfil` | visualizar e editar | **só edição**, em duas abas; sem ministério informado, vira "Complete seu perfil" |
| `/admin/*` | — | lógica intacta; ganhou a barra, o rodapé e os novos `Input` e `Button` |

O menu da conta ("Ver perfil") aponta para `/analistas/{id do usuário}`. A visualização do próprio perfil passou a ser a mesma página que os colegas veem.

### 2.5 Arquivos

**Novos**

```
src/shared/components/Barra.tsx (+ .module.css)   barra fixa: transparente sobre o topo, laranja ao rolar
src/shared/components/MenuConta.tsx               foto, nome e menu (Ver perfil, Editar, Painel admin, Sair)
src/shared/components/Rodape.tsx (+ .module.css)  rodapé com os créditos
src/shared/components/Avatar.tsx (+ .module.css)  foto redonda ou iniciais sobre gradiente
src/shared/components/Logo.tsx                    marca Rede ATPS em SVG (horizontal e empilhada)
src/shared/api/favoritos.ts                       /favoritos/* (com alternativa no navegador)
src/shared/api/lotacoes.ts                        GET /lotacoes
src/shared/api/temas.ts                           GET /temas
src/shared/api/semEndpoint.ts                     detecta 404/405/501 para acionar as alternativas
src/shared/hooks/useFavoritos.ts                  estado de favoritos compartilhado entre telas
src/shared/utils/analista.ts                      iniciais, cores, gradiente por órgão, nomes de nível e turma
src/features/busca/RedeHero.tsx (+ .module.css)   rede animada do topo da busca
src/features/busca/AnalistaCard.tsx               card da busca
src/features/busca/AnalistaLinha.tsx              linha da busca (visão em lista)
src/features/busca/Chips.tsx, Contatos.tsx, BotaoFavorito.tsx
src/features/perfil/CamposLotacao.tsx             órgão de exercício em listas encadeadas, com "+ Adicionar"
src/features/perfil/EditorTemas.tsx               temas com "em exercício atual" ou "experiência anterior"
src/features/perfil/EditorFormacoes.tsx           formação acadêmica
src/features/auth/TelaAcesso.tsx                  moldura das telas de acesso
src/shared/components/Andeps.tsx (+ .module.css)  "by Andeps" com link para andeps.org.br (topo, barra reduzida e rodapé)
public/ministerio.png                             ilustração da capa dos cards
public/andeps.png                                 logo da Andeps em branco
public/favicon.svg, favicon-32.png                favicon novo (o "R" da marca sobre o laranja)
public/apple-touch-icon.png                       ícone para a tela inicial do iPhone
public/og-image-v3.png                            imagem de prévia de link (substitui og-image-v2.png)
mock-api/                                         API simulada (só desenvolvimento)
```

**Removidos:**

- **Substituídos pelos novos:** `BuscaResultCard.tsx`, `ProfileCard.tsx`, `ProfileEditForm.tsx`, `FormacaoList.tsx` e `TemaList.tsx`.
- **Sem uso depois da troca:**
  - componentes `Card`, `Tag` e `Badge` (com seus `.module.css`);
  - o hook `useApi.ts`;
  - os `.gitkeep` das pastas que já têm arquivos.

**Alterados que valem atenção**

- **`AuthContext.tsx`:** ganhou `atualizarUsuario(user)`, para a barra refletir nome e foto logo depois de editar o perfil.
- **`Input` e `Button`:** foram redesenhados. Campos com 50px de altura e cantos de 14px; botões em formato de pílula. Isso **também muda o visual do painel de administração**.
  - O botão de mostrar senha agora recebe foco pelo teclado.
- **`index.html`:** favicons novos, `theme-color` e metadados de prévia de link. O endereço passou para `https://redeatps.org/`; **se o domínio de produção for outro, troque `og:url` e `og:image`**, que precisam de endereço absoluto.
- **Favoritos na busca:** a estrela do card ficava atrás do link que cobre o card e não recebia o clique. Corrigido com `z-index` em `busca.module.css`.
- **`Layout.tsx`:** a busca e o perfil ocupam a largura toda, com topo colorido; as outras páginas seguem num contêiner.

### 2.6 Dados que a interface passou a usar

Tudo isto **já existe na API**. Só não aparecia ou não era editável na interface anterior:

- **`temas[].em_exercicio_atual`:** os temas ficam separados entre "Em exercício atual" e "Experiência anterior". Na edição, cada tema novo tem a chave "Em exercício atual".
- **`turma`:** aparece no perfil ao lado do cargo ("Turma de 2016").
- **`portal_url`:** aparece como "Currículo SouGov.br" nos contatos do perfil.
- **`telefone_institucional`:** no card, o botão de ligar usa o celular; quando ele não é público, usa o telefone institucional.
- **Campos vazios na edição:** agora vão como `null` no `PUT /perfil/me`, para a pessoa conseguir **apagar** um dado.
  - Antes, valores vazios eram descartados e não dava para limpar um campo.
  - Nome e e-mail pessoal nunca vão vazios.

---

## 3. O que o back-end precisa ganhar

> **Status (18/11/2026): implementado.** Tudo desta seção está no back-end, com estas diferenças em relação ao código sugerido:
>
> - Migração única `e4f5a6b7c8d9` (favoritos, links e `pos_doutorado`), depois de `d3e4f5a6b7c8`. O id `c2d3e4f5a6b7` sugerido abaixo já estava em uso.
> - Os endpoints novos usam `get_usuario_regular` (quem tem pendência cadastral recebe 403) e `condicao_perfil_visivel()` em vez de `Analista.ativo`, para não expor perfis ocultos ou com vínculo suspenso em `/lotacoes`, `/temas` e `/favoritos/ids`.
> - `linkedin_url` só aceita `https://` de `linkedin.com`, e `lattes_url` só aceita links de `lattes.cnpq.br` (`http://` é convertido para `https://`). A mesma regra vale no formulário e na exibição do perfil.
> - Foto: o limite continua 5 MB (o texto da edição foi ajustado).

Resumo:

| # | Recurso | Endpoint | Muda o banco? |
|---|---|---|---|
| 3.1 | Favoritos | `GET /favoritos/ids`, `PUT` e `DELETE /favoritos/{id}`, `GET /busca?favoritos=true` | **sim**: tabela `favoritos` |
| 3.2 | Lotações conhecidas (listas de ministério, secretaria…) | `GET /lotacoes` | não |
| 3.3 | Catálogo de temas para o filtro | `GET /temas` | não |
| 3.4 | Filtro por nível de formação | `GET /busca?nivel_formacao=` | não |
| 3.5 | Remover foto | `DELETE /perfil/foto` | não |
| 3.6 | Links de LinkedIn e Lattes; nível "Pós-doutorado" | campos novos em `PUT /perfil/me` e nas respostas de perfil | **sim**: 2 colunas em `analistas` e 1 valor no enum `nivelformacao` |

O código abaixo segue o estilo dos routers existentes. Ele é uma sugestão a revisar, não foi rodado contra o banco real.

### 3.1 Favoritos

**Modelo**, em `models.py`:

```python
class Favorito(Base):
    """Quem (analista_id) favoritou quem (favorito_id)."""
    __tablename__ = "favoritos"

    analista_id: Mapped[int] = mapped_column(
        ForeignKey("analistas.id", ondelete="CASCADE"), primary_key=True
    )
    favorito_id: Mapped[int] = mapped_column(
        ForeignKey("analistas.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
```

> O `ondelete="CASCADE"` apaga os favoritos de quem excluiu a conta, nos dois sentidos: os que a pessoa fez e os que fizeram dela. Isso cumpre a promessa de "excluir todos os dados" do termo LGPD.

**Migração Alembic.** O head atual é `b1c2d3e4f5a6`:

```python
"""favoritos

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
"""
from alembic import op
import sqlalchemy as sa

revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"


def upgrade() -> None:
    op.create_table(
        "favoritos",
        sa.Column("analista_id", sa.Integer(), sa.ForeignKey("analistas.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("favorito_id", sa.Integer(), sa.ForeignKey("analistas.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_favoritos_favorito_id", "favoritos", ["favorito_id"])


def downgrade() -> None:
    op.drop_index("ix_favoritos_favorito_id", table_name="favoritos")
    op.drop_table("favoritos")
```

**Router**, novo arquivo `routers/favoritos.py`, registrado no `main.py` com `app.include_router(favoritos.router)`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Analista, Favorito

router = APIRouter(prefix="/favoritos", tags=["favoritos"])


@router.get("/ids", response_model=list[int])
def listar_ids(eu: Analista = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(Favorito.favorito_id).where(Favorito.analista_id == eu.id)))


@router.put("/{analista_id}", status_code=status.HTTP_204_NO_CONTENT)
def favoritar(analista_id: int, eu: Analista = Depends(get_current_user), db: Session = Depends(get_db)):
    alvo = db.get(Analista, analista_id)
    if alvo is None or not alvo.ativo:
        raise HTTPException(status_code=404, detail="Analista não encontrado")
    if db.get(Favorito, (eu.id, analista_id)) is None:  # idempotente
        db.add(Favorito(analista_id=eu.id, favorito_id=analista_id))
        db.commit()


@router.delete("/{analista_id}", status_code=status.HTTP_204_NO_CONTENT)
def desfavoritar(analista_id: int, eu: Analista = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Favorito).filter_by(analista_id=eu.id, favorito_id=analista_id).delete()
    db.commit()
```

**Busca: parâmetro `favoritos`**, em `routers/busca.py`:

```python
def buscar(
    ...,
    favoritos: bool = Query(False, description="Só analistas favoritados por quem está logado"),
    db: Session = Depends(get_db),
    eu: Analista = Depends(get_current_user),   # antes: "_"
):
    ...
    if favoritos:
        query = query.filter(exists().where(
            Favorito.analista_id == eu.id,
            Favorito.favorito_id == Analista.id,
        ))
```

Contrato que o frontend espera:

| Chamada | Resposta |
|---|---|
| `GET /favoritos/ids` | `200`, com `[4, 17, 23]` |
| `PUT /favoritos/{id}` | `204`; `404` se a pessoa não existe ou está inativa |
| `DELETE /favoritos/{id}` | `204`, mesmo que não fosse favorito |
| `GET /busca?favoritos=true&…` | mesmo formato de `BuscaResponse` |

### 3.2 Lotações conhecidas: `GET /lotacoes`

Alimenta:

- as **listas encadeadas** do "Órgão de exercício" na edição do perfil: cada nível é filtrado pelo nível acima;
- a lista **"Todos os órgãos"** do filtro da busca.

As opções saem das lotações **que as próprias pessoas já cadastraram**, então não é preciso manter uma tabela de órgãos. Quando alguém escolhe "+ Adicionar" e salva, o nome novo passa a aparecer para os próximos.

```
GET /lotacoes?nivel=secretaria&ministerio=Ministério da Saúde
```

| Parâmetro | Obrigatório | Valores |
|---|---|---|
| `nivel` | sim | `ministerio`, `secretaria`, `departamento`, `coordenacao_geral`, `coordenacao` |
| `ministerio`, `secretaria`, `departamento`, `coordenacao_geral` | não | **nome completo** do nível acima, para filtrar |

Resposta, em ordem alfabética:

```json
[
  { "nome": "Secretaria de Atenção Primária à Saúde", "sigla": "SAPS", "total": 12 },
  { "nome": "Secretaria de Saúde Indígena", "sigla": "SESAI", "total": 4 }
]
```

`sigla` vem `null` nos níveis que não têm sigla (`coordenacao_geral` e `coordenacao`).

Sugestão de implementação, que pode ficar em `routers/perfil.py`:

```python
from typing import Literal
from pydantic import BaseModel
from sqlalchemy import func, null, select

class LotacaoOut(BaseModel):
    nome: str
    sigla: str | None
    total: int

NIVEIS_LOTACAO = {
    "ministerio": (Analista.ministerio, Analista.ministerio_sigla),
    "secretaria": (Analista.secretaria, Analista.secretaria_sigla),
    "departamento": (Analista.departamento, Analista.departamento_sigla),
    "coordenacao_geral": (Analista.coordenacao_geral, None),
    "coordenacao": (Analista.coordenacao, None),
}

@router.get("/lotacoes", response_model=list[LotacaoOut])
def listar_lotacoes(
    nivel: Literal["ministerio", "secretaria", "departamento", "coordenacao_geral", "coordenacao"],
    ministerio: str | None = None,
    secretaria: str | None = None,
    departamento: str | None = None,
    coordenacao_geral: str | None = None,
    db: Session = Depends(get_db),
    _: Analista = Depends(get_current_user),
):
    col_nome, col_sigla = NIVEIS_LOTACAO[nivel]
    # sigla mais usada para aquele nome (max() basta enquanto não houver conflito)
    sigla = func.max(col_sigla) if col_sigla is not None else null()
    stmt = (
        select(col_nome, sigla, func.count())
        .where(Analista.ativo.is_(True), col_nome.isnot(None), col_nome != "")
        .group_by(col_nome)
        .order_by(col_nome)
    )
    filtros = {"ministerio": ministerio, "secretaria": secretaria,
               "departamento": departamento, "coordenacao_geral": coordenacao_geral}
    ordem = list(NIVEIS_LOTACAO)
    for acima in ordem[: ordem.index(nivel)]:
        if filtros[acima]:
            stmt = stmt.where(NIVEIS_LOTACAO[acima][0] == filtros[acima])
    return [LotacaoOut(nome=n, sigla=s, total=t) for n, s, t in db.execute(stmt)]
```

> **Para o futuro:** se a Andeps quiser uma lista oficial de órgãos (por exemplo, do SIORG), basta trocar a consulta por uma tabela própria e manter o mesmo contrato. O frontend não muda.

### 3.3 Catálogo de temas: `GET /temas`

Usado no filtro **"Todos os temas"** da busca. O endpoint de sugestões que já existe (`/perfil/temas/sugestoes`) devolve só 8 temas, o que não serve para o filtro.

```json
[ { "tema": "Igualdade racial", "total": 9 }, { "tema": "Atenção primária", "total": 5 } ]
```

```python
class TemaCatalogoOut(BaseModel):
    tema: str
    total: int

@router.get("/temas", response_model=list[TemaCatalogoOut])
def catalogo_temas(db: Session = Depends(get_db), _: Analista = Depends(get_current_user)):
    total = func.count(func.distinct(TemaAtuacao.analista_id))
    stmt = (
        select(TemaAtuacao.tema, total)
        .join(Analista, Analista.id == TemaAtuacao.analista_id)
        .where(Analista.ativo.is_(True))
        .group_by(TemaAtuacao.tema)
        .order_by(total.desc(), TemaAtuacao.tema)
    )
    return [TemaCatalogoOut(tema=t, total=n) for t, n in db.execute(stmt)]
```

### 3.4 Filtro por nível de formação: `GET /busca?nivel_formacao=`

O filtro **"Toda formação"** da busca é por nível: Doutorado, Mestrado, Especialização ou Graduação. O parâmetro `formacao` que já existe procura texto em curso e instituição, então continua valendo para outra finalidade.

```python
from models import NivelFormacao

def buscar(
    ...,
    nivel_formacao: NivelFormacao | None = Query(None, description="Tem formação neste nível"),
    ...
):
    ...
    if nivel_formacao:
        query = query.filter(exists().where(
            Formacao.analista_id == Analista.id,
            Formacao.nivel == nivel_formacao,
        ))
```

### 3.5 Remover foto: `DELETE /perfil/foto`

Na edição há o botão "Remover foto". Resposta: o `AnalistaOut` atualizado.

```python
@router.delete("/perfil/foto", response_model=AnalistaOut)
def remover_foto(analista: Analista = Depends(get_current_user), db: Session = Depends(get_db)):
    if analista.foto_path and os.path.exists(analista.foto_path):
        os.remove(analista.foto_path)
    analista.foto_path = None
    db.commit()
    db.refresh(analista)
    return analista
```

### 3.6 Links de LinkedIn e Lattes, e nível "Pós-doutorado"

Em **Editar perfil**, ao lado do currículo do SouGov.br, entraram dois links opcionais: **LinkedIn** (`linkedin_url`) e **Currículo Lattes** (`lattes_url`). Eles aparecem nos contatos do perfil público. A formação acadêmica ganhou o nível **Pós-doutorado** (`pos_doutorado`), o mais alto da lista. Ele aparece no editor de formações, no filtro da busca e nos chips dos cards.

**Sem essa mudança no back-end:** o Pydantic ignora campos que não conhece, então os dois links somem sem erro ao salvar. Adicionar uma formação "Pós-doutorado" volta 422.

`models.py`:

```python
class NivelFormacao(str, enum.Enum):
    graduacao = "graduacao"
    especializacao = "especializacao"
    mestrado = "mestrado"
    doutorado = "doutorado"
    pos_doutorado = "pos_doutorado"

# em Analista, ao lado de portal_url
linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
lattes_url: Mapped[str | None] = mapped_column(Text, nullable=True)
```

`schemas.py`: acrescentar `linkedin_url: str | None = None` e `lattes_url: str | None = None` em todo lugar onde hoje existe `portal_url` (saída completa, saída pública e atualização).

Migração Alembic. Ela vem **depois da migração dos favoritos** (`c2d3e4f5a6b7`, seção 3.1). Se os favoritos ficarem para depois, use `down_revision = "b1c2d3e4f5a6"` aqui e faça a dos favoritos apontar para esta:

```python
"""links linkedin e lattes, nivel pos_doutorado

Revision ID: a9c3e5f7b2d4
Revises: c2d3e4f5a6b7
"""
from alembic import op
import sqlalchemy as sa

revision = "a9c3e5f7b2d4"
down_revision = "c2d3e4f5a6b7"

def upgrade() -> None:
    op.add_column("analistas", sa.Column("linkedin_url", sa.Text(), nullable=True))
    op.add_column("analistas", sa.Column("lattes_url", sa.Text(), nullable=True))
    # No PostgreSQL, ADD VALUE não roda dentro de transação em versões antigas
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE nivelformacao ADD VALUE IF NOT EXISTS 'pos_doutorado'")

def downgrade() -> None:
    op.drop_column("analistas", "lattes_url")
    op.drop_column("analistas", "linkedin_url")
    # o valor 'pos_doutorado' fica no enum: o PostgreSQL não remove valores de enum
```

Se a exportação CSV do painel e as estatísticas listam os níveis de forma fixa, incluir `pos_doutorado` também.

### 3.7 O que **não** precisa mudar

- **Autenticação, cadastro, Portal da Transparência e redefinição de senha:** o frontend usa os endpoints como estão.
- **Visibilidade de e-mail pessoal e celular:** a API já devolve `null` quando a pessoa não autorizou, e o frontend só esconde o que vem vazio.
- **Pessoas próximas no perfil:** usa a busca atual, com até 4 chamadas por tema e por ministério. Um endpoint próprio, como `GET /analistas/{id}/proximos`, deixaria isso mais leve, mas é opcional.
- **`foto_path`:** o frontend monta a URL como `/${foto_path}`, igual ao anterior.

---

## 4. O que acontece sem cada endpoint novo

O frontend detecta respostas `404`, `405` e `501` (`src/shared/api/semEndpoint.ts`) e usa uma alternativa. Para testar esse comportamento, rode `SEM_NOVOS=1 npm run mock`.

| Sem… | Comportamento provisório | Limitação |
|---|---|---|
| `/favoritos/*` | favoritos guardados no navegador (`localStorage`, chave `favoritos`) | não acompanham a pessoa entre aparelhos; o filtro "Favoritos" mostra só os favoritos entre as pessoas já carregadas na lista |
| `/lotacoes` | os campos de órgão viram **texto livre** (como na versão anterior); o filtro de órgão lista os ministérios das 20 primeiras pessoas | sem listas encadeadas nem padronização de nomes |
| `/temas` | o filtro de tema usa `/perfil/temas/sugestoes` | só os 8 temas mais citados |
| `?nivel_formacao` | o back-end ignora o parâmetro | **o filtro de formação não filtra.** É o único recurso que fica sem efeito |
| `DELETE /perfil/foto` | salva os outros dados e avisa "remover a foto ainda não está disponível" | não remove a foto |
| campos da seção 3.6 | o Pydantic ignora `linkedin_url` e `lattes_url` | os links não são salvos; formação "Pós-doutorado" volta 422 ao salvar |

Quando o back-end publicar os endpoints, os recursos passam a funcionar sozinhos, sem novo deploy do frontend.

> **Migração dos favoritos:** quem favoritou no período provisório tem a lista só no próprio navegador. Se valer a pena, dá para enviá-la uma vez ao servidor no primeiro acesso depois do deploy: ler `localStorage['favoritos']`, chamar `PUT /favoritos/{id}` para cada id e apagar a chave.

---

## 5. Fluxo de cadastro e verificação no Portal da Transparência

O back-end **não muda**. O que mudou foi o que o frontend faz com a resposta de `POST /auth/register`:

```
POST /auth/register
  │
  ├─ ativo = true  (CPF encontrado como ATPS no Portal da Transparência)
  │     └─ frontend chama POST /auth/login com o mesmo e-mail e senha
  │          └─ abre /perfil no modo "Complete seu perfil"  ← novo
  │
  └─ ativo = false, pendente_revisao = true  (não encontrado ou Portal indisponível)
        └─ tela "Cadastro em análise": a pessoa recebe e-mail quando a administração aprovar
           (o login dessa conta continua devolvendo 403 com a mensagem da API)
```

- **"Complete seu perfil":** aparece enquanto o perfil não tem ministério ou quando a pessoa vem do cadastro. O botão "Cancelar" vira "Preencher depois" e leva à busca.
- **Falha no login automático:** é raro, mas, se acontecer, aparece a tela "Cadastro confirmado" com o link para o login.
- **Aprovação manual:** continua no painel de administração (`/admin/usuarios`, filtro "Ag. revisão"), sem mudanças.

---

## 6. Ordem sugerida de implantação

1. **Frontend:** publicar o ramo `novo-visual`. Funciona com o back-end atual, com as limitações da [seção 4](#4-o-que-acontece-sem-cada-endpoint-novo).
2. **Back-end, sem migração:**
   - `?nivel_formacao` em `/busca`. Faça primeiro: é o único recurso que fica sem efeito até lá.
   - `GET /temas`, `GET /lotacoes` e `DELETE /perfil/foto`.
3. **Back-end, com migração:**
   - tabela `favoritos`, `/favoritos/*` e `?favoritos=true` em `/busca`;
   - colunas `linkedin_url` e `lattes_url` e o valor `pos_doutorado` (seção 3.6). Essa migração vem depois da dos favoritos.

Os passos 2 e 3 podem ir juntos. Nenhum deles exige novo deploy do frontend.

---

## 7. Checklist de testes

**Acesso**
- [ ] Login com dados corretos abre `/busca`; com senha errada, mostra o erro.
- [ ] Login de conta pendente mostra a mensagem de "pendente de verificação" da API.
- [ ] "Sair", no menu da conta, volta ao login com "Você saiu da sua conta".
- [ ] "Esqueceu sua senha?" e "redefinir senha" continuam funcionando.
- [ ] Cadastro com CPF encontrado no Portal entra direto em "Complete seu perfil".
- [ ] Cadastro com CPF não encontrado mostra "Cadastro em análise".
- [ ] Cadastro com CPF ou e-mail já existente mostra o erro 409 da API.

**Busca**
- [ ] A rede animada aparece com fotos e iniciais, reage ao mouse, deixa arrastar com limite e, ao clicar num perfil, rola até o card dele.
- [ ] Os filtros de órgão, tema, formação e favoritos vão para o endereço da página e se combinam.
- [ ] A rolagem infinita carrega a página seguinte.
- [ ] A troca entre cards e lista fica lembrada.
- [ ] Em telas estreitas, os filtros vão para o botão "Filtros", com a contagem de filtros ativos.
- [ ] No celular, os cards ficam em 2 colunas e as linhas na versão compacta.

**Perfil**
- [ ] Mostra a lotação completa, as formações, os temas (atuais e anteriores), os contatos visíveis e as pessoas próximas.
- [ ] No próprio perfil aparecem "Editar perfil" e "Excluir meu perfil"; a exclusão pede a senha.
- [ ] Favoritar no perfil reflete na busca, e o contrário também.

**Edição**
- [ ] As listas de órgão são encadeadas e "+ Adicionar" aceita nome e sigla novos.
- [ ] Apagar o celular ou o e-mail institucional e salvar remove o dado.
- [ ] As chaves "Mostrar e-mail pessoal" e "Mostrar celular" mudam o que os colegas veem.
- [ ] Temas e formações são salvos na hora, e o tema guarda "em exercício atual".
- [ ] A foto é enviada ao salvar, e "Remover foto" funciona.

**Administração**
- [ ] `/admin/usuarios` e `/admin/stats` abrem e funcionam com o novo layout.

---

## 8. Pontos em aberto

- **Siglas conflitantes em `/lotacoes`:** o mesmo nome pode ter sido cadastrado com siglas diferentes, e a sugestão acima usa `max(sigla)`. Se isso incomodar, a administração pode padronizar os nomes, ou o back-end pode adotar uma tabela oficial de órgãos.
- **Nome da instituição de ensino:** continua sendo texto livre. A interface mostra a sigla entre parênteses no card quando o texto é curto (até 12 caracteres), e o nome inteiro no perfil.
- **Aviso ao sair da edição com alterações não salvas:** hoje vale para o botão "Cancelar" e para fechar ou recarregar a aba.
  - Para avisar também em links internos, como a logo da barra, o `App.tsx` precisaria passar de `<BrowserRouter>` para `createBrowserRouter`, que permite usar `useBlocker`.
- **Tamanho do bundle:** o aviso de bloco acima de 500 kB já existia antes, por causa do `recharts` do painel de estatísticas. Dá para resolver carregando as páginas de administração sob demanda, com `React.lazy`.
