---
name: site-advogados
description: Cria e revisa o site institucional do escritório Falone Advogados e de sites de advocacia em geral (design, estrutura de páginas, textos, artigos, galeria de fotos), respeitando o Provimento 205/2021 da OAB. Use sempre que o pedido for criar, redesenhar, escrever texto ou publicar página, artigo ou protótipo de site de escritório de advocacia.
---

# Skill: site de escritório de advocacia (Falone Advogados)

## 1. Contexto fixo (não perguntar de novo)
- Escritório em Goiás; clientes vêm de indicação e de relacionamento com cooperativas. Áreas a destacar: **agronegócio, direito agrário e cível**. Estrutura física grande e advogados que atuam em várias áreas.
- O site novo **substitui** o de faloneadvogados.com.br (WordPress da agência). Quando pronto: domínio novo próprio, hospedagem em Cloudflare (arquivos estáticos). Nesta fase **não** há WhatsApp integrado, CRM nem formulário que grave dados: só contato por telefone, e-mail, endereço e link comum de WhatsApp.
- Quem escreve e revisa artigos: **somente advogados**. Todo artigo sai assinado por advogado com nome e número da OAB.
- Quem aprova é o proprietário (advogado, leigo em design). Explicar em português simples, sem jargão técnico.

## 2. Como trabalhar (nesta ordem)
1. **Esboço antes de código**: mostrar o desenho (imagem ou protótipo privado em Artifact) e esperar "OK" explícito. Nada é publicado em domínio sem OK.
2. Protótipo = Artifact privado (uma página HTML). Site final = pasta de arquivos estáticos (`site/index.html`, `areas/`, `equipe/`, `artigos/`, `assets/`), pronta para Cloudflare.
3. Entregar por etapas pequenas (início → áreas → equipe → artigos → contato), cada uma com captura de tela em 390 px (celular) e 1280 px (computador).
4. Informação que falta (nomes, OAB, endereço, fotos, textos de áreas): **perguntar; nunca inventar** nem usar texto de enchimento ("lorem ipsum") ou foto de banco de imagens.

## 3. Regras da OAB (Provimento 205/2021) — bloqueantes
**Nunca escrever nem mostrar:**
- resultados, decisões ganhas, valores obtidos, casos concretos, nomes ou logos de clientes (inclui cooperativas atendidas);
- honorários, preços, gratuidade ("primeira consulta grátis"), descontos, parcelamento;
- autoelogio e comparação: "referência", "líder", "o melhor", "excelência garantida", "maior", "tradição de X anos" como argumento de venda, "temos a maior estrutura";
- "especialista"/"especializado" (só com título certificado); usar **"atuação em"** / **"áreas de atuação"**;
- promessa de resultado, apelo ao litígio ("processe", "receba seus direitos"), urgência artificial;
- símbolo ou logomarca da OAB; prêmio/ranking pago; ostentação (carros, viagens);
- depoimentos e avaliações de clientes; chatbot que responda dúvida jurídica a quem não é cliente.
**Pode:** áreas de atuação descritas com sobriedade; equipe (foto, nome, nº OAB, formação, títulos verdadeiros e comprováveis); fotos reais do escritório e da equipe; **galeria de fotos da estrutura sem legendas que falem de tamanho, números ou qualidade** (ex.: "Recepção", "Sala de reuniões", nunca "o maior escritório da região"); artigos técnicos e informativos; endereço, telefones, e-mail e link de WhatsApp.
**Tom:** informativo, sóbrio, discreto. Frases curtas, voz do escritório ("atuamos em…"), sem adjetivos de superioridade.
**Antes de entregar, conferir** com busca de palavras: gratuit, grátis, desconto, honorár, melhor, líder, referência, maior, especialista, garant, resultado, vitória, ganhamos, cliente(s) citados, % e R$.

