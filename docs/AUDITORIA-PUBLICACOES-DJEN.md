# Auditoria das Publicações e da leitura do DJEN (19/11/2026)

Pedido do proprietário: verificar, após alguns dias de uso, (1) se todas as publicações chegam para cada advogado e
(2) se as funções novas (marcar como lida, reunir publicações iguais, "tratada", "não é prazo") podem fazer alguma
intimação passar despercebida. Auditoria **somente de leitura**: nada foi alterado no sistema nem nos dados.

## Como foi feito
- Conferência **ao vivo contra o DJEN** (conector Legal MCP, mesma fonte da API do CNJ), 09/11 a 19/11, comparando
  o `id` de cada comunicação com a coleção `_pub` do banco.
- Consultas somente de leitura no D1 (config das OABs, estado de leitura por pessoa, grupos de publicações iguais,
  atraso entre a data da publicação e a gravação).
- Leitura do código: `src/djen.js` (leitura, aviso, visão por pessoa), `src/index.js` (resumo das 10h, agendamentos),
  `cliente/publicacoes.js` (agrupamento, lida, badge, visibilidade).
- Limite: o acesso direto do servidor de trabalho à API do DJEN estava bloqueado e o conector devolveu erro 500 em
  parte das chamadas; por isso a conferência do Murilo cobre só 18–19/11 (30 de 30) e a de Hygor tem a contagem
  completa (128 = 128) mas os 100 primeiros ids conferidos um a um.

## 1. As publicações estão chegando? — SIM (sem perda na chegada)
| OAB | DJEN | Banco | Resultado |
|---|---|---|---|
| Hygor 60456/GO (09–19/11) | 128 | 128 | igual; 100 ids conferidos um a um, 0 ausentes |
| Hitallo 65729/GO (09–19/11) | 54 | 54 | igual, 0 ausentes |
| Nathanny 74506/GO (09–19/11) | 45 | 45 | igual, 0 ausentes |
| Murilo 49308/GO (18–19/11) | 30 | 30 | igual, 0 ausentes (janela completa: não conferida, DJEN com erro 500) |

Leitura das 4 OABs hoje sem erro. Atraso entre a data da publicação e a gravação: 77 % no mesmo dia; os 23 %
restantes são todos de segunda 16/11 (gravadas só terça 05h) — um dia sem leitura, a investigar (item 6).

## 2. Achados que podem fazer uma intimação passar despercebida (ordem de gravidade)

### A. ALTO — OAB "só processos em conjunto" esconde a publicação de TODOS, inclusive do próprio advogado
Hitallo e Nathanny estão com escopo **conjunto**. A lista do app (`pbVisiveis`, no cliente) só mostra publicação dessas
OABs se o processo estiver cadastrado (ou vier também por OAB "tudo"). O filtro roda no aparelho de **qualquer**
pessoa — Hygor, estagiárias e os próprios Hitallo e Nathanny. A contagem das "Não lidas" também ignora essas publicações.
- Dado real: **26 de 539** publicações (5 %) estão ocultas hoje (Nathanny 18, Hitallo 8; conferência por número do processo nos cadastros). Entre elas: sentenças com
  **prazo sugerido de 15 dias** (11/11 e 18/11), decisões com 5 dias, e um **HC com audiência de instrução e julgamento
  designada para 01/12/2026** (processo 6049114-36.2026.8.09.0107, publicações de 16/10 e 03/11).
- Nenhuma delas foi lida/tratada por ninguém (consistente com não aparecerem).
- Causa: o escopo "conjunto" foi pensado para uma OAB de parceiro; as duas pessoas agora têm login e a regra continua
  escondendo a OAB delas.
- Correção proposta: (i) a OAB da própria pessoa nunca é escondida na tela dela; (ii) trocar Hitallo e Nathanny para
  "tudo" (configuração, decisão do proprietário); (iii) um aviso "N publicações de OABs em conjunto fora da lista" com
  botão para ver.

### B. ALTO — Aviso (push) só nasce das OABs com "avisar" ligado; só Hygor está ligado
`notificada` é verdadeira desde a gravação para OABs com `avisar:false` (Murilo, Hitallo, Nathanny). O resumo de
cada pessoa usa só publicações com `notificada=false`; logo Hitallo e Nathanny só recebem aviso das publicações que
também aparecem pela OAB do Hygor. O Murilo não tem login e nenhuma das publicações só dele gera aviso.
- Correção proposta: o aviso de cada pessoa sai das publicações **das OABs dela**, independentemente do "avisar" do
  proprietário (o "avisar" passa a valer só para o aparelho do proprietário).

