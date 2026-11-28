# Auditoria de desempenho — 28/11/2026 (índices, conexões, lentidão e futuro da tecnologia)

Pedido do proprietário: revisar índices no banco, confirmar o gerenciamento de conexões para 7 pessoas simultâneas, entender as "travadinhas" e os segundos de espera ao carregar, e responder se a tecnologia atual vai chegar a um limite. **Nada foi alterado no app nesta auditoria** (só a ferramenta de medição `test/medir-carga.test.mjs` e este relatório).

## 0. Esclarecimento: o que o Horus é de fato
O Horus **não é Python com Supabase/SQLAlchemy**. É um **Worker da Cloudflare em JavaScript** (`src/*.js`, 4.300 linhas) com banco **D1 (SQLite)** e a tela em JavaScript puro, montada num único arquivo (`public/index.html`). O Python só aparece no `cliente/montar.py`, que cola os módulos da tela. Por isso:
- **"Pool de conexões" não se aplica.** O D1 é acessado por *binding* (sem conexão TCP, sem limite de conexões). Cada banco D1 atende uma consulta por vez (fila interna); o limite prático é `1 ÷ duração média da consulta` (consultas de 1 a 30 ms = 30 a 1.000 por segundo). Hoje o volume é de poucas por segundo.
- Pool de conexões só voltaria a existir se um dia o banco virasse Postgres (Supabase, Neon); aí o gerenciador é o **Hyperdrive** da própria Cloudflare.

## 1. Índices
**Existentes:** chave primária `(colecao, id)` e `idx_docs_colecao (colecao, atualizado)`. É uma tabela única `docs(colecao, id, dados JSON, atualizado)`.
**Número do processo, OAB, CPF/CNPJ e data da publicação não são colunas**: estão dentro do JSON (`dados`). As buscas por eles (`json_extract`) varrem a coleção inteira, mas só dentro da coleção (`colecao = ?`).

| Coleção | Linhas | Tamanho | Consulta típica | Medido no banco real |
|---|---|---|---|---|
| `_pub` (publicações) | 636 | 875 KB | lista dos últimos 90 dias por data | 1.273 linhas lidas, **27 ms** |
| `_auditoria` | 2.780 | 800 KB | histórico por processo | 2.781 linhas lidas, **11,5 ms** |
| `casos`, `processos`, `clientes`… | 30 a 253 | 30 a 200 KB | por coleção | 0,15 ms |

O banco inteiro tem **3,7 MB e 4.372 linhas** (limite do D1 pago: 10 GB). `_pub` guarda até 400 dias e `_auditoria` 365 dias, então **as duas têm teto natural**; não crescem para sempre.
**Conclusão: índice extra não resolve a lentidão de hoje** (a consulta mais lenta leva 27 ms; a espera percebida é de segundos, e vem da rede). Quando valer a pena: se `_pub` passar de ~20 mil linhas ou o painel do D1 mostrar muitas "rows read", criar índices parciais por expressão, por exemplo `CREATE INDEX idx_pub_data ON docs (json_extract(dados,'$.data')) WHERE colecao='_pub'` (a expressão tem de ser idêntica à da consulta). Cada índice acrescenta uma linha gravada por escrita, por isso não é de graça. CPF/CNPJ e números de processo dos clientes são casados em memória no aparelho (115 clientes e 253 processos), sem consulta ao banco.

## 2. De onde vem a lentidão (medido)
Medi com o app aberto como proprietário: sem simulação e simulando celular (CPU 4× mais lenta e 150 ms de espera por chamada). Ferramenta: `node test/rodar.mjs medir-carga`.

### 2.1 A abertura faz 33 pedidos diferentes (43 a 46 no total)
Repetidos na abertura: `/api/djen/estado` ×4, `/api/eu` ×3, `casos` ×2, `config` ×2, `planilha/ligada` ×2, `ler/status` ×2. Cada pedido é uma execução separada do Worker, com **no mínimo 2 idas ao banco** (autenticação + dado).
O banco fica nos **EUA (Newark, ENAM)** e a leitura em réplica está desligada. Para quem está em Goiás, cada ida ao banco custa na ordem de **120 a 150 ms** (estimativa pela distância; não medi de dentro do Brasil). Um pedido leva então ~0,3 s só em espera, e um **salvamento passa de 6 idas** (lê o mesmo documento 3 a 4 vezes, grava, lê usuários para avisar): **~0,8 a 1,2 s por gravação**.

### 2.2 O app consulta o servidor sem parar, mesmo parado
Em repouso, com a aba aberta: **56 pedidos em 70 segundos** (11 coleções × um pedido a cada 15 s, `?resumo=1`). São ~660 por hora por aparelho; com 7 pessoas e o app aberto o dia todo, **~150 mil pedidos ao Worker por dia** e **~4 milhões de linhas lidas por dia** só para checar "mudou alguma coisa?".
- Se a conta Cloudflare estiver no plano **gratuito** (100 mil pedidos/dia; 5 milhões de linhas/dia, **limite imposto desde 01/09/2026**), isso já está no teto. **Confirmar o plano (Workers Pago).**
- Quando alguém altera algo, **todos os outros aparelhos baixam a coleção inteira de novo** e redesenham a tela inteira. É uma das fontes prováveis das "travadinhas".

### 2.3 Publicações: o maior download
`/api/djen/lista?dias=90` devolve as publicações dos últimos 90 dias (no banco real, ~580 KB de JSON por chamada, lendo 1.273 linhas) e é chamada **duas vezes na abertura** (todas e "meus processos") e **toda vez que o aplicativo volta para a tela** (trocar de app no celular), junto com a leitura automática do Diário. É o pedido mais pesado e o mais repetido.

