"""Documentos legais versionados da Rede ATPS.

Cada versão publicada fica registrada aqui para sempre (nunca editar o texto de uma
versão já publicada — publicar uma nova). O aceite do usuário é gravado na tabela
`consentimentos` com o tipo, a versão e o hash SHA-256 do texto, o que permite provar
exatamente qual conteúdo foi aceito (art. 8º, § 2º, LGPD).

Publicar uma nova versão de um documento obrigatório faz todos os usuários passarem
pelo reaceite no próximo acesso e dispara aviso por e-mail (tarefas.py).
"""
import hashlib
from dataclasses import dataclass

# Prazos citados nos textos abaixo e aplicados por tarefas.py. Mudar qualquer um
# deles exige publicar nova versão dos documentos.
REVERIFICACAO_INTERVALO_DIAS = 180
PRAZO_CONTESTACAO_DIAS = 30
RETENCAO_NOVIDADES_DIAS = 90
CONFERENCIA_PERFIL_DIAS = 30  # perfil sempre atualizado (tarefas.conferir_perfis)

CONTATO = "redeatps@gmail.com"

TERMO_CONSENTIMENTO = "termo_consentimento"
AUTORIZACAO_CONSULTA_CPF = "autorizacao_consulta_cpf"

# Documentos cujo aceite na versão atual é condição para usar a Rede.
OBRIGATORIOS = (TERMO_CONSENTIMENTO, AUTORIZACAO_CONSULTA_CPF)

# A partir desta versão da Autorização de consulta do CPF, o texto precisa cobrir também:
# preencher cargo/função comissionada e turma (pelo ano de ingresso no serviço público),
# sugerir ao titular atualizações do perfil quando o Portal mostrar mudança de exercício ou
# de função, e usar a cópia local dos dados abertos do Portal quando a API estiver fora.
# Enquanto essa versão não for publicada, esses recursos ficam desligados.
VERSAO_AUTORIZACAO_AMPLIADA = 3


@dataclass(frozen=True)
class Documento:
    tipo: str
    versao: int
    vigente_desde: str
    titulo: str
    texto: str

    @property
    def hash(self) -> str:
        return hashlib.sha256(self.texto.encode()).hexdigest()


_TERMO_V1 = f"""1. Quem mantém a Rede
A Rede ATPS é um diretório profissional dos(as) Analistas Técnicos(as) de Políticas Sociais (ATPS), ativos(as) e aposentados(as), mantido pela Associação Nacional da Carreira de Desenvolvimento de Políticas Sociais (ANDEPS). A participação é facultativa e não depende de filiação à ANDEPS. A Rede não verifica nem exibe a condição de associado(a): estar na Rede não indica filiação. Contato: {CONTATO}.

2. Dados tratados e para quê
— Nome, e-mail pessoal e senha: criar e proteger sua conta. O e-mail pessoal é usado para acesso e para as comunicações da Rede.
— CPF: confirmar seu vínculo com a carreira no Portal da Transparência, no cadastro e periodicamente (ver item 5 e a autorização específica). O CPF é guardado criptografado, junto com um código derivado dele (hash) que impede cadastros duplicados. Ele não é exibido a nenhum usuário, nem aos administradores, na plataforma.
— Dados de perfil, todos opcionais: órgão de exercício, cargo ou função, turma, formação acadêmica, temas de atuação, telefone e e-mail institucionais, celular, link de currículo em site .gov.br e foto.

3. Quem vê seus dados
— Outros(as) ATPS com conta ativa e logados(as) veem: nome, foto, órgão de exercício, cargo ou função, turma, formação, temas de atuação, telefone e e-mail institucionais e link de currículo, quando preenchidos.
— E-mail pessoal e celular só são exibidos a outros usuários se você ativar essa opção, e você pode desativá-la a qualquer momento.
— Nenhum dado de perfil é acessível sem login.
— Os administradores da Rede têm acesso a todos os dados de perfil, inclusive aos contatos não exibidos, exclusivamente para suporte, verificação de vínculo e moderação.
— Você pode ocultar seu perfil a qualquer momento, sem excluir a conta.

4. Bases legais (Lei nº 13.709/2018 — LGPD)
— Exibição do perfil e dos contatos opcionais, e consulta do CPF: seu consentimento (art. 7º, I), que pode ser revogado.
— Conta e autenticação: execução das regras de uso da Rede (art. 7º, V).
— Segurança, prevenção de fraudes e de cadastros duplicados: legítimo interesse (art. 7º, IX).

5. Verificação periódica do vínculo
A cada {REVERIFICACAO_INTERVALO_DIAS} dias, aproximadamente, seu CPF é consultado novamente no Portal da Transparência. Aposentados(as) da carreira mantêm o acesso. Se o vínculo não for confirmado, seu perfil é ocultado e você recebe um aviso por e-mail, com prazo de {PRAZO_CONTESTACAO_DIAS} dias para contestar. Sem confirmação nesse prazo, a conta é excluída.

6. Compartilhamento e fornecedores
Seus dados não são vendidos nem compartilhados para fins comerciais ou publicitários. Para operar a Rede, usamos serviços de terceiros que podem tratar dados fora do Brasil: Cloudflare (rede e proteção de acesso ao site), Google (envio de e-mails e fontes tipográficas do site) e Microsoft (cópias de segurança). O CPF é enviado ao Portal da Transparência (Controladoria-Geral da União) apenas para a consulta de vínculo.

7. Segurança
O acesso ao site é criptografado (HTTPS). A senha é guardada com algoritmo próprio para senhas (bcrypt) e o CPF, criptografado. O acesso ao servidor e ao banco de dados é restrito à equipe técnica da Rede.

8. Por quanto tempo
Os dados são mantidos enquanto a conta existir. Ao excluir a conta, os dados são apagados da plataforma imediatamente; as cópias de segurança são substituídas periodicamente e deixam de contê-los.

9. Seus direitos
Em "Meu Perfil" você pode, a qualquer momento: acessar e corrigir seus dados; ocultar seu perfil; ativar ou desativar a exibição do e-mail pessoal e do celular; consultar as autorizações que concedeu; e excluir sua conta. Como este termo e a autorização de consulta do CPF são necessários para participar da Rede, revogá-los significa excluir a conta. Outras solicitações podem ser feitas pelo contato do item 1.

10. Alterações
Se este termo mudar, você será avisado(a) por e-mail e precisará aceitar a nova versão no próximo acesso para continuar usando a Rede."""

