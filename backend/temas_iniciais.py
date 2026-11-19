"""Lista inicial de temas da Rede, em dois tipos:

- "area": Áreas de política (o campo de política pública em que a pessoa atua);
- "ferramenta": Ferramentas e métodos (instrumentos, sistemas e técnicas que a pessoa domina).

Cada item: (nome oficial, tipo, apelidos). Apelidos são siglas, grafias alternativas e erros de
digitação comuns: quem digita um apelido cai no tema oficial, e a busca também os reconhece.
Use apelidos só para o MESMO tema (sinônimo ou sigla); temas parecidos mas diferentes ficam
separados e são resolvidos na curadoria (Painel admin > Temas).

Versão para validação da ANDEPS (novembro de 2026). Depois de carregada, a lista é mantida pela
tela de curadoria; editar este arquivo não muda temas que já estão no banco.
"""

AREA = "area"
FERRAMENTA = "ferramenta"

TEMAS_INICIAIS: list[tuple[str, str, list[str]]] = [
    # --- Áreas de política ---------------------------------------------------------------
    ("Assistência social", AREA, ["SUAS", "Sistema Único de Assistência Social"]),
    ("Transferência de renda", AREA, ["Bolsa Família", "PBF", "BPC", "Benefício de Prestação Continuada"]),
    ("Proteção social", AREA, []),
    ("Segurança alimentar e nutricional", AREA, ["SAN", "Combate à fome", "Segurança alimentar"]),
    ("Saúde", AREA, ["SUS", "Saúde pública"]),
    ("Assistência farmacêutica", AREA, []),
    ("Regulação e registro de medicamentos", AREA, []),
    ("Precificação de medicamentos", AREA, ["CMED"]),
    ("Boas práticas de fabricação de medicamentos", AREA, ["BPF"]),
    ("Avaliação de tecnologias em saúde", AREA, ["ATS", "HTA", "Avaliação de tecnologias em saúde (HTA)"]),
    ("Complexo econômico-industrial da saúde", AREA, [
        "CEIS", "Complexo Econômico Industrial da Saúde (CEIS)", "Complexo Econômico Indutrial da Saúde (CEIS)",
        "Complexo econômico-industrial da saúde (CEIS)",
    ]),
    ("Saúde mental", AREA, []),
    ("Educação", AREA, []),
    ("Educação profissional e tecnológica", AREA, ["EPT"]),
    ("Trabalho, emprego e renda", AREA, ["Trabalho e emprego"]),
    ("Economia solidária", AREA, []),
    ("Previdência social", AREA, ["Previdência"]),
    ("Cultura", AREA, []),
    ("Esporte e lazer", AREA, ["Esporte"]),
    ("Políticas para mulheres", AREA, []),
    ("Equidade de gênero", AREA, ["Igualdade de gênero"]),
    ("Enfrentamento à violência contra as mulheres", AREA, ["Violência contra a mulher"]),
    ("Política de cuidados", AREA, ["Cuidados", "Política Nacional de Cuidados"]),
    ("Promoção da igualdade racial", AREA, ["Igualdade racial"]),
    ("Direitos humanos", AREA, []),
    ("Povos indígenas", AREA, []),
    ("Povos e comunidades tradicionais", AREA, ["PCTs", "Comunidades tradicionais", "Quilombolas"]),
    ("Pessoa com deficiência", AREA, ["PcD", "Pessoas com deficiência"]),
    ("Pessoa idosa", AREA, ["Envelhecimento"]),
    ("Crianças e adolescentes", AREA, ["Infância", "Primeira infância"]),
    ("Juventude", AREA, []),
    ("População em situação de rua", AREA, ["PopRua"]),
    ("Migração e refúgio", AREA, ["Migrantes", "Refugiados"]),
    ("Política sobre drogas", AREA, ["Drogas"]),
    ("Habitação e desenvolvimento urbano", AREA, ["Habitação", "Cidades", "Desenvolvimento urbano"]),
    ("Desenvolvimento regional e territorial", AREA, ["Desenvolvimento regional"]),
    ("Desenvolvimento rural", AREA, ["Agricultura familiar"]),
    ("Desenvolvimento econômico", AREA, []),
    ("Meio ambiente", AREA, []),
    ("Mudança do clima", AREA, ["Mudanças climáticas", "Clima"]),
    ("Bioeconomia", AREA, []),
    ("Ciência, tecnologia e inovação", AREA, ["CT&I", "Ciência e tecnologia"]),

    # --- Ferramentas e métodos -----------------------------------------------------------
    ("Monitoramento e avaliação", FERRAMENTA, ["M&A", "Monitoramento & avaliação"]),
    ("Monitoramento de políticas públicas", FERRAMENTA, ["Monitoramento"]),
    ("Avaliação de políticas públicas", FERRAMENTA, ["Avaliação de políticas", "Avaliação de polítcas"]),
    ("Avaliação de impacto", FERRAMENTA, []),
    ("Indicadores", FERRAMENTA, ["Construção de indicadores"]),
    ("Políticas informadas por evidências", FERRAMENTA, ["PIE", "Evidências"]),
    ("Síntese de evidências", FERRAMENTA, []),
    ("Revisão sistemática com metanálise", FERRAMENTA, ["Revisão sistemática", "Metanálise"]),
    ("Tradução do conhecimento", FERRAMENTA, []),
    ("Comunicação de evidências", FERRAMENTA, []),
    ("Pesquisa qualitativa", FERRAMENTA, ["Entrevistas", "Grupos focais"]),
    ("Pesquisa quantitativa e estatística", FERRAMENTA, ["Estatística"]),
    ("Análise de dados", FERRAMENTA, ["Ciência de dados", "Python", "Power BI"]),
    ("Dados em políticas sociais", FERRAMENTA, []),
    ("Gestão da informação", FERRAMENTA, []),
    ("Cadastro Único", FERRAMENTA, ["CadÚnico", "Cadúnico", "CadUnico"]),
    ("Desenho de políticas públicas", FERRAMENTA, ["Formulação de políticas"]),
    ("Planejamento estratégico", FERRAMENTA, ["Planejamento"]),
    ("Gestão de projetos", FERRAMENTA, []),
    ("Gestão de processos", FERRAMENTA, ["Mapeamento de processos"]),
    ("Orçamento público", FERRAMENTA, ["Orçamento", "LOA", "Finanças públicas"]),
    ("Plano Plurianual", FERRAMENTA, ["PPA"]),
    ("Compras públicas", FERRAMENTA, ["Licitações", "Contratos", "Lei 14.133"]),
    ("Convênios", FERRAMENTA, []),
    ("TransfereGov", FERRAMENTA, ["Transferegov.br", "Plataforma +Brasil", "Plataforma Mais Brasil"]),
    ("Termo de execução descentralizada", FERRAMENTA, ["TED", "TEDs", "TED's"]),
    ("Termos de fomento e de colaboração", FERRAMENTA, ["Termos de fomento", "Termo de fomento", "Termo de colaboração"]),
    ("Marco regulatório das organizações da sociedade civil", FERRAMENTA, ["MROSC"]),
    ("Emendas parlamentares", FERRAMENTA, ["Emendas"]),
    ("Articulação federativa", FERRAMENTA, ["Articulação interfederativa", "Pacto federativo"]),
    ("Articulação política", FERRAMENTA, ["Relações institucionais"]),
    ("Participação social", FERRAMENTA, ["Conselhos", "Conferências"]),
    ("Atendimento a órgãos de controle", FERRAMENTA, ["Controle", "CGU", "TCU", "Auditoria"]),
    ("Elaboração de atos normativos", FERRAMENTA, ["Atos normativos", "Legística"]),
    ("Comunicação institucional", FERRAMENTA, ["Comunicação"]),
    ("Redes sociais", FERRAMENTA, []),
    ("Inovação em governo", FERRAMENTA, ["Design de serviços", "Laboratório de inovação"]),
    ("Gestão de pessoas", FERRAMENTA, []),
    ("Fomento à pesquisa", FERRAMENTA, ["Fomento à pesquisa em governo"]),
    ("Transferência de tecnologia", FERRAMENTA, []),
]

# Temas que já estavam nos perfis antes do catálogo e não são nome nem apelido da lista acima:
# entram como "a revisar", com o tipo abaixo (o resto fica como área de política).
TIPO_DOS_EXISTENTES: dict[str, str] = {
    "comunicacao sindical": FERRAMENTA,
    "redes colaborativas de evidencias": FERRAMENTA,
    "servico de producao de evidencias para apoio a tomada de decisao": FERRAMENTA,
    "sintese de evidencias para politicas": FERRAMENTA,
}