## 4. Referências de design (pesquisa de 20/11/2026)
Vistas por captura de tela: **Demarest, Lefosse, BMA, Felsberg**. Não abriram: Pitta & Baione, Machado Meyer, Mattos Filho. Padrões úteis:
- **Demarest** — cabeçalho azul-marinho escuro com logotipo espaçado, cor de destaque quente (cobre/dourado); menu de 4 itens (Sobre, Áreas, Profissionais, Insights) + telefone + busca; o **conteúdo/artigo é o destaque da primeira tela**; tipografia sem serifa grossa e grande.
- **Lefosse** — tipografia enorme e geométrica como imagem principal; **um único botão de destaque** ("Encontre um advogado"); busca de advogados por nome/cargo/área.
- **BMA** — fundo off-white quente, **uma cor de acento** (vermelho); rótulo pequeno em caixa alta acima de cada título; cartões brancos em grade com seta; lista de artigos com data e categoria; botão de acessibilidade no menu; **aviso fixo contra golpe** ("não solicitamos pagamento por WhatsApp"); rodapé com endereço de cada unidade.
- **Felsberg** — verde-petróleo e dourado suaves, fonte humanista; **foto real da recepção do escritório**; faixa escura com 3 notícias; mesmo aviso contra golpe. (Não copiar a faixa de ranking/prêmio: o provimento restringe.)
- **Boas práticas de guias 2026 (blogs de agências, tratar como orientação)**: dizer em segundos o que o escritório faz, onde e como falar; uma página por área, escrita a partir da dúvida do cliente; foto real e equipe como pessoas; conteúdo como prova de autoridade; FAQ; celular primeiro; carregar rápido; política de privacidade (LGPD); evitar pop-ups e sliders automáticos.
- **Escritório de Brasil Salomão e Matthes (2026)** encomendou fotografia própria no escritório com a equipe: foto real vale mais que qualquer ilustração.

## 5. Direção visual para o Falone
- **Sensação:** sério, regional, de campo e de confiança — não "balança e martelo". Elegante e limpo, muito espaço em branco.
- **Cores (propostas, validar com esboço):** fundo off-white quente; texto grafite; **uma cor principal** profunda (verde-musgo ou azul-marinho) e **um acento** dourado/bronze usado só em botão e detalhes. Contraste mínimo AA (4,5:1).
- **Tipografia:** títulos em serifa editorial (ex.: Playfair Display, Cormorant ou Source Serif), texto em sem serifa legível (Inter, Source Sans). Texto mínimo 16 px no celular; títulos grandes.
- **Imagens:** fotos reais (equipe, recepção, salas, fachada, paisagem local sem identificar clientes); tratamento uniforme (mesma luz/tom); nada de banco de imagens genérico.
- **Componentes:** cabeçalho simples (Início, Áreas de atuação, Equipe, Artigos, Contato + telefone), um botão principal por tela, cartões de área, cartões de equipe, lista de artigos com data/área/autor, galeria em grade com ampliação, rodapé com endereço, telefones e OAB.
- **Evitar:** slider automático, pop-up, animação pesada, emoji, ícone de balança, texto sobre foto sem contraste, rolagem lateral.

## 6. Estrutura de páginas
1. **Início**: frase curta do que o escritório faz e onde; 3 áreas principais; últimos artigos; equipe em destaque; endereço e contato.
2. **O escritório**: apresentação sóbria, valores sem adjetivo, **galeria de fotos**.
3. **Áreas de atuação** (uma página cada: agronegócio/agrário, cível, demais): para quem serve, que situações cobre, como é o atendimento — sem prometer resultado.
4. **Equipe**: foto, nome, OAB, formação, áreas, artigos do autor.
5. **Artigos**: lista com filtro por área; página de artigo com título em forma de dúvida, resumo, texto, autor + OAB, data e rodapé "conteúdo informativo; não substitui consulta jurídica".
6. **Contato**: endereço, mapa, telefones, e-mail, link de WhatsApp, horário; aviso de que enviar mensagem não cria relação advogado–cliente.
7. **Privacidade e cookies** (LGPD).

## 7. Qualidade técnica
- HTML/CSS simples, sem framework pesado; responsivo 390/768/1280; imagens em WebP com largura e altura e carregamento preguiçoso; fontes com `font-display: swap`.
- SEO: `<title>` e descrição únicos, títulos H1–H3 em ordem, dados estruturados (LegalService/Attorney), sitemap, Open Graph, URLs limpas; manter redirecionamentos do site antigo quando houver.
- Acessibilidade: contraste AA, foco visível, texto alternativo, rótulos, navegação por teclado.
- Verificar com captura de tela (Playwright) em 390 e 1280 px, sem rolagem lateral e sem texto estourando.

## 8. Entrega
Em cada etapa: (1) o que mudou em uma frase; (2) imagem(ns); (3) lista de pontos que dependem do proprietário (fotos, dados, textos); (4) pedido de OK. Registrar decisões em `docs/DECISOES.md`.