_TERMO_V2 = f"""1. Quem mantém a Rede
A Rede ATPS é um diretório profissional dos(as) Analistas Técnicos(as) de Políticas Sociais (ATPS), ativos(as) e aposentados(as), mantido pela Associação Nacional da Carreira de Desenvolvimento de Políticas Sociais (ANDEPS). A participação é facultativa e não depende de filiação à ANDEPS. A Rede não verifica nem exibe a condição de associado(a): estar na Rede não indica filiação. Contato: {CONTATO}.

2. Dados tratados e para quê
— Nome, e-mail pessoal e senha: criar e proteger sua conta. O e-mail pessoal é usado para acesso e para as comunicações da Rede.
— CPF: confirmar seu vínculo com a carreira no Portal da Transparência, no cadastro e periodicamente (ver item 5 e a autorização específica). O CPF é guardado criptografado, junto com um código derivado dele (hash) que impede cadastros duplicados. Ele não é exibido a nenhum usuário, nem aos administradores, na plataforma.
— Dados de perfil, todos opcionais: órgão de exercício, cargo ou função, turma, formação acadêmica, temas de atuação, telefone e e-mail institucionais, celular, links de currículo (site .gov.br e Plataforma Lattes) e de perfil no LinkedIn, e foto.
— Favoritos: os perfis que você marca como favoritos, para encontrá-los mais rápido e ver as novidades deles (item 3).

3. Quem vê seus dados
— Outros(as) ATPS com conta ativa e logados(as) veem: nome, foto, órgão de exercício, cargo ou função, turma, formação, temas de atuação, telefone e e-mail institucionais e links de currículo e do LinkedIn, quando preenchidos.
— E-mail pessoal e celular só são exibidos a outros usuários se você ativar essa opção, e você pode desativá-la a qualquer momento.
— Nenhum dado de perfil é acessível sem login.
— Os administradores da Rede têm acesso a todos os dados de perfil, inclusive aos contatos não exibidos, exclusivamente para suporte, verificação de vínculo e moderação.
— Seus favoritos são visíveis só para você. Quem é favoritado(a) não é avisado(a) nem sabe quem o(a) favoritou.
— Quando alguém que favoritou você entra na Rede, vê como novidade as mudanças no seu perfil feitas depois do favorito: mudança de órgão de exercício, novo tema de atuação em exercício atual e nova formação. Outras alterações (foto, contatos, links) não geram novidade. Perfis ocultos não geram novidade.
— Você pode ocultar seu perfil a qualquer momento, sem excluir a conta.

4. Bases legais (Lei nº 13.709/2018 — LGPD)
— Exibição do perfil e dos contatos opcionais, e consulta do CPF: seu consentimento (art. 7º, I), que pode ser revogado.
— Conta e autenticação: execução das regras de uso da Rede (art. 7º, V).
— Segurança, prevenção de fraudes e de cadastros duplicados: legítimo interesse (art. 7º, IX).

5. Verificação periódica do vínculo
A cada {REVERIFICACAO_INTERVALO_DIAS} dias, aproximadamente, seu CPF é consultado novamente no Portal da Transparência. Aposentados(as) da carreira mantêm o acesso. Se o vínculo não for confirmado, seu perfil é ocultado e você recebe um aviso por e-mail, com prazo de {PRAZO_CONTESTACAO_DIAS} dias para contestar. Sem confirmação nesse prazo, a conta é excluída.

6. Compartilhamento e fornecedores
Seus dados não são vendidos nem compartilhados para fins comerciais ou publicitários. Para operar a Rede, usamos serviços de terceiros que podem tratar dados fora do Brasil: Cloudflare (rede e proteção de acesso ao site), Google (envio de e-mails) e Microsoft (cópias de segurança). O CPF é enviado ao Portal da Transparência (Controladoria-Geral da União) apenas para a consulta de vínculo.

7. Segurança
O acesso ao site é criptografado (HTTPS). A senha é guardada com algoritmo próprio para senhas (bcrypt) e o CPF, criptografado. O acesso ao servidor e ao banco de dados é restrito à equipe técnica da Rede.

8. Por quanto tempo
Os dados são mantidos enquanto a conta existir. O registro das novidades de perfil (item 3) é apagado após {RETENCAO_NOVIDADES_DIAS} dias. Ao excluir a conta, os dados são apagados da plataforma imediatamente; as cópias de segurança são substituídas periodicamente e deixam de contê-los.

9. Seus direitos
Em "Meu Perfil" você pode, a qualquer momento: acessar e corrigir seus dados; ocultar seu perfil; ativar ou desativar a exibição do e-mail pessoal e do celular; consultar as autorizações que concedeu; e excluir sua conta. Como este termo e a autorização de consulta do CPF são necessários para participar da Rede, revogá-los significa excluir a conta. Outras solicitações podem ser feitas pelo contato do item 1.

10. Alterações
Se este termo mudar, você será avisado(a) por e-mail e precisará aceitar a nova versão no próximo acesso para continuar usando a Rede."""