### 2.4 O peso do arquivo da tela
`index.html` tem **2,9 MB (755 KB comprimido)**, sem minificação, e roda inteiro na abertura. No celular simulado: tela pronta em ~2,7–2,9 s e rede quieta em ~4,4 s; **1,4 s de CPU bloqueada** em 10 tarefas longas, a maior de 600 ms (ler e executar o arquivo). Em celular antigo isso pesa mais.

### 2.5 O que está bom
Autenticação com **uma** consulta (junção sessão+usuário) e gravação do "último uso" só a cada 10 min; lista paginada de 1.000 em 1.000; checagem barata por `resumo` (só 2 números por coleção) antes de baixar; `batch()` nas gravações com registro. O desenho é simples e correto para o porte atual.

## 3. Plano de melhorias (ordem sugerida, tudo dentro do que já existe)
| # | Melhoria | Ganho esperado | Esforço | Risco |
|---|---|---|---|---|
| 1 | **Uma checagem só para todas as coleções** (um pedido `/api/db/_resumo` que devolve o número/data de todas de uma vez) | de 44 para 4 pedidos por minuto por aparelho (−90%); idem linhas lidas | P | Baixo |
| 2 | **Evitar pedidos repetidos na abertura** (juntar GETs iguais em andamento) e **não recarregar ao voltar para o app se a última leitura foi há menos de 1 min** | −10 pedidos na abertura; menos trabalho ao trocar de app | P | Baixo |
| 3 | **Publicações mais leves**: abrir com 30 dias (o resto sob demanda), enviar só os campos da lista, e recarregar só se o servidor disser que mudou | −70 a 90% do maior download; menos redesenho | M | Médio (a tela de publicações é complexa) |
| 4 | **Gravar com menos idas ao banco**: ler o documento uma vez e gravar em `batch` | de ~6 para ~3 idas por salvamento (−0,4 a −0,6 s por gravação) | M | Médio (mexe no caminho de todas as gravações; precisa dos testes de permissões) |
| 5 | **Minificar o arquivo da tela** (esbuild, já instalado com o wrangler) | 2,9 MB → ~1,6 MB; cerca de −40% de leitura/execução | P a M | Baixo (os testes pegam quebra) |
| 6 | **Abertura em um pedido só** (`/api/boot` com `eu`, configurações e coleções juntos, consultas em paralelo) | 33 pedidos → ~5; abertura bem mais curta | M | Médio |
| 7 | **Cache do aplicativo no aparelho** (service worker): reabrir sem baixar os 755 KB | reabertura quase instantânea | M | Médio (atualização de versão) |
| 8 | **Smart Placement** (Worker perto do banco): uma linha em `wrangler.jsonc` | reduz o custo das gravações com muitas idas | P | **Cuidado**: com `run_worker_first = true`, a documentação avisa que o arquivo da tela também passa pelo Worker posicionado nos EUA e pode ficar mais lento. Só depois de 4 e 6, medindo; reversível |

**Não recomendado agora:** réplicas de leitura do D1 (as regiões são América do Norte, Europa, Ásia e Oceania; **não há América do Sul**, então não ficam mais perto de Goiás que o banco atual); trocar de banco ou de linguagem.

Ganho combinado estimado de 1 a 6: abertura de ~3 s para ~1,5 s no celular, gravação de ~1 s para ~0,5 s, e **−90% do tráfego em repouso**.

## 4. A dúvida: o código vai chegar a um limite?
- **Python não é o gargalo, porque não é Python.** O servidor é JavaScript no Cloudflare Workers; reescrever em outra linguagem não resolveria nada do que foi medido (rede, número de idas ao banco, tamanho do arquivo e leitura repetida).
- **Folga enorme hoje:** 3,7 MB de dados de 10 GB; 4,3 mil linhas; 7 usuários. Mesmo 100× mais dados cabe sem trocar nada.
- **Onde o desenho começaria a doer:** o aparelho guarda cada coleção inteira na memória e baixa tudo de novo quando muda. Funciona bem até **alguns milhares de registros por coleção** (hoje: processos 253, clientes 115, publicações 636). Passando de 5 a 10 mil por coleção, o passo é **sincronizar só o que mudou** (usando a coluna `atualizado`, que já tem índice) e paginar nas telas. É evolução do que existe, não reescrita.
- **Quando pensar em outro modelo:** só com **dezenas de usuários**, **vários escritórios** na mesma plataforma ou relatórios que cruzem muitas tabelas. Aí o caminho natural é manter Workers e a tela e **trocar o banco para Postgres (Supabase/Neon) via Hyperdrive**, que traz o pool de conexões. Nada disso é necessário agora.
- **Proteções que já existem:** cópia diária (`_backups`), Time Travel do D1 (30 dias no plano pago, 7 no gratuito), lixeira de 30 dias, registro de alterações por 1 ano, bloqueio por tentativas no login. **Acrescentaria:** alerta de erros e de uso (Workers Observability já está ligado: configurar notificação de limite), verificação de robô (Turnstile) no login, e um teste de carga/medição (`medir-carga`) para acompanhar a cada versão.

## 5. Ferramenta nova
`test/medir-carga.test.mjs` (grupo `telas-isoladas`): conta pedidos na abertura, ao trocar de aba e em repouso, mede tamanho, tarefas longas e o tempo até a tela ficar pronta, com e sem simulação de celular. Falha se a abertura passar de 40 pedidos (hoje 43 a 46: acusa o problema 2.1 até as melhorias 2 e 6 entrarem; ajuste com LIMITE_ABERTURA).
