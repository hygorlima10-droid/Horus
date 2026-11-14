# Auditoria do Horus: visual, layout e funcionamento (14/11/2026)

Pedido do proprietário: olhar todas as abas e sub-abas (design, layout, sobreposição, identidade visual) e avaliar como as funções rodam hoje, com foco em **Processos** e **Publicações**, procurando simplificação e integração para o dia a dia. **Nada foi alterado no app** por esta auditoria; tudo abaixo é achado e proposta.

## 1. Resumo

**O app está visualmente coerente e estável.** Uma só família de letra (Inter), os mesmos cartões, o mesmo dourado como acento, ícones e cabeçalhos iguais em todas as abas. Nas 71 telas visitadas (19 abas, 39 sub-abas e 13 janelas) em celular de 390 px e computador de 1280 px: **nenhum erro de script, nenhuma requisição com erro, nenhuma rolagem para o lado e nenhuma barra de baixo cobrindo conteúdo.** (A revisão visual achou uma tabela cortada no celular, item V3.)

O que mais pesa, em ordem:

1. **Publicações e Processos pedem muitos toques e muita rolagem.** A ficha do processo tem ~3.000 px no celular, com a parte útil (prazos, linha do tempo) escondida no meio do formulário; confirmar um prazo de uma publicação passa por duas telas e dois botões "confirmar".
2. **O dourado dos botões principais não passa no teste de contraste** (texto branco sobre dourado = 3,1:1; o mínimo é 4,5:1).
3. **Um defeito real:** em Construção › Etapas o rótulo da situação ("Em andamento", "A fazer") está invisível (texto branco sem fundo).
4. **Identidade:** convivem ícones desenhados (o conjunto do app) e emojis (Configurações e os botões novos da Agenda); a escala de cantos arredondados tem pelo menos 8 valores; 57% do texto está em 12 px ou menos.
5. **Alvos de toque pequenos** (menos de 30 px) em dezenas de lugares, inclusive nos atalhos novos da Agenda.
6. **Avisos repetidos em toda sub-aba** ("4 registros sem advogado definido · Definir", "Ligações a revisar").

## 2. Como foi feito

- Servidor local com dados de verdade (clientes, Iniciais, Acordos, Alvarás, processos, publicações simuladas do Diário, Agenda com prazos/tarefas/audiências, finanças, obra, extratos).
- Varredura automática de cada aba e sub-aba em 2 tamanhos (celular 390 px e computador 1280 px), medindo: estouro lateral, sobreposição entre elementos, texto cortado, alvos de toque, contraste, famílias e tamanhos de letra, estilos de botão e barra de baixo sobre o conteúdo. Mais fotos de cada tela, que eu olhei uma a uma.
- Leitura do código de Processos, Publicações e da ficha do processo, e simulação dos fluxos reais.
- **Falsos positivos descartados:** o detector marcou "sobreposição" em Análises, Orçamento, Iniciais › Quadro e Construção; olhei de perto e eram ícones e etiquetas encostados, sem defeito visual.

## 3. Achados visuais

Severidade: **A** = corrigir logo, **M** = vale corrigir, **B** = melhoria de estética.

