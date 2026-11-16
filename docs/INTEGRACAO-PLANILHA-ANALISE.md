# Integração com a planilha "Controle de Petições e Tarefas" (análise de 16/11/2026)

Planilha do Google Sheets da Falone Sociedade de Advogados (dona: hygorlima10@gmail.com; também editada por faloneadv00@gmail.com, nathannyfreitasadv, advhitallorenato e luizapradoc10). Lida pelo conector do Google, sem alterar nada.

## O que a planilha tem
- **Controle** (aba principal, ~15 tarefas ativas, até 1.500 linhas): Cliente · Nº do processo · Petição/tarefa · Responsável · Delegado por · Prioridade (Alta/Média/Baixa) · Status (A fazer, Em andamento, Aguardando cliente, Em revisão, Protocolada, Concluída; vazio = A fazer) · Início da contagem · Prazo (dias) · Contagem (dias úteis/corridos) · Prazo fatal manual · **Prazo fatal, Prazo interno e Dias restantes (calculados, protegidos)** · Observações.
- **Agenda** (calculada, abertas por prazo e por pessoa), **Painel** (resumo por integrante), **Despesas** (contas fixas que viram tarefa do Murilo sozinhas, com e-mail de aviso), **Feriados** (calendário do TJGO 2026 + recesso), **Listas** (integrantes: Hygor, Hitallo, Nathanny, Kamyla, Luiza, Murilo; margens do prazo interno), **Arquivo** (concluídas, coladas só como valores), **Como usar**.
- Já existe um Apps Script na planilha (menu Arquivar, e-mail de despesas).

## O que dificulta
1. **Não há identificador por linha.** Linhas são inseridas, excluídas, arquivadas. Seria preciso uma coluna oculta "ID Horus" (e "Atualizado em").
2. **Cliente quase sempre vazio**: o app teria de achar o cliente pelo número do processo.
3. **Números de processo sujos** (quebra de linha antes do número, espaços): normalizar.
4. **Duas contagens de prazo** (planilha × app): a planilha usa dias úteis + feriados da aba Feriados; o app tem regimes e o calendário do escritório. Para tarefa vinda da planilha vale o **Prazo fatal da planilha** (coluna L), mostrado como "calculado pela planilha".
5. **Responsável é um nome** (Kamyla, Luiza…), não OAB: precisa de um mapa nome da planilha → pessoa do app.
6. **Despesas viram tarefa do Murilo** na Controle: não duplicar com o módulo de despesas do app.
7. Mais de uma pessoa edita ao mesmo tempo: regra de conflito (a mudança mais recente vence).

## Caminho técnico recomendado (sem Google Cloud)
O Apps Script da planilha fala com o Worker do app (a planilha sempre inicia a conversa, nada entra pelo Google):
- **Planilha → app**: gatilho ao editar + a cada 5 min envia as linhas novas ou alteradas com um token secreto.
- **App → planilha**: a cada 1 min o script pergunta ao app "o que mudou aqui?" e aplica na linha certa (status, responsável, observações, concluída).
- Quem faz uma vez: colar o script em Extensões › Apps Script e autorizar (5 minutos). Eu escrevo o script e o lado do app.
- Alternativas descartadas por ora: "Publicar na Web" em CSV (só leitura, sem tempo real) e conta de serviço do Google Cloud (mais setup, mesmo resultado).

## Mapeamento proposto
| Planilha | App (Agenda) |
|---|---|
| Petição / tarefa | título |
| Nº do processo | processo (ligado ao cliente e à ficha do processo) |
| Responsável | responsáveis (por nome → pessoa) |
| Delegado por | criado por; avisa o responsável no celular |
| Prioridade | prioridade |
| Status | situação: A fazer, Em andamento (elaboração), Em revisão (peça pronta), Protocolada/Concluída (feito); "Aguardando cliente" vira etiqueta |
| Prazo fatal (L) | prazo fatal |
| Prazo interno (M) | trabalhar até |
| Observações | observações |
| tarefa fixa semanal | tarefa que se repete |

## Perguntas ao proprietário (a decidir antes de implementar)
1. Uma via (planilha → app) ou duas vias (status e conclusão no app também escrevem na planilha)?
2. A equipe continua digitando na planilha ou o app passa a ser o lugar de criar tarefas (a planilha vira espelho)?
3. Confirmar o mapa de nomes: quem tem usuário no app (Hitallo, Nathanny, Kamyla, Luiza, Murilo)?
4. Ignorar no app as tarefas de despesa do Murilo?
5. Pode-se acrescentar duas colunas protegidas (P: ID Horus; Q: Atualizado em) na aba Controle?
