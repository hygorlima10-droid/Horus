# Análise: revisão de ligações (20/11/2026) — duas versões diferentes e o vai-e-volta para cadastrar clientes

Só análise e esboço (`docs/esboco-revisao-unificada.png`). Nada implementado. Dados de produção conferidos só por leitura.

## 1. Por que existem dois números (40 × 11) e por que a lista "Revisar" aparece vazia
**Causa única: o filtro "Meus" (escopo do advogado) é aplicado em umas contas e em outras não.**
1. **"11 processos importados esperam o cliente"** conta os processos importados do Diário Oficial marcados "em revisão" no banco inteiro (12 hoje, 1 deles arquivado → 11). Não olha o filtro "Meus".
2. A tela **Processos › Revisar** usa a lista de processos com o filtro "Meus" ligado: só mostra processo em que **você** é advogado. Dos 12 em revisão, só 1 tem a OAB 60456 (justamente o arquivado); os outros são do Hitallo, da Nathanny e do Murilo → a lista fica vazia ("Nada aqui") apesar do selo 11. É o que aparece na sua foto 3.
3. **"Sem cliente 40"** (tela "Revisão de ligações") confere se cada cliente existe usando a lista de clientes **filtrada por "Meus"**. Os clientes dos colegas não estão nessa lista, então todo processo deles parece "sem cliente". No banco só 12 processos estão de fato sem cliente (11 sem arquivados); ≈ 29 dos 40 são falsos (ex.: Postes Brasil Ltda, Gleiba Estefania da Silva e Cooperativa Agropecuária Central têm cliente cadastrado).
Resumo: **os números certos são ≈ 11 sem cliente de verdade**; o 40 inclui clientes escondidos pelo filtro.

## 2. Por que você volta ao começo a cada cliente
Na tela "Revisão de ligações > Sem cliente", cada linha só tem **"Abrir"** (vai para a ficha do processo) — não tem as ações. As ações (vincular ao cliente parecido, escolher outro, cadastrar cliente novo, excluir) existem **só** na outra tela (Processos › Revisar), que está vazia por causa do "Meus". Então você abre a ficha, cadastra, e o app o devolve ao começo.

## 3. Proposta
**A. Uma lista só para "processos sem cliente".** Processos › Revisar passa a ser o único lugar: mostra todo processo sem cliente de verdade (importados em revisão + cadastrados sem cliente), do escritório inteiro, **ignorando o filtro "Meus"** (revisão é do proprietário, não de um advogado), com aviso "Revisão do escritório · faltam N". Contagem do selo = contagem da lista.
**B. A tela "Revisão de ligações" fica só com o que é dos atos**: "Sem processo cadastrado" e "Cliente diferente" (a aba "Sem cliente" some, porque era o duplicado com contagem errada).
**C. No selo Pendências:** dois cartões claros — "N processos sem cliente" (abre Processos › Revisar) e "Atos com ligação a conferir" (sem processo · cliente diferente). Acabam os dois cartões parecidos.
**D. Cadastrar vários clientes em sequência, sem voltar ao começo:** nos cartões do Revisar as ações já existem (Vincular a <parecido>, Escolher cliente, Cadastrar cliente novo, Excluir). Melhorias:
 1. ao resolver um processo, o cartão some, a lista **mantém a posição**, rola para o próximo e mostra "Vinculado · faltam N";
 2. "Abrir" passa a se chamar "Abrir ficha" e, ao fechar a ficha, **volta ao mesmo ponto da lista** (hoje volta ao topo/início);
 3. "Cadastrar cliente novo" abre a ficha do cliente já com o nome da parte e, ao salvar, **vincula e passa ao próximo** automaticamente.
**E. (opcional, não recomendado agora)** modo "um por vez" (assistente com Próximo/Pular).

## 4. Impacto e cuidados
Mudança de leitura de dados e de telas existentes; sem alterar dados de produção. Testes: lista Revisar com "Meus" ligado mostra todos; contagem do selo = tamanho da lista; "Sem cliente" não conta cliente de colega; fluxo "vincular → próximo" mantém posição.

## 5. Decisões pedidas
1. A (lista única do escritório, ignorando "Meus") — de acordo?
2. B (tirar a aba "Sem cliente" da tela "Revisão de ligações") — de acordo?
3. C (dois cartões claros no selo Pendências) — de acordo?
4. D1–D3 (posição da lista, voltar ao ponto, cadastrar cliente já vincula e passa ao próximo) — de acordo?
5. E (modo um por vez) — quer agora ou deixa para depois?
