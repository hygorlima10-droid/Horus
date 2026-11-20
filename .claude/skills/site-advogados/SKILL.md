---
name: site-advogados
description: Cria e revisa o site institucional do escritório Falone Advogados e de sites de advocacia em geral (design, estrutura de páginas, textos, artigos, galeria de fotos), respeitando o Provimento 205/2021 da OAB. Use sempre que o pedido for criar, redesenhar, escrever texto ou publicar página, artigo ou protótipo de site de escritório de advocacia.
---

# Skill: site de escritório de advocacia (Falone Advogados)

## 1. Contexto fixo (não perguntar de novo)
- Escritório em Goiás; clientes vêm de indicação e de relacionamento com cooperativas. Áreas a destacar: **agronegócio, direito agrário e cível**. Estrutura física grande e advogados que atuam em várias áreas.
- O site novo **substitui** o de faloneadvogados.com.br (WordPress da agência). Quando pronto: domínio novo próprio, hospedagem em Cloudflare (arquivos estáticos). Nesta fase **não** há CRM nem ligação do WhatsApp ou do formulário com o Horus: botão de WhatsApp comum, com mensagem pré-escrita por área ou advogado, e formulário só como desenho. Tudo fica dentro do artefato até o proprietário publicar fora.
- A lista da equipe (nomes, OAB, fotos) será informada pelo proprietário depois; até lá, usar campos marcados como "a definir" e **nunca inventar nomes**.
- Quem escreve e revisa artigos: **somente advogados**. Todo artigo sai assinado por advogado com nome e número da OAB.
- Quem aprova é o proprietário (advogado, leigo em design). Explicar em português simples, sem jargão técnico.

## 2. Como trabalhar (nesta ordem)
1. **Esboço antes de código**: mostrar o desenho (imagem ou protótipo privado em Artifact) e esperar "OK" explícito. Nada é publicado em domínio sem OK.
2. Protótipo = Artifact privado (uma página HTML). Site final = pasta de arquivos estáticos (`site/index.html`, `areas/`, `equipe/`, `artigos/`, `assets/`), pronta para Cloudflare.
3. Entregar por etapas pequenas (início → áreas → equipe → artigos → contato), cada uma com captura de tela em 390 px (celular) e 1280 px (computador).
4. Informação que falta (nomes, OAB, endereço, fotos, textos de áreas): **perguntar; nunca inventar** nem usar texto de enchimento ("lorem ipsum") ou foto de banco de imagens.

## 3. Regras da OAB (Provimento 205/2021) — diretrizes, com as decisões do proprietário (20/11)
O proprietário **assume a responsabilidade** pelas escolhas de redação dele e prefere não seguir a norma "ao pé da letra". Siga as escolhas abaixo; não reabra a discussão nem sugira trocar o que ele decidiu. Quando houver dúvida real, avise **uma vez**, em uma frase, e siga a decisão dele.
**Decisões que prevalecem (o proprietário escolheu):**
- "Especializada", "especialidades", "equipe especializada em cada área": **pode usar** (o escritório tem certificados). Para **um advogado específico** ("Dr. X é especialista em Y"), só com o título informado por ele (pedir a lista de títulos/certificados).
- Lema do hero: **"Estratégia jurídica, proximidade e compromisso com seus interesses."**
- "Atendimento personalizado" e "profissionais dedicados" **podem**.
- Texto da seção "O escritório" (do PDF): "O Falone Advogados está localizado em Morrinhos, Goiás, no Edifício Luiz Falone. Nossa estrutura foi pensada para proporcionar um ambiente profissional, organizado e adequado ao atendimento individualizado de pessoas, empresas e cooperativas." **Usar como está** (não trocar por texto genérico).
- Galeria com fotos da estrutura (fachada enviada por ele, recepção, gabinete, salas).
- **Sem revisão ética/checklist do Provimento 205** como etapa do trabalho; não propor.
- **Nada de "Sociedade de Advogados"** nem de registro de sociedade: o escritório não tem; rodapé só "Falone Advogados".
- Formulário de contato: só o desenho por enquanto (a ligação ao Horus fica para depois); **sem** aviso do tipo "não envie documentos/detalhes do processo".
- Medição de visitas, cookies/analytics, domínio e hospedagem: **só no fim**, quando ele publicar fora do artefato. Por ora tudo fica dentro do artefato.
**Continua valendo por boa prática (sem sermão):** não inventar resultados, casos, valores, clientes ou depoimentos; não prometer resultado; não citar honorários ou gratuidade; não usar símbolo da OAB; sem logos de clientes; legendas de foto neutras.
**Tom:** institucional, sóbrio, próximo. Frases claras, voz do escritório.

## 4. Referências de design (pesquisa de 20/11/2026)
Vistas por captura de tela: **Demarest, Lefosse, BMA, Felsberg**. Não abriram: Pitta & Baione, Machado Meyer, Mattos Filho. Padrões úteis:
- **Demarest** — cabeçalho azul-marinho escuro com logotipo espaçado, cor de destaque quente (cobre/dourado); menu de 4 itens (Sobre, Áreas, Profissionais, Insights) + telefone + busca; o **conteúdo/artigo é o destaque da primeira tela**; tipografia sem serifa grossa e grande.
- **Lefosse** — tipografia enorme e geométrica como imagem principal; **um único botão de destaque** ("Encontre um advogado"); busca de advogados por nome/cargo/área.
- **BMA** — fundo off-white quente, **uma cor de acento** (vermelho); rótulo pequeno em caixa alta acima de cada título; cartões brancos em grade com seta; lista de artigos com data e categoria; botão de acessibilidade no menu; **aviso fixo contra golpe** ("não solicitamos pagamento por WhatsApp"); rodapé com endereço de cada unidade.
- **Felsberg** — verde-petróleo e dourado suaves, fonte humanista; **foto real da recepção do escritório**; faixa escura com 3 notícias; mesmo aviso contra golpe. (Não copiar a faixa de ranking/prêmio: o provimento restringe.)
- **Boas práticas de guias 2026 (blogs de agências, tratar como orientação)**: dizer em segundos o que o escritório faz, onde e como falar; uma página por área, escrita a partir da dúvida do cliente; foto real e equipe como pessoas; conteúdo como prova de autoridade; FAQ; celular primeiro; carregar rápido; política de privacidade (LGPD); evitar pop-ups e sliders automáticos.
- **Escritório de Brasil Salomão e Matthes (2026)** encomendou fotografia própria no escritório com a equipe: foto real vale mais que qualquer ilustração.