_TERMO_V3 = f"""1. Quem mantém a Rede
A Rede ATPS é um diretório profissional dos(as) Analistas Técnicos(as) de Políticas Sociais (ATPS), ativos(as) e aposentados(as), mantido pela Associação Nacional da Carreira de Desenvolvimento de Políticas Sociais (ANDEPS). A participação é facultativa e não depende de filiação à ANDEPS. A Rede não verifica nem exibe a condição de associado(a): estar na Rede não indica filiação. Contato: {CONTATO}.

2. Dados tratados e para quê
— Nome, e-mail pessoal e senha: criar e proteger sua conta. O e-mail pessoal é usado para acesso e para as comunicações da Rede.
— CPF: confirmar seu vínculo com a carreira no Portal da Transparência, no cadastro e periodicamente (ver item 5 e a autorização específica). O CPF é guardado criptografado, junto com um código derivado dele (hash) que impede cadastros duplicados. Ele não é exibido a nenhum usuário, nem aos administradores, na plataforma. Conforme a autorização específica, também serve para preencher campos em branco do perfil (lotação, cargo ou função comissionada e turma) e para sugerir atualizações, que só são feitas se você aceitar.
— Dados de perfil, todos opcionais: órgão de exercício, cargo ou função, turma, formação acadêmica, temas de atuação, "em que posso ajudar", telefone e e-mail institucionais, celular, links de currículo (site .gov.br e Plataforma Lattes) e de perfil no LinkedIn, e foto.
— Favoritos: os perfis que você marca como favoritos, para encontrá-los mais rápido e ver as novidades deles (item 3).
— Cópia dos dados abertos do Portal da Transparência: a Rede mantém uma cópia dos dados que o Portal publica sobre os ATPS ativos (nome, os seis dígitos do CPF que o Portal divulga, guardados de forma codificada, órgão e unidade de exercício, função comissionada e ano de ingresso no serviço público). Ela é usada para confirmar o vínculo e preencher o perfil quando o Portal estiver fora do ar, e para estatísticas agregadas de participação por órgão.

3. Quem vê seus dados
— Outros(as) ATPS com conta ativa e logados(as) veem: nome, foto, órgão de exercício, cargo ou função, turma, formação, temas de atuação, "em que posso ajudar", telefone e e-mail institucionais e links de currículo e do LinkedIn, quando preenchidos.
— E-mail pessoal e celular só são exibidos a outros usuários se você ativar essa opção, e você pode desativá-la a qualquer momento.
— Nenhum dado de perfil é acessível sem login.
— Seu perfil também aparece na página da unidade em que você está lotado(a) e, quando você entra na Rede, como novidade para colegas da mesma secretaria e da mesma turma.
— Os administradores da Rede têm acesso a todos os dados de perfil, inclusive aos contatos não exibidos, exclusivamente para suporte, verificação de vínculo e moderação, e a estatísticas agregadas de participação por órgão.
— Seus favoritos são visíveis só para você. Quem é favoritado(a) não é avisado(a) nem sabe quem o(a) favoritou.
— Quando alguém que favoritou você entra na Rede, vê como novidade as mudanças no seu perfil feitas depois do favorito: mudança de órgão de exercício, novo tema de atuação em exercício atual e nova formação. Outras alterações (foto, contatos, links) não geram novidade. Perfis ocultos não geram novidade.
— Você pode ocultar seu perfil a qualquer momento, sem excluir a conta.

4. Bases legais (Lei nº 13.709/2018 — LGPD)
— Exibição do perfil e dos contatos opcionais, e consulta do CPF: seu consentimento (art. 7º, I), que pode ser revogado.
— Conta e autenticação: execução das regras de uso da Rede (art. 7º, V).
— Segurança, prevenção de fraudes e de cadastros duplicados: legítimo interesse (art. 7º, IX).
— Cópia dos dados abertos do Portal da Transparência: legítimo interesse (art. 7º, IX), respeitando a finalidade e o interesse público que justificaram sua publicação (art. 7º, § 3º).

5. Verificação periódica do vínculo
A cada {REVERIFICACAO_INTERVALO_DIAS} dias, aproximadamente, seu CPF é consultado novamente no Portal da Transparência. Aposentados(as) da carreira mantêm o acesso. Se o vínculo não for confirmado, seu perfil é ocultado e você recebe um aviso por e-mail, com prazo de {PRAZO_CONTESTACAO_DIAS} dias para contestar. Sem confirmação nesse prazo, a conta é excluída.

6. Compartilhamento e fornecedores
Seus dados não são vendidos nem compartilhados para fins comerciais ou publicitários. Para operar a Rede, usamos serviços de terceiros que podem tratar dados fora do Brasil: Cloudflare (rede e proteção de acesso ao site), Google (envio de e-mails) e Microsoft (cópias de segurança). O CPF é enviado ao Portal da Transparência (Controladoria-Geral da União) apenas para as consultas descritas na autorização específica. A estrutura organizacional é obtida do SIORG, sem envio de dados pessoais.

7. Segurança
O acesso ao site é criptografado (HTTPS). A senha é guardada com algoritmo próprio para senhas (bcrypt) e o CPF, criptografado. O acesso ao servidor e ao banco de dados é restrito à equipe técnica da Rede.

8. Por quanto tempo
Os dados são mantidos enquanto a conta existir. O registro das novidades de perfil (item 3) é apagado após {RETENCAO_NOVIDADES_DIAS} dias. A cópia dos dados abertos do Portal é substituída a cada nova publicação mensal. Ao excluir a conta, os dados são apagados da plataforma imediatamente; as cópias de segurança são substituídas periodicamente e deixam de contê-los.

9. Seus direitos
Em "Meu Perfil" você pode, a qualquer momento: acessar e corrigir seus dados; ocultar seu perfil; ativar ou desativar a exibição do e-mail pessoal e do celular; consultar as autorizações que concedeu; e excluir sua conta. Como este termo e a autorização de consulta do CPF são necessários para participar da Rede, revogá-los significa excluir a conta. Outras solicitações podem ser feitas pelo contato do item 1.

10. Alterações
Se este termo mudar, você verá a nova versão no próximo acesso e precisará aceitá-la para continuar usando a Rede."""

