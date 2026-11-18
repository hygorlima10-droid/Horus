# Auditoria final — 18/11/2026

Escopo: todas as abas, por papel (proprietário, advogada, estagiário) e por tamanho de tela (computador 1280 px e celular 390 px); tarefas compartilhadas; fichas de cadastro; fichas de processo e de honorários.
Método: (1) suítes de teste do app; (2) varredura automática de 192 combinações tela × papel × tamanho + 14 fichas (`test/auditoria-final.test.mjs`), medindo erros de JavaScript, pedidos recusados, rolagem lateral, emojis, fontes, botões só de texto e alvos de toque; (3) matriz de tarefas compartilhadas por papel (`test/auditoria-compartilhadas.test.mjs`); (4) leitura do código e capturas das fichas (`test/auditoria-honorarios.test.mjs`). Para repetir: `FOTOS=/tmp/auditoria node test/rodar.mjs auditoria`.

## 1. O que está bom (verificado)
- **Estabilidade:** nenhum erro de JavaScript e nenhum pedido recusado em 192 combinações; nenhuma tela com rolagem lateral; nenhum emoji; 100% das fontes são a Inter (o app inteiro segue a mesma tipografia); abas e sub-abas no mesmo padrão em todos os papéis.
- **Testes:** `permissoes` 31/31, `principal` 79/80 (a falha é o teste `delegadas`, que depende do dia da semana e também falha no código anterior), `unitarios` 5/5, `notificacoes` e `configuracao` ok.
- **Tarefas compartilhadas (matriz real, sem divergência do esperado):** tarefa pessoal só aparece para quem criou (e para o proprietário); tarefa compartilhada todos veem e **concluem**, só quem criou edita; tarefa com responsável aparece para o responsável; prazo/audiência de processo aparece para os advogados do processo (e as estagiárias participam de todos); Delegadas é de toda a equipe (todos veem e editam). A estagiária lançar sem conferência e o aviso ao proprietário e aos responsáveis já estão publicados.
- **Botões novos** do pagamento separado e as ações das listas de Iniciais, Acordos e Alvarás já no padrão de cartões (36 px).

## 2. Pontos a corrigir (propostas)
| # | Ponto | Gravidade | Proposta |
|---|---|---|---|
| A | "Quem me paga: Murilo / O próprio cliente" no cadastro do cliente (e "Murilo me paga / Cliente me paga" nos selos, filtro "Quem paga", busca e exportação) — vocabulário do tempo em que o app era só do proprietário; as Iniciais já dizem "Origem" | Alta (pedido) | Trocar por "Origem do cliente: Cliente do Murilo / Cliente próprio" em todo o app, sem mexer nos dados |
| B | A ficha "Honorários do processo" (dentro de um processo em andamento) é a ficha da **nova petição inicial** com o título trocado: pede Descrição do cliente, Nome da ação, Prioridade (Urgente / Tutela de urgência / Normal), Status (Pendente / Aguardando documentação / Aguardando cliente / Protocolado), Modelo, Prazo processual e repete o número | Alta (pedido) | Ficha enxuta: cliente + origem, situação (a receber / quitados / sem honorários), modalidade e valor, forma de pagamento, "já recebi até agora", divisão entre advogados, responsáveis e observação. Mesmo registro por baixo: cálculos, relatórios e finanças não mudam |
| C | Aviso de backup repete em todas as abas; os dois botões são texto solto de 16 px de altura no celular | Média | Botões no padrão de cartões (36 px) e aviso só no Início e em Configurações |
| D | Estagiária com "ver agendas" recebe, pela API, as tarefas pessoais de advogados (a tela as esconde no "Escritório") | Baixa | Decidir: manter (a tela já esconde) ou fazer o servidor também esconder |
| E | Teste `delegadas` depende do dia da semana (hoje falha por causa de uma tarefa fixa semanal que lota a Central de atenção); possível duplicidade de linhas idênticas na Central | Baixa | Tornar o teste independente do dia e conferir se há linha duplicada para a mesma tarefa fixa |
| F | Links "ver todos ›", "abrir o quadro ›" e semelhantes nos cartões do Início/Resumos são texto dourado com seta | Informativo | Padrão consistente em todas as abas; manter (são links de navegação, não botões de ação) |

Esboço das propostas A–C: `docs/esboco-fichas-processo-honorarios.png`.