## 5. Identidade visual oficial do Falone (vale como lei; não inventar cores nem logotipo)
Fonte: `Falone.pdf` (logotipo para fundo escuro), `Falone-Fundo-Branco.pdf` (para fundo claro), `Falone-sem-fundo.png` e `paleta_falone.html`, enviados pelo proprietário. Os PDFs são vetoriais (Illustrator), então viram SVG sem perda.
- **Logotipo:** "F" dourado com folha verde, "FALONE" em serifada clássica de alto contraste e "ADVOGADOS" em sem serifa espaçada, entre dois filetes, com um pequeno detalhe em V embaixo; tudo em degradê dourado (de #DCBF66 a #B48543). Nunca recolorir, esticar, sombrear nem colocar sobre foto movimentada. Usar a versão sem fundo sobre o verde institucional e a de fundo branco sobre áreas claras; dar respiro em volta equivalente à altura do "F".
- **Paleta oficial** (HEX; RGB/CMYK no arquivo da paleta):
  - Verde Institucional (primária) **#183629**
  - Ouro Envelhecido (secundária) **#C5A059**
  - Cinza Grafite (apoio e texto) **#333333**
  - Off-White (fundos e telas) **#F8F9FA**
  - Folha do logotipo: verde mais vivo (≈ #2A9437), **só dentro do logotipo**, nunca como cor de interface.
- **Contraste medido (mínimo AA = 4,5:1 para texto):** branco/off-white sobre verde 12–13:1 ✔; **ouro sobre verde 5,35:1 ✔**; grafite sobre off-white 12:1 ✔; verde sobre off-white 12,5:1 ✔; **ouro sobre off-white só 2,3:1 ✘** → ouro **não** serve para texto ou link em fundo claro (só filetes, ícones grandes e detalhes). Em fundo claro, links e botões usam o verde. Botão principal: fundo ouro com texto verde, ou fundo verde com texto off-white. A folha do logotipo sobre o verde tem contraste baixo (≈ 3,4:1): testar o logotipo no cabeçalho verde no esboço antes de aprovar.
- **Tipografia (decidida por enquanto; o proprietário reavalia depois):** títulos em **Cormorant Garamond** (serifada clássica, como o "FALONE" do logotipo) e texto e menus em **Montserrat** (como o "ADVOGADOS"). Tamanho mínimo 16 px no celular.
- **Sensação:** sério, regional, de campo e de confiança, elegante e com muito espaço em branco — não "balança e martelo". Telas alternando faixas verde-escuro e off-white, filetes dourados finos, poucos elementos por tela.
- **Componentes:** cabeçalho simples (Início, Áreas de atuação, Equipe, Artigos, Contato + telefone), um botão principal por tela, cartões de área, cartões de equipe, lista de artigos com data/área/autor, galeria em grade com ampliação, rodapé com endereço, telefones e OAB.
- **Evitar:** slider automático, pop-up, animação pesada, emoji, ícone de balança, texto sobre foto sem contraste, rolagem lateral, qualquer cor fora da paleta.

## 5b. Fotos (pastas do Drive: "Escritório - salas Falone" e "inauguração - Falone")
- **Ambientes (galeria da estrutura):** gabinete com a parede do logotipo e poltronas de couro, recepção com painel de mármore verde e luminárias circulares, sala com parede de pedra e estantes iluminadas (pasta "salas", cerca de 15 fotos).
- **Inauguração:** as fotos com pessoas podem ser usadas (são conhecidos que prestigiaram o evento e já estão em redes sociais; o proprietário dispensou autorização por escrito). Preferir as sóbrias e bem enquadradas; evitar copo de bebida ou comida em primeiro plano e foto desfocada/escura.
- **Equipe:** o proprietário vai informar quem é da equipe. **Dar ênfase às fotos em que os integrantes do escritório aparecem** (primeira tela, página da equipe, galeria). Legendar só com nome e função de quem for da equipe; **não** legendar convidados com nome nem chamá-los de "clientes".
- **Não usar:** foto em que apareça marca de terceiro ou de cliente (ex.: caderno da Sicoob na mesa, IMG_2906) e foto com reflexo de pessoa não identificada.
- **Legendas neutras:** "Recepção", "Sala de reuniões", "Gabinete", "Inauguração do escritório". Nada de metros quadrados, número de salas, "amplo", "moderno", "sofisticado" nem comparação.
- **Tratamento técnico:** originais têm 3–6 MB (até 5712×4284); gerar WebP em 800 e 1600 px de largura, com `width`/`height`, carregamento preguiçoso e cor uniforme; remover metadados (EXIF/GPS). Escolher 8 a 12 fotos para a galeria e 1 horizontal forte para a primeira tela.

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