_CONSULTA_CPF_V1 = f"""Autorizo a consulta do meu CPF à base de servidores do Portal da Transparência do Governo Federal, no cadastro e periodicamente (a cada {REVERIFICACAO_INTERVALO_DIAS} dias, aproximadamente) enquanto eu mantiver conta na Rede ATPS, exclusivamente para confirmar meu vínculo como Analista Técnico(a) de Políticas Sociais, ativo(a) ou aposentado(a).

Estou ciente de que: meu CPF será guardado criptografado para essa finalidade e não será exibido a nenhum usuário; o nome que informei será comparado com o registrado no Portal; e, se o vínculo deixar de ser confirmado, meu perfil será ocultado e, após {PRAZO_CONTESTACAO_DIAS} dias sem contestação, minha conta será excluída."""

_CONSULTA_CPF_V2 = f"""Autorizo a consulta do meu CPF à base de servidores do Portal da Transparência do Governo Federal, no cadastro e periodicamente (a cada {REVERIFICACAO_INTERVALO_DIAS} dias, aproximadamente) enquanto eu mantiver conta na Rede ATPS, para:
a) confirmar meu vínculo como Analista Técnico(a) de Políticas Sociais, ativo(a) ou aposentado(a); e
b) quando a lotação do meu perfil estiver em branco, preenchê-la com o órgão e a unidade de exercício registrados no Portal, conferidos com a estrutura organizacional oficial do Governo Federal (SIORG).

Estou ciente de que: meu CPF será guardado criptografado para essas finalidades e não será exibido a nenhum usuário; o nome que informei será comparado com o registrado no Portal; nenhum outro dado do Portal é guardado; a lotação preenchida fica no meu perfil, visível como as demais informações de lotação, e posso alterá-la ou apagá-la a qualquer momento; e, se o vínculo deixar de ser confirmado, meu perfil será ocultado e, após {PRAZO_CONTESTACAO_DIAS} dias sem contestação, minha conta será excluída."""

