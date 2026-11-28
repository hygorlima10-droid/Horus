# Auditoria de viabilidade: site novo primeiro, depois CRM/WhatsApp no Horus (20/11/2026)

Só análise. Nada foi alterado no site, no Horus nem nos dados. Medições feitas hoje (20/11/2026) a partir de um servidor na nuvem (não do Brasil): servem de **indicação**, não de laudo; vale repetir no PageSpeed Insights do Google, com o celular do escritório. Dados de mercado e de custo vêm de fontes secundárias (blogs, jornais, diretórios) e estão marcados como **hipótese** quando não verificados.

## 1. Resposta curta
1. **O site atual não é "arcaico" no visual** (preto e dourado, identidade forte, equipe e áreas visíveis). Os problemas são **técnicos e de conteúdo**: pesado e lento, fino de conteúdo (4 páginas), sem página própria para o que o escritório quer vender (agro, agrário, cível de maior valor), erros de texto e de contato, e textos que podem esbarrar na publicidade da OAB.
2. **Vale a pena investir, com tamanho pequeno e meta clara.** Para o objetivo (ser referência regional em agro/agrário/cível), o retorno vem menos de anúncio (mercado pequeno, ~51 mil habitantes) e mais de **autoridade: conteúdo técnico, página por especialidade, presença local e rapidez no primeiro contato**. A conta de equilíbrio é baixa (seção 6), o risco está em volume e qualidade de lead, não em custo.
3. **Ordem recomendada:** (a) consertar o essencial agora (correções de contato/texto e velocidade, 2–3 semanas); (b) site novo/estrutura nova de páginas com formulário ligado ao Horus; (c) só então leads, WhatsApp oficial e, por último, tráfego pago. Decidir "refazer do zero" depois de responder três perguntas (seção 7).

## 2. Diagnóstico do site atual (faloneadvogados.com.br)
**Tecnologia:** WordPress + tema OceanWP + Elementor, plugin de WhatsApp (Joinchat) e Google Site Kit (Analytics/Tag Manager). Hospedagem Apache; rodapé: "Desenvolvido por Aprimora Web". HTTPS ativo, HTML com idioma pt-BR e viewport de celular (responsivo).
**Estrutura:** 4 páginas (O Escritório, Áreas de Atuação, Notícias e Artigos, Fale Conosco) + Início; 5 notícias/artigos, todos de Dr. Murilo (3 em 2024, 1 em jul/2024 e 1 em 12/05/2026). Áreas: 13 itens numa lista **sem página própria**; a equipe tem 5 cartões curtos, sem biografia.

| Item | Achado | Gravidade |
|---|---|---|
| Velocidade | Celular: ~4,8 MB em 74 requisições, **LCP ≈ 8,5 s** e carga completa ≈ 10 s; desktop ≈ 5,8 MB, LCP ≈ 6,7 s. 13 imagens muito maiores que o necessário, 7 sem texto alternativo. (Medido da nuvem; no Brasil pode ser melhor, mas o peso é o mesmo.) | **Alta** (o Google considera bom LCP ≤ 2,5 s; visitante de celular desiste) |
| Contato | Telefone e WhatsApp **trocados/ambíguos**: cabeçalho mostra (64) 3513-1414; o rodapé diz "Telefone: (64) 99627-8080 · WhatsApp: (64) 3513-1414". O botão de WhatsApp usa 55 64 3513-1414 (formato de fixo). **Confirmar qual número realmente recebe WhatsApp.** | **Alta** |
| Cliques de contato | **Nenhum link de ligar (tel:) nem de e-mail (mailto:)**; e-mail é Gmail (faloneadv00@gmail.com), sem e-mail do domínio. No celular não dá para tocar e ligar. | Alta |
| Formulário | Existe (Fale Conosco), sem aviso de privacidade/LGPD nem aviso de "não cria relação advogado-cliente"; onde cai a mensagem não está visível. | Média |
| Conteúdo/SEO | Páginas curtas (~1–3 mil caracteres); **sem página por área** (agro, agrário, bancário, RJ…); sem texto de "como atuamos" por tema; título/descrição bons na página inicial, mas "O Escritório" usa uma URL de vídeo como descrição e "Notícias" não tem descrição; sem imagem de compartilhamento; dados estruturados com nome **"SITE PADRÃO"** (resto de modelo). | Alta para o objetivo regional |
| Erros de texto | "Dra. Hitallo Renato" (Dr.), "Dra. Nathany" (Nathanny), "Protação a cooperative", "dde", "Desenvolvido…" ; CEP "75.650-0701"; "A Falone Advogados e um escritório" (sem acento). | Média (credibilidade) |
| Publicidade OAB (conferir com a Comissão) | Frases como "gerar **resultados reais**", "foco em **resultado**", "soluções eficazes", "**Excelência** em defesa criminal", "**Especialização rara** no interior", "**Especialista** em proteção patrimonial" e títulos que celebram decisões ganhas podem ser lidos como autoelogio/promessa de resultado ou uso indevido de "especialista" (que exige título). Não consegui ler o texto oficial do Provimento 205/2021 nesta sessão; **a conferência é necessária**. | Alta (risco disciplinar) |
| Autoridade/local | Sem Google Meu Negócio visível no site, sem mapa, sem fotos da estrutura física (principal diferencial citado), sem vídeo; redes: Facebook e Instagram só do Dr. Murilo. | Média |
| Medição | Google Site Kit/GTM instalado, mas **sem registro de conversões** (clique em WhatsApp, formulário, ligação) — não dá para saber quanto o site rende. | Alta |