### C. MÉDIO — Visão "Minhas" do proprietário não inclui publicações do Murilo nem dos processos dele
No modo "Minhas" o servidor só devolve publicações das OABs do Hygor (`visaoDePubs`: o `doProcesso` só vale para
advogado). Publicações só da OAB do Murilo (45 + combinadas) ficam fora; só as estagiárias (que veem tudo) e o
modo "Escritório" as mostram. Como o Murilo não tem login, é a única rede de segurança.
- Correção proposta: incluir no "Minhas" do proprietário os processos em que ele está cadastrado como responsável e
  mostrar um selo com o número de publicações do escritório fora da visão atual.

### D. MÉDIO — Reunir publicações iguais pode juntar atos de natureza diferente
A chave é processo + data + hash do texto. Textos-padrão ("PROCESSO EM SEGREDO DE JUSTIÇA…", "ARQUIVOS DIGITAIS
INDISPONÍVEIS…") têm hash idêntico mesmo quando o tipo é diferente. Caso real: 58959739-42.2026.8.09.0107, 18/11:
**uma "Decisão" e duas "Outros" viraram um cartão só** (e 6008864-10.2026.8.09.0123, 27/10). Marcar o cartão como lido
marca as três; o cartão mostra o tipo do primeiro. Em segredo de justiça o texto da decisão nem vem no DJEN.
- Correção proposta: incluir o tipo na chave do grupo; no cartão agrupado mostrar a lista de tipos ("Decisão +
  2 Outros"); nunca agrupar quando o tipo for diferente.

### E. MÉDIO — "Lida" não significa "providenciada"
Nada liga "lida" a "prazo lançado": marcar lida some da lista de quem marcou; para estagiárias, **qualquer pessoa**
ter lido já tira a publicação da lista delas (`algumOutro`), e tratada por advogado/proprietário vira lida para todos
os outros advogados. O botão "Criar tarefa delegada" já vem com "marcar como tratada" ligado (decisão A de 19/11),
então uma tarefa sem prazo fatal faz a publicação sumir da fila dos demais. Mitigações existentes: aba "Resolvidas por
outros" (30 dias), "fulano leu, sem prazo", e o que foi marcado "não é prazo" só vale para a pessoa.
- Correção proposta: filtro "Lidas sem prazo/audiência/tarefa" com prazo sugerido pelo texto; "Marcar todas como
  lidas" pedir confirmação com a contagem de publicações com prazo sugerido; tarefa delegada **sem prazo fatal** não
  marca como tratada por padrão.

### F. BAIXO/MÉDIO — Uma leitura por dia (+ a do app ao abrir)
Leitura do servidor às 10h (13Z) com o resumo; 12h/14h/16h/18h só relêem se houve erro. O app lê ao abrir quando
`ultima ≠ hoje`. Depois da primeira leitura bem-sucedida do dia, publicações indexadas mais tarde só entram na
próxima manhã (a janela de 2 dias de sobreposição garante que **não se perdem**, só atrasam até ~1 dia). Hoje, 5 publicações só entraram na
leitura das 10h (as demais já estavam na leitura da madrugada).
- Correção proposta: reler sempre às 14h e 18h (cabe no orçamento de 36 consultas por rodada).

### G. BAIXO — Limites
- Lista do proprietário: 90 dias e máximo de 1.500 (hoje 539 em 90 dias: folga de ~3x).
- `dest` limitado a 4 destinatários e `advs` a 8 por publicação: só afeta exibição do nome da parte e a atribuição por
  OAB de publicações com muitos advogados (a OAB que a buscou continua registrada em `oabs`).
- Orçamento de 36 consultas por rodada: se estourar, a leitura fica "parcial" e `ultima` não avança (reler cobre).
- O DJEN é consultado por número de OAB: intimação em nome de advogado sem OAB indicada, ou direcionada à
  sociedade, não aparece (limitação da fonte, não do Horus).

## 3. O que está funcionando bem
Chegada completa; deduplicação por id do DJEN (mesclando OABs); "só marcar como lida" **não** some para os demais
(vêem "fulano leu, sem prazo"); grupo só conta como lido se **todos** os membros foram lidos; o texto completo ao
abrir não marca como lida; tratada por estagiária continua não lida para advogados; leitura incremental com
sobreposição de 2 dias e `ultima` só avança sem erro.

## 4. Pendências para decisão do proprietário
1. A e B (maior risco): trocar Hitallo/Nathanny para "tudo" agora e corrigir a regra no código?
2. C: ampliar o "Minhas" do proprietário?
3. D: impedir agrupar tipos diferentes?
4. E: confirmação do "todas lidas" e "sem prazo fatal não marca tratada"?
5. F: relê às 14h e 18h?
Nenhuma mudança de tela sem esboço e OK, conforme combinado.

## 5. Ação imediata sem código (configuração)
Em Configurações › OABs, deixar Hitallo e Nathanny em "Ver tudo" (escopo "tudo"): as 26 publicações ocultas passam a
aparecer na hora, sem alterar o sistema.

## 6. A investigar
Por que nenhuma publicação foi gravada de segunda 16/11 até terça 05h (23 % do atraso).