_CONSULTA_CPF_V3 = f"""Autorizo a consulta do meu CPF à base de servidores do Portal da Transparência do Governo Federal (pela API do Portal ou, quando ela estiver indisponível, pela cópia dos dados abertos do Portal mantida pela Rede), no cadastro, a cada {REVERIFICACAO_INTERVALO_DIAS} dias para confirmar o vínculo e a cada {CONFERENCIA_PERFIL_DIAS} dias para manter o perfil atualizado, enquanto eu mantiver conta na Rede ATPS, para:
a) confirmar meu vínculo como Analista Técnico(a) de Políticas Sociais, ativo(a) ou aposentado(a);
b) preencher os campos em branco do meu perfil (lotação, cargo ou função comissionada e turma, esta estimada pelo ano de ingresso no serviço público) com os dados registrados no Portal, conferidos com a estrutura organizacional oficial do Governo Federal (SIORG); e
c) quando o Portal mostrar mudança no meu órgão, na minha unidade de exercício ou na minha função comissionada, me sugerir a atualização do perfil, que só é feita se eu aceitar.

Estou ciente de que: meu CPF será guardado criptografado para essas finalidades e não será exibido a nenhum usuário; o nome que informei será comparado com o registrado no Portal; além do que for preenchido no meu perfil e de uma sugestão pendente, nenhum outro dado do Portal sobre mim é guardado na minha conta; o que for preenchido fica visível como as demais informações do perfil, e posso alterar ou apagar a qualquer momento; e, se o vínculo deixar de ser confirmado, meu perfil será ocultado e, após {PRAZO_CONTESTACAO_DIAS} dias sem contestação, minha conta será excluída."""

DOCUMENTOS: dict[str, list[Documento]] = {
    TERMO_CONSENTIMENTO: [
        Documento(
            TERMO_CONSENTIMENTO, 1, "2026-11-04",
            "Termo de Consentimento — Tratamento de Dados Pessoais", _TERMO_V1,
        ),
        Documento(
            TERMO_CONSENTIMENTO, 2, "2026-11-18",
            "Termo de Consentimento — Tratamento de Dados Pessoais", _TERMO_V2,
        ),
        Documento(
            TERMO_CONSENTIMENTO, 3, "2026-11-18",
            "Termo de Consentimento — Tratamento de Dados Pessoais", _TERMO_V3,
        ),
    ],
    AUTORIZACAO_CONSULTA_CPF: [
        Documento(
            AUTORIZACAO_CONSULTA_CPF, 1, "2026-11-04",
            "Autorização de consulta do CPF ao Portal da Transparência", _CONSULTA_CPF_V1,
        ),
        Documento(
            AUTORIZACAO_CONSULTA_CPF, 2, "2026-11-18",
            "Autorização de consulta do CPF ao Portal da Transparência", _CONSULTA_CPF_V2,
        ),
        Documento(
            AUTORIZACAO_CONSULTA_CPF, 3, "2026-11-18",
            "Autorização de consulta do CPF ao Portal da Transparência", _CONSULTA_CPF_V3,
        ),
    ],
}


def documento_atual(tipo: str) -> Documento:
    return DOCUMENTOS[tipo][-1]


def documento(tipo: str, versao: int) -> Documento | None:
    return next((d for d in DOCUMENTOS.get(tipo, []) if d.versao == versao), None)