Pontos fortes: identidade visual coerente, equipe com especialidades claras (rural/agro/cooperativismo é o que o escritório quer vender), botão de WhatsApp sempre visível, HTTPS, sitemap e robots corretos, artigos técnicos relevantes para agro (RJ de cooperativas no STJ; consolidação de imóvel rural).

## 3. Mercado (indicadores, não promessa)
- **Morrinhos:** 51.351 habitantes (Censo 2022); integra a região de Itumbiara/Caldas Novas. Na região intermediária de Itumbiara a agropecuária passou de 16,1% para 26,5% do valor adicionado entre 2010 e 2021 (IMB-GO).
- **Demanda agro:** Goiás foi o 2º estado em recuperações judiciais do agro em 2025 (296 pedidos, ~15% do país, Serasa); houve 84 pedidos entre abr–jun/2026; a inadimplência do crédito rural em Goiás chegou a ~6,5% no fim de 2025 (Faeg); o CNJ editou o Provimento 216/2026 sobre RJ no agro. As fontes divergem sobre a tendência de 2026 — mas o tema é **grande, técnico e recorrente**, onde advogado com autoridade se diferencia.
- **Concorrência local (diretórios, não ranking do Google):** em Morrinhos apareceram escritórios generalistas (família, trabalhista, previdenciário); **nenhum especializado em agro/agrário**. Os especialistas em agro vistos estão em Rio Verde e Goiânia. Hipótese: há espaço para ser a referência regional em agro — **a confirmar com a busca real no Google** (não consegui ver os resultados).

## 4. O que o Horus já sabe sobre o escritório (dados reais, só leitura)
- 106 clientes, 230 processos, 29 Iniciais (desde 16/09/2026), 6 acordos.
- **Honorários fixos em Iniciais:** 10 casos somam R$ 107.100 (**média ≈ R$ 10,7 mil**): casos de origem do Dr. Murilo ≈ R$ 18,3 mil; casos próprios ≈ R$ 3,1 mil. Há 11 Iniciais "só êxito"/"fixo+êxito"/"desfecho" sem valor registrado — o retorno real é maior que o fixo.
- Receita concentrada em poucos clientes (um cliente concentra ≈ R$ 75 mil dos fixos). Clientes recorrentes (cooperativas) geram volume de processos (uma cooperativa tem 36 processos).
- Limite: o Horus tem pouco histórico; **ainda não registra a origem do cliente**, então hoje não dá para dizer quantos vieram de indicação, site ou outro canal.

## 5. Opções para o site
| | A. Consertar e reorganizar o WordPress atual | B. Site novo (WordPress otimizado ou estático em Cloudflare) |
|---|---|---|
| O que muda | Imagens leves, cache, plugins enxutos; corrigir contato/textos/OAB; criar páginas por área (agro, agrário, cível, bancário/RJ), bios da equipe, FAQ, formulário com aviso LGPD; metas de conversão | Estrutura e design novos, páginas por especialidade desde o início, velocidade máxima, formulário direto no Horus |
| Custo | Horas de quem mantém o WordPress (agência ou nós); sem troca de hospedagem | Criação (estimativa genérica de mercado: R$ 10–25 mil por profissional; **não específica para advocacia**) ou horas nossas; hospedagem estática praticamente gratuita; domínio ~R$ 40–90/ano |
| Prazo | 2–3 semanas | 6–10 semanas (conteúdo é o gargalo) |
| Risco | Continua preso ao tema/plugins; velocidade só melhora até certo ponto | Precisa decidir **quem edita o conteúdo**; sem painel, edição depende de nós ou de um mini-painel no Horus |
**Recomendação:** começar por **A (parte crítica) já**, porque corrige perda imediata (contato quebrado, risco OAB, lentidão) com baixo custo, e planejar **B com conteúdo agro/cível** em seguida; decidir B depois de resolver as perguntas da seção 7.

