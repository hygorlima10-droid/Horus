# Análise: botões fora do padrão de cartão (Construção e todas as abas) — 20/11/2026

Só análise: **nada foi implementado**. Esboço: `docs/esboco-construcao-botoes.png` (antes × depois, 4 sub-abas da Construção, feito sobre a tela real com dados de exemplo).

## 1. O padrão do app (já em uso)
Botão de ação = **cartão**: 36 px de altura, cantos de 9 px, texto 12 px em negrito, com cor pela função:
- **ouro** = criar (Adicionar, Lançar, Nova…); **verde** = pagar/confirmar/registrar entrada; **vermelho** = excluir; **cinza** = todo o resto (Editar, Anexar, Cancelar, Ver…);
- **quadrado cinza de 36 px** para "⋯" e ícones; links "ver … ›" viram cartão cinza.
Já está assim na aba Finanças (20/11), no quadro das Iniciais, nas fichas e nos botões de ação do topo da Construção (Gasto, Aporte, Liberação, Devolver).

## 2. Construção — o que está solto hoje (medido na tela, 390 px)
| Sub-aba | Botões só de texto | Quantos |
|---|---|---|
| Resumo | "entradas ›", "ver entradas ›", "abrir as etapas ›" (links); linhas "Aportes da PF…", "Liberações…", "Gastos lançados e não pagos…" (linhas clicáveis, sem forma de botão) | 6 |
| Etapas | "Editar a obra", "Adicionar etapa", "Adicionar gasto" (por etapa), "Editar", "Excluir" (por etapa) | 13 |
| Gastos | "Anexar", "Editar", "Pagar", "Excluir" (por gasto) | 7 |
| Dinheiro e financiamento | "Adicionar medição", "Editar", "Excluir", "Lançar" (juros), "Registrar liberação"; "Excluir" de aportes | 10 |
| Calculadora | nenhum (já em cartão) | 0 |
No código a Construção tem **27 definições** de botão só-texto (renderObra 10, contratos de mão de obra 6+1, financiamento/medições 4, anexos 2, juros 1, caixa 1, checklist 1, clipe 1).

Proposta de cor: Adicionar/Lançar/Cadastrar = **ouro**; Pagar e Registrar liberação = **verde**; Excluir/Remover = **vermelho**; Editar, Anexar, Ver, links "›" = **cinza**.

Ponto de atenção (visível no esboço, aba Gastos): com 4 botões por gasto (Anexar, Editar, Pagar, Excluir) a linha não cabe em 390 px e o "Excluir" desce. Opções: (a) deixar quebrar em duas linhas; (b) **Editar e Excluir viram quadrados de 36 px com ícone** (lápis e lixeira) e fica tudo numa linha — recomendada.

## 3. Todas as outras abas (levantamento no código + tela)
Total no código: **139 definições de botão só-texto (`btn-text`, `md-link`) em 54 telas**. Finanças (≈ 30) já foi resolvida; sobram ≈ 110, incluindo a Construção (27):
| Aba | Telas / botões soltos | Qtd. |
|---|---|---|
| Iniciais | cartões da lista (Reabrir caso, Arquivar, Duplicar, Editar, Registrar pagamento, Cancelar), êxito (Editar êxito, Registrar pagamento do êxito), repasse (Registrar repasse) | 11 |
| Acordos | cartões da lista (Marcar recebido, Arquivar, Duplicar, Editar, Registrar pagamento, Cancelar) | 7 |
| Alvarás | cartões da lista (Avançar fase, Marcar recebido, Arquivar, Duplicar, Editar, Cancelar…) | 9 |
| Processos | Buscar dados no DataJud, Buscar no Diário Oficial, Excluir este processo; links "ver análises ›" | 3 + links |
| Início e Agenda | "Ver agenda completa ›", "● N publicação nova ›", "Abrir", "Ver por origem ▾", Hoje (semana), Excluir este item | ≈ 9 |
| Publicações | Apagar / Desfazer tudo o que aprendeu (peças), Limpar, Corrigir a data manualmente, Remover esta OAB, "OABs ›" | 5 |
| Extratos e Configurações | Trocar, Apagar, Ler de novo, Baixar (backups), alertas, "Tentar sincronizar novamente", refazer (Análises) | 7 |
| Formulários (HTML fixo) | Adicionar parcela, Cancelar, Cobrar clientes próprios, Dados de envio ▾, etc. | 17 |
| Links "abrir/ver … ›" dos Resumos (Iniciais, Acordos, Alvarás, Clientes, Processos, Agenda, Publicações) | iguais ao que já foi feito em Finanças | ≈ 15 |
Já em cartão e sem pendência: Delegadas, Arquivados, Extratos (topo), Análises (gráficos), barras de sub-abas, chips de filtro, blocos de indicadores (cartões por si), números do calendário.

## 4. O que não deve virar cartão (regra para não exagerar)
Barras de sub-abas; chips de filtro e contadores; blocos de indicador (KPI) que já são cartões; números do calendário; links dentro de texto corrido; ícone de informação "i"; setas de expandir/recolher de seção; menu lateral e barra inferior.

## 5. Proposta de implementação (só depois do seu OK)
1. **Um módulo único** (`cliente/botoes-padrao.js`) que generaliza o que já existe em Finanças para todas as abas, escolhendo a cor pela função do botão (por classe/atributo, não pelo texto).
2. **Um teste "guarda"** que percorre todas as abas e sub-abas e **falha se achar botão só de texto** fora da lista de exceções (seção 4) — é o que impede o erro de voltar.
3. Ordem: Construção → Iniciais/Acordos/Alvarás → Processos → Agenda/Início → Publicações → Extratos/Configurações/formulários.
4. Registro do padrão em `docs/DECISOES.md`.

## 6. Decisões pedidas
A. Links "ver … ›" / "abrir … ›" dos Resumos de todas as abas viram **cartão cinza** (como em Finanças)? (recomendado: sim)
B. Cores: Adicionar/Lançar = ouro; Pagar/Registrar liberação = verde; Excluir = vermelho; o resto = cinza. De acordo?
C. Linha de ações do gasto (4 botões): **quadrados com ícone** para Editar e Excluir (cabe numa linha) ou deixar quebrar em duas linhas?
D. Linhas clicáveis do Resumo da Construção ("Aportes da PF R$ 50.000", "Gastos lançados e não pagos…"): ganham o formato de cartão cinza com a seta "›" ou ficam como estão?
E. Posso criar o teste "guarda" que bloqueia botão só de texto em qualquer aba daqui para frente?
