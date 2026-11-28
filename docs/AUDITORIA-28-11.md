# Auditoria de 28/11/2026 — botões, funcionalidades novas e estudo de novas ferramentas

Pedido do proprietário: verificar bugs nas funcionalidades novas e nos botões em geral, e incluir um estudo de novas ferramentas. CRM, site novo e as outras decisões ficam em espera.

## 1. Método
1. **Varredura automática de tela** (nova: `test/auditoria-botoes.test.mjs`, grupo `permissoes`). Percorre todas as abas e sub-abas, abre os menus "⋯", as listas de abatimentos, as janelas "Novo/Adicionar", e mede o que o usuário costuma flagrar a olho: botão sobre botão, botão sobre texto, botão fora da tela, página que rola para o lado, erro de JavaScript. Telas: proprietário em 360, 390, 768 e 1280 px; advogada e estagiário em 390 px. Dados de teste com textos compridos, valores grandes, despesa com abatimentos, parcelada, contas fixas pagas e pausadas.
2. **Revisão estática** do código gerado: botões com ação sem tratador (nenhum), ids duplicados (nenhum no HTML), botões com id sem uso.
3. **Suíte completa** de testes do app.
4. Revisão de lógica das funcionalidades novas (Delegadas › Fixas, tarefas fixas, despesas, fatura, revisão de processos).

## 2. Resultado

**Estabilidade:** 0 erros de JavaScript em 6 combinações de tela e papel (proprietário em 360, 390, 768 e 1280 px; advogada e estagiário em 390 px), em todas as abas, sub-abas, menus "⋯", listas abertas e janelas "Novo/Adicionar". Nenhum botão com ação sem tratador. Nenhum id duplicado no HTML.

**Bugs encontrados e corrigidos nesta auditoria**
| # | Onde | Problema | Correção |
|---|---|---|---|
| 1 | Delegadas › tarefa fixa (alfinete) | Marcar "Feita" **adiantado** (tarefa semanal cuja dia da semana já passou nesta semana, ou criada depois dele) não aparecia como feita e **não dava para desfazer**: o segundo toque não fazia nada. Dependia do dia da semana, por isso o teste `delegadas` falhava só em certos dias. | O estado "feita" e o "desfazer" passam a considerar a última ocorrência marcada na janela. Teste `delegadas` volta a passar por inteiro. |
| 2 | Análises › Futuro, celular de 360 px | O botão "Marcar uma entrada como dinheiro da obra" passava 4 px da tela e fazia a página rolar para o lado. | O texto dos botões desse bloco quebra linha em vez de passar da tela. |
| 3 | Revisão de processos e "Sem advogado definido" | O número do processo clicável que fiz há dois dias era botão só de texto, fora do padrão "todo botão é cartão" (o teste `botoes-guarda` acusava). | Virou botão em forma de pílula, igual aos outros. |
| 4 | Construção › Referência de custo | "Ver no IBGE" era link solto no meio do texto (o mesmo teste acusava). | Botão no padrão, em linha própria. |
| 5 | Testes | `botoes-guarda` e a nova varredura criam muitos registros e **bagunçavam o teste `responsaveis`** (que falhava ou passava conforme a ordem). | Foram para um grupo próprio, com banco novo a cada teste (`telas-isoladas`). |

**Não são bugs (conferido):** a varredura acusou "botão sobre texto" em Análises › Orçamento e Histórico; eram itens dentro de blocos recolhidos (`<details>` fechado) que o navegador mede mas ninguém vê. O filtro da varredura foi corrigido para ignorar o que não está visível; hoje ela fecha com **0 achados** nas 6 telas.

**O que não foi coberto:** o perfil Familiar (outro grupo de testes), janelas além das de "novo/adicionar", e arrastar/soltar. A suíte completa (192 testes, mais de 2 horas) **não foi rodada até o fim**: rodei os grupos das áreas alteradas (`delegadas`, `delegadas-contas`, `delegada-agenda`, `delegadas-acesso`, `planilha-avisos`, `agenda-resp`, `abas-fixas`, `despesas-aba-celular`, `despesas-aba-tela`, `financas-botoes`, `despesa-parcelada-tela`, `revisao-diario`, `responsaveis`, `responsaveis-tela`, `botoes-guarda`, `obra-calculadora`, `indices`) e todos passam.

## 3. Estudo: novas ferramentas para o Horus

Critério: aproveitar o que **já existe no app** (DJEN, DataJud, leitor de documentos, Delegadas, Despesas, duplicidade, Central de atenção, feed de calendário .ics, R2, notificações), sem depender da decisão sobre CRM/site/WhatsApp (que ficam em espera). Cada item: o que é, por que vale, esforço (P = horas, M = alguns dias, G = semanas), risco.