## 6. Conta de equilíbrio (hipóteses explícitas)
Premissas: ticket médio de honorários por cliente novo entre **R$ 3,1 mil e R$ 10,7 mil** (dados do Horus); investimento mensal de operação **R$ 2.000** (R$ 1.500 de anúncios de busca + R$ 500 de ferramentas/WhatsApp), mais horas de conteúdo.
- Clientes novos por mês para pagar o programa: R$ 2.000 ÷ R$ 3.100 ≈ **0,65**; ÷ R$ 10.700 ≈ **0,19** (ou seja, **um cliente a cada 5 meses** no ticket médio dos casos de maior valor).
- Custo por cliente conquistado (referências de mercado, sem metodologia): lead R$ 40–70 (família) e custo por cliente R$ 600–1.200 (cível) — **hipótese**; em nichos competitivos o clique ficou até ~60% mais caro. Para agro/agrário não achei números.
- Gargalos reais: **volume de buscas pequeno** no interior (poucas buscas "advogado agrário Morrinhos"), **qualidade** do lead (formulário vira custo), e **capacidade de atendimento** (hoje o WhatsApp é atendido por estagiária e pode ficar dias sem resposta). Sem resposta rápida, o dinheiro de anúncio se perde — por isso a ordem é consertar o atendimento antes de pagar tráfego.
- Resultado esperado: o programa se paga com **poucos** contratos de maior valor; o risco financeiro é pequeno se o investimento começar baixo e for medido por **contrato assinado**, não por clique.

## 7. Perguntas que decidem A × B
1. **Quem é dono do domínio, da hospedagem e do acesso ao WordPress?** (a agência Aprimora Web ou o escritório?) Trocar de fornecedor depende disso.
2. **Quem vai escrever e publicar conteúdo** (artigos técnicos de agro/cível) e com que frequência? Sem isso, nenhum site vira referência.
3. **Qual número recebe o WhatsApp e quem responde?** Definir um responsável e um prazo (ex.: 15 min no horário comercial).
4. Qual orçamento de partida e qual prazo de teste (sugestão: 90 dias)?
5. Posso consultar a Comissão de Publicidade da OAB-GO sobre os textos atuais e sobre avaliações/depoimentos?

## 8. Plano proposto (sem executar)
**Fase 1A (2–3 semanas, baixo custo):** confirmar números (telefone/WhatsApp), links de ligar e e-mail no domínio, corrigir erros de texto e dados estruturados, revisar frases com a OAB, comprimir imagens e ativar cache, formulário com aviso LGPD e de "não cria relação advogado-cliente", registrar conversões (WhatsApp, formulário, ligação), cadastrar/atualizar o Google Meu Negócio com fotos da estrutura (sóbrias).
**Fase 1B (6–10 semanas):** páginas por especialidade (agro, agrário, cooperativismo, cível/bancário, RJ) com conteúdo útil e sóbrio, bios, FAQ e 1 artigo técnico por mês; decidir A × B.
**Fase 2 (depois):** leads no Horus (origem, funil, retorno automático), formulário do site gravando direto no Horus, resposta rápida; **só depois** WhatsApp oficial e tráfego pago, medidos por contrato.
**Metas do piloto de 90 dias:** velocidade (LCP ≤ 2,5 s no celular), 100% das mensagens respondidas em até 1 dia útil (meta interna: 15 min no horário comercial), ≥ N contatos/mês pelo site (definir N após 30 dias de medição), 1 contrato novo atribuído ao site/Google.

## Fontes
Medições e leitura do site: faloneadvogados.com.br (HTML, robots, sitemap, renderização em celular e desktop, 20/11/2026). Mercado: IBGE/Censo 2022 (via agregadores), IMB-GO, Serasa (via Jornal Opção, O Hoje, Compre Rural), CNJ (Provimento 216/2026, via imprensa). Custos: Projuris, Wix. Diretórios jurídicos: Jusbrasil, Jurídico Certo, Ambito Jurídico. Regras: Provimento 205/2021 (fontes secundárias; o texto oficial não pôde ser aberto).