| # | Sev. | Onde | O que | Sugestão | Esforço |
|---|---|---|---|---|---|
| V1 | **A** | Construção › Etapas | O rótulo de situação da etapa ("Em andamento", "A fazer") não aparece: o texto é branco e as classes `ob-st-*` não têm fundo definido | Definir as cores das duas situações (e "Concluída") como pílulas | pequeno |
| V2 | **A** | Todo o app | Botões dourados com texto branco: contraste 3,1:1 (Novo compromisso, Recebi R$, Buscar agora, Novo processo, Gasto). Mínimo de leitura confortável: 4,5:1 | Escurecer o dourado do botão (algo como `#A56C00`) ou usar texto escuro; manter o dourado atual nos detalhes | pequeno |
| V3 | **A** | Análises › cenários lado a lado (celular) | A tabela dos 4 cenários corta a última coluna ("Próx. 3" aparece como "R$ 5.4:") | Tabela com rolagem lateral própria ou fonte menor nas colunas | pequeno |
| V4 | M | Agenda (cartões novos) | Atalhos Adiar/Editar/Peça pronta/WhatsApp têm 27 px de altura | Subir para 34–36 px (no iPhone o ideal é 44) | pequeno |
| V5 | M | Vários | Alvos pequenos: "Definir" (22 px, em 34 telas), setas do mês ‹ › (26 px), "Editar" (24 px), "(i)" de ajuda (24 px), "6 meses/12 meses" (25 px) | Aumentar a área de toque (padding) sem mudar o desenho | médio |
| V6 | M | Todas as telas de lista | Texto muito pequeno: 57% do texto tem 12 px ou menos e 48 trechos têm 9–10 px (iniciais "HA" nos cartões, selos) | Piso de 12 px para texto e 11 px só para selos | médio |
| V7 | M | Iniciais, Acordos, Alvarás, Processos, Clientes, Arquivados | A faixa "N registros sem advogado definido · Definir" (e "Ligações a revisar") repete em **todas as sub-abas**, empurrando o conteúdo ~60 px | Um único selo "Pendências de cadastro (5)" no cabeçalho, que abre o painel | médio |
| V8 | M | Configurações e botões da Agenda | Emojis (🔔 💾 📤 🏦 ⏱ ✎ 💬 ☑ 🧮) misturados ao conjunto de ícones do app; emojis mudam de cara entre iPhone, Windows e Android | Trocar por ícones do conjunto do app | médio |
| V9 | M | Computador | Cartões esticam até ~900 px (Agenda, Publicações) com muito espaço vazio dentro; janelas longas (Processo, Publicação) ficam estreitas (~380 px) | Em telas ≥ 1000 px: grade de 2 colunas nas listas e janelas de ~720 px com formulário em 2 colunas | médio |
| V10 | B | Barras de sub-abas | Seis sub-abas (Agenda: Resumo, Meu dia, Semana, Mês, Lista, Quadro; Finanças) passam da largura do celular e a última fica cortada (precisa deslizar) | Rótulos mais curtos ou barra que já rola até a aba ativa | pequeno |
| V11 | B | Raios dos cantos | 8, 9, 10, 12, 14, 18, 50 e 99 px convivem (botões 8–14, cartões 18, pílulas 99) | Escala única: 8, 12, 16 e pílula | médio |
| V12 | B | Botões | Dois "primários": dourado (criar/adicionar) e preto (confirmar/abrir/salvar). Na prática segue uma regra, mas há exceções ("Transferir para a PF" é preto, "Conferir extrato" também) | Documentar a regra (dourado = criar; preto = confirmar) e alinhar as exceções | pequeno |
| V13 | B | Nomes | "Meus", "Minha agenda", "Minhas" e "Escritório/Todas" nomeiam a mesma ideia em abas diferentes | Padronizar: "Meus" e "Escritório" | pequeno |
| V14 | B | Análises | As sub-abas são botões em pílula (grade 3+2), as demais abas usam abas sublinhadas | Usar o mesmo componente das outras abas | pequeno |

Pontos fortes (manter): cabeçalho padrão com seletor de mês e "olho" de discrição; cartões de indicador com ícone colorido; barra de baixo flutuante; respiro e hierarquia (valor grande, rótulo pequeno); cores com significado fixo (vermelho = atraso, verde = ok, dourado = atenção).

## 4. Publicações: como roda hoje e o que dá para simplificar

**Hoje.** Cada publicação vira um cartão de ~250 px com até 4 botões em linha dupla ("Confirmar: Cumprimento da determ…", "Ver texto", "Marcar como lida", "Cadastrar processo"). Tocar em "Confirmar: peça" **abre a ficha da publicação** (texto, agenda, peça sugerida, prazo da peça: dias, contagem, dobro, datas, responsáveis) e **só no fim da rolagem** aparece o segundo botão "Confirmar prazo". São dois "confirmar" para a mesma coisa. No topo há "Minhas | Todas", quatro sub-abas, "Buscar agora", "OABs monitoradas", filtro e menu: ~300 px antes do primeiro cartão.

**O que já funciona bem:** prazo sugerido a partir do texto (e aprendizado das suas escolhas), publicação ligada ao processo cadastrado, "Criar audiência" a partir do texto, "Cadastrar processo" a partir da publicação, "marcar todas como lidas".

**Propostas (da maior para a menor economia de tempo):**

- **P1. Confirmar em um passo.** Folha curta, em vez da ficha longa: "Contestação · 15 dias úteis · vence qua 09/12 · responsável Hygor" com **[Confirmar]** e **[Ajustar…]** (o formulário atual fica atrás do "Ajustar"). Botão de confirmar fixo no rodapé. Resultado típico: 2 toques, sem rolagem.
- **P2. Cartão com 1 ação principal + menu ⋯.** "Ver texto", "Marcar como lida", "Não é prazo" e "Cadastrar processo" vão para o ⋯ (ou para deslizar). Cartão cai de ~250 para ~150 px; cabem o dobro por tela.
- **P3. Modo triagem.** Uma publicação por vez, com "Confirmar / Não é prazo / Lida / Próxima" e contador ("3 de 6"), e o mesmo no atalho do computador (teclas). É o ritual da manhã; hoje é uma lista para rolar.
- **P4. Regime de contagem sugerido sozinho.** Com a calculadora nova, escolher o regime pelo órgão: "Vara Criminal" → CPP; "Juizado" → JEC; TRT/Justiça do Trabalho → CLT; Fazenda/INSS/Estado → alerta de prazo em dobro. Hoje a ficha só oferece "dias úteis/corridos".
- **P5. Agrupar por processo.** Publicações do mesmo processo no mesmo dia (ou semana) viram um cartão só, com o resumo do processo (cliente, próximo prazo, última movimentação).
- **P6. Confirmar em lote as de alta confiança.** O app já aprende (peça e prazo que você escolhe por tipo de publicação). "Confirmar as 4 sugeridas" com lista para revisar antes.
- **P7. Cabeçalho mais enxuto.** Fundir "Minhas | Todas" nas sub-abas (Minhas · Todas · Não lidas · Resumo), mover "OABs monitoradas" e "Buscar agora" para um ⋯ (a busca roda sozinha todo dia às 10h).