### Prioridade alta (resolvem dor real, esforço baixo ou médio)
| # | Ferramenta | O que faz | Por que agora | Esforço | Risco |
|---|---|---|---|---|---|
| 1 | **Conferir com o extrato** (conciliação assistida) | Em Finanças › Contas/Reserva, "Conferir com o extrato": o leitor geral (que já lê Caixa, Nubank, C6, Sicoob) compara o extrato com o que está lançado e lista **só as diferenças**: lançado a mais, a menos, duplicado, data trocada. Confirma-se item a item. | A reserva de emergência (R$ 6.480 no app × R$ 5.045 no banco) e os aportes de R$ 300 duplicados levaram horas de conferência manual. A ferramenta faria em segundos e evitaria o erro. | M | Baixo (nunca grava sozinha: só propõe) |
| 2 | **Painel "Saúde dos dados"** | Em Configurações, botão "Verificar": roda checagens automáticas e lista o que merece olhar: lançamentos duplicados (reusa `duplicidade.js`), aportes sem origem, despesas sem categoria, processos sem cliente, tarefas sem responsável ou sem data, contas fixas atrasadas, clientes quase iguais. Cada linha leva ao cadastro. | Hoje o app só avisa na hora de criar. Os problemas que apareceram (duplicados, "Recebi R$" irreais, cliente sugerido errado) se acumulam sem ninguém ver. | P a M | Baixo (só leitura) |
| 3 | **Movimentações pelo DataJud** | Para cada processo cadastrado, consulta o DataJud periodicamente e avisa na Central quando há **movimentação nova** (juntada, decisão, remessa) mesmo **sem publicação no Diário**. | O Diário (DJEN) só traz o que é publicado. Muita coisa relevante (decisão interlocutória, mudança de fase, baixa) não vira publicação. O app já tem `src/datajud.js` e usa o DataJud na importação. | M | Médio: cobertura e atraso variam por tribunal; mostrar sempre "fonte: DataJud, pode atrasar" e nunca contar prazo a partir dele |
| 4 | **Cobrança com um toque** | Em "A cobrar", botão que monta a mensagem ("Olá, Fulano, a parcela X de R$ Y venceu em dd/mm…") com o texto padrão e abre o WhatsApp ou e-mail do cliente já preenchido, e registra "cobrado em" no cadastro. | O app já abre `wa.me` em outros pontos. Sem API paga e sem depender da decisão do WhatsApp integrado: é só um link. Falta o histórico de "quando cobrei", que hoje é de cabeça. | P | Baixo (a pessoa revisa e envia) |
| 5 | **Linha do tempo do cliente** | Na ficha do cliente, uma linha do tempo única: publicações, andamentos, tarefas, peças, pagamentos e cobranças em ordem de data, com filtro. | Os dados já existem em coleções separadas; hoje para entender um cliente é preciso abrir 4 abas. Serve também de base para o futuro CRM, sem comprometer a decisão. | M | Baixo |

### Prioridade média
| # | Ferramenta | O que faz | Esforço | Risco |
|---|---|---|---|---|
| 6 | **"Meu dia"** por pessoa | Uma fila única priorizada por pessoa: prazos fatais de hoje e amanhã, delegadas atrasadas, publicações novas, contas a pagar. A Central de atenção existe, mas mistura tudo para todos; a estagiária ganharia uma lista só dela, na ordem em que deve agir. | M | Baixo |
| 7 | **Anexos por processo (R2)** | Guardar PDFs (decisões, peças, comprovantes) dentro do processo, com busca por nome e visualização. O R2 já é usado no atalho do iPhone. | M | Médio: custo de armazenamento (baixo) e regra de acesso por advogado (reusar a política que já existe) |
| 8 | **Atualização monetária e honorários** | Calculadora de correção de parcelas e valores (INPC, IPCA, Selic) usando os índices que o app já busca (`indices`). Útil para acordos parcelados e cobrança. | M | Baixo; sempre mostrar a fórmula e o índice usado |
| 9 | **Minutas a partir do cadastro** | Gerar .docx de procuração, contrato de honorários e petições repetitivas já preenchidos com os dados do cliente e do processo; a pessoa revisa. | M a G | Médio: modelo precisa de revisão jurídica; nunca sai sem conferência humana |
| 10 | **Lembretes de conta por e-mail** | Descartado pelo proprietário para as contas fixas (28/11). Fica registrado como possível, não prioridade. | — | — |

### Qualidade do próprio sistema (barato e vale muito)
| # | Item | O que faz |
|---|---|---|
| Q1 | **Varredura de tela antes de cada publicação** | `test/auditoria-botoes.test.mjs` entra na rotina: se um botão cobrir outro ou o texto, ou a página rolar de lado, o teste falha antes de você ver. Evita o ciclo "você manda foto, eu corrijo". |
| Q2 | **Datas fixas nos testes** | Os testes de tarefa fixa dependem do dia da semana (o `delegadas` falhava por isso). Usar uma data fixa elimina falha que vai e volta. |
| Q3 | **Fotos de referência (regressão visual)** | Guardar uma foto de cada aba em 390 px e comparar nas mudanças: avisa quando uma tela muda sem querer. |

### Em espera (decisão do proprietário)
CRM, captação de leads, WhatsApp integrado e site novo continuam como estão em `docs/PESQUISA-CRM-LEADS-WHATSAPP-SITE.md` e `docs/AUDITORIA-VIABILIDADE-SITE-CRM.md`. A **linha do tempo do cliente (5)** e o **cobrar com um toque (4)** são passos úteis em qualquer cenário e não obrigam a nenhuma decisão sobre eles.

### Ordem sugerida
1 → 2 → 4 → 3 → 5. As três primeiras são pequenas e de baixo risco; a 3 (DataJud) é a de maior ganho para o dia a dia jurídico e merece um piloto com poucos processos.