## 5. Processos: como roda hoje e o que dá para simplificar

**Hoje.** A lista tem cartões com "Abrir" e "Concluir e arquivar". A ficha do processo é **um formulário de edição** (número, partes, tribunal, classe, área, assunto, data, valor, clientes, honorários) e só **depois** vêm "Prazos e audiências", "Linha do tempo" (próximos e anteriores, com publicações, marcos e prazos), "Histórico", "Próxima providência", observações e advogados. No celular são ~3.000 px; a linha do tempo, que é o que se consulta no dia a dia, fica a ~1.500 px do topo.

**Propostas:**

- **R1. Ficha como painel, edição à parte.** Topo com o resumo: partes, cliente, situação, **próximo prazo**, **a receber**, **última publicação**, advogados. Abaixo, abas: **Resumo** (linha do tempo) · **Agenda** · **Publicações** · **Honorários** · **Dados** (o formulário de hoje) · **Histórico**. Editar passa a ser uma aba, não a tela inteira.
- **R2. Lista mais limpa.** Tocar no cartão abre a ficha ("Abrir" some); "Concluir e arquivar" vai para o ⋯. Mostrar no cartão o próximo prazo com a data (hoje é só "1 prazo aberto").
- **R3. Buscar dados sozinho.** Hoje há dois botões ("Buscar dados no Diário Oficial", "Buscar dados no DataJud") e o app já valida o número ("Número válido · TJGO · Justiça Estadual · ano 2010"). Rodar a busca automaticamente quando o número estiver válido e **mostrar o que foi preenchido** (partes, órgão, classe, assunto, valor) com opção de desfazer.
- **R4. Calculadora dentro do processo.** Em "Novo prazo deste processo", oferecer "Calcular a partir da intimação" (já herdando cliente, responsáveis e regime).
- **R5. Colar o número abre o processo.** Na busca global (e no atalho do computador), colar um número de processo abre a ficha, ou oferece "Cadastrar".
- **R6. Pendências em um só lugar.** "Sem advogado definido", "Ligações a revisar" e "Sem cliente vinculado" viram uma única central de pendências do jurídico (ver V7).

## 6. Integração entre funções (o fio do dia a dia)

O fio hoje: **Publicação → (confirmar) → Prazo na Agenda → (peça pronta) → protocolo**, com a **ficha do processo** como ponto de consulta. Os elos que faltam:

1. **Início com "Meu dia".** Hoje o Início tem "Prazos processuais" (7 dias) e a "Central de atenção" (misturando dinheiro e jurídico). Um cartão "Meu dia" (audiência de hoje, vence hoje, peças prontas para conferir, publicações novas para triar) com os mesmos atalhos da Agenda tornaria o Início o painel da manhã.
2. **Publicações novas dentro do Meu dia.** "6 publicações novas" como linha de ação (abre o modo triagem).
3. **Publicação → Peça → Agenda → Processo no mesmo gesto.** Ao confirmar o prazo, já oferecer: responsável (herdado do processo), regime (herdado do órgão), e abrir o processo se a pessoa tocar no cartão resultante.
4. **Processo → Honorários → Cobrança.** A ficha já mostra os honorários; falta o atalho "Cobrar" quando houver parcela vencida (para quem pode cobrar).
5. **Calendário do iPhone** já leva as audiências; o mesmo link poderia (opcional, depois) levar os **prazos fatais**, com alerta, se você quiser.

## 7. Plano priorizado

**Onda 1 (correções, ~1 dia):** V1 (rótulo invisível), V2 (contraste do dourado), V3 (tabela cortada), V4 (atalhos da Agenda maiores), V10 (barra de abas), V13 (nomes).

**Onda 2 (o que mais economiza tempo, ~2–3 dias):** P1 + P2 (Publicações em 1 passo e cartão enxuto), R1 + R2 (ficha como painel e lista limpa), V7 (pendências em um lugar), V5 e V6 (alvos de toque e tamanho mínimo de letra).

**Onda 3 (acabamento e inteligência, ~3–4 dias):** P3 (triagem), P4 (regime pelo órgão), P5 e P6 (agrupar e confirmar em lote), R3 a R5, V8 (ícones no lugar de emojis), V9 (computador), V11 e V12 (escala de cantos e botões), integração do Início (seção 6).

Cada item de interface passa por **esboço e OK antes de implementar**, como combinado.

## 8. Decisões que preciso de você

1. Posso fazer já a **Onda 1** (correções sem mudar o desenho, só consertar e ajustar contraste/tamanho)?
2. Para a **Onda 2**, quer que eu comece pelo esboço de **Publicações em 1 passo** ou da **ficha do processo como painel**?
3. Cor dos botões principais: prefere **escurecer o dourado** (mantém a identidade) ou **texto escuro sobre o dourado atual**?
4. Os **prazos fatais** devem ir também para o calendário do iPhone (hoje só audiências)?
