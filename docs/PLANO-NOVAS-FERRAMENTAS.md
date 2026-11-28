# Plano de implementação das novas ferramentas — 28/11/2026

Decisões do proprietário (28/11): **aprovadas** todas as de prioridade alta e as de qualidade; das de prioridade média, **aprovadas** "Meu dia", atualização monetária e minutas; **não aprovadas** anexos por processo (R2) e lembretes de conta por e-mail. CRM, site e demais decisões seguem em espera.
Desempenho: aprovados os itens 1 (uma checagem só), 5 (minificar) e 8 (Smart Placement); estão feitos (ver `docs/DECISOES.md`).

## 1. Ordem de implementação e por quê

| Ordem | Ferramenta | Esforço | Depende de | Por que nesta posição |
|---|---|---|---|---|
| 0 | **Q1 varredura de tela na rotina** e **Q2 datas fixas nos testes** | P | nada | Rede de proteção antes de mexer em mais telas. Q1 já existe (`auditoria-botoes`); falta rodar a cada versão. Q2 acaba com a falha que vai e volta. |
| 1 | **Saúde dos dados** (Configurações › Verificar) | P a M | `duplicidade.js` | Só leitura, baixo risco, valor imediato. Vira a rede de segurança das próximas ferramentas (confere se as novas gravações não criam duplicado ou lançamento órfão). |
| 2 | **Cobrança com um toque** | P | nada | Pequena e útil já. Cria o **registro de contatos** ("cobrado em…") que a Linha do tempo vai usar. |
| 3 | **Conferir com o extrato** | M | leitor geral (já existe) | Maior ganho financeiro; só propõe, nunca grava sozinha. Vem antes das telas novas porque usa o que já está pronto. |
| 4 | **Movimentações pelo DataJud** (piloto) | M | `src/datajud.js` | Cria um tipo novo de evento (andamento). Entra antes da Linha do tempo e do "Meu dia" para eles já nascerem com essa fonte. Começa com poucos processos. |
| 5 | **Linha do tempo do cliente** | M | 2 e 4 (fontes) | Junta publicações, andamentos, tarefas, cobranças e pagamentos. Cria o módulo comum de "eventos por cliente/pessoa". |
| 6 | **Meu dia** (por pessoa) | M | módulo de eventos da 5 | Reaproveita o módulo da Linha do tempo, filtrando por pessoa e por urgência. |
| 7 | **Atualização monetária** (INPC, IPCA, Selic) | M | índices que o app já busca | Independente; entra aqui para também poder alimentar juros e correção na cobrança (2). |
| 8 | **Minutas a partir do cadastro** (procuração, contrato de honorários, petições repetitivas) | M a G | modelos do escritório | A maior e a que depende de material seu. Vai por último, mas **os modelos podem ser enviados desde já** para eu preparar em paralelo. |
| 9 | **Q3 fotos de referência** (regressão visual) | P | telas estáveis | Depois que as telas novas estiverem prontas, para fixar a aparência de referência. |

Regra de cada etapa: esboço (quando mexe em tela), implementação, teste novo, varredura de tela e decisão registrada em `docs/DECISOES.md`. Nada é publicado sem os testes da área.

## 2. Minutas dentro do app: como funciona sem editor de texto e sem bagunçar o modelo

**Resposta curta: o app não terá editor de texto.** Ele **preenche o seu modelo** e entrega o arquivo .docx; o ajuste fino do texto continua sendo feito no Word. Isso responde às duas preocupações: não existe escrita livre no app, e portanto a formatação e o design não têm como ser bagunçados.

### Como seria
1. **Você me envia o modelo do escritório** (.docx de cada peça: procuração, contrato de honorários, as petições repetitivas) exatamente como usa hoje.
2. **Eu preparo o modelo uma única vez**: troco só os trechos variáveis por marcadores (por exemplo `{{cliente_nome}}`, `{{cliente_cpf}}`, `{{processo_numero}}`, `{{honorarios_valor}}`, `{{data_extenso}}`), sem mexer em cabeçalho, rodapé, logo, fonte, margens, numeração nem estilos. O Word costuma quebrar um marcador em pedaços invisíveis; nessa preparação eu o junto.
3. **No app**, você escolhe o modelo e o cliente/processo. Os campos vêm **preenchidos pelo cadastro**; os que faltam aparecem destacados para você completar num formulário curto (campos simples: nome, valor, forma de pagamento, objeto).
4. O app **substitui os marcadores dentro do próprio arquivo** (o .docx é um pacote de arquivos XML; troca-se só o texto dos marcadores e todo o resto fica byte a byte igual) e **baixa o .docx pronto**. Você abre no Word, ajusta o que quiser e salva. O que sai do app tem **a aparência exata do modelo**, porque é o próprio modelo.
5. **Trechos opcionais** (por exemplo uma cláusula que só entra se o pagamento for parcelado): marcador de bloco no modelo; você marca uma caixa e o parágrafo inteiro entra ou sai, já na formatação dele.
6. **Petições repetitivas**: o corpo continua sendo texto jurídico seu. Podemos montar uma **biblioteca de trechos** (o app já guarda peças aprendidas) que você escolhe e que entram nos marcadores usando o estilo do parágrafo do modelo. Texto de vários parágrafos digitado num campo vira vários parágrafos no estilo do modelo.
7. **Campos em branco** saem marcados em amarelo no documento, para não passarem despercebidos.

### Por que não um editor dentro do app
- Um editor que preserve fielmente o Word (estilos, tabelas, numeração, cabeçalho) é um projeto de meses e a causa clássica de "bagunçar o modelo".
- A ferramenta de revisão de iniciais hoje só comenta: continua assim. A peça gerada pode seguir direto para essa revisão pela ficha da Inicial.
- Se um dia fizer sentido, o máximo seria editar **só os campos** (texto simples), nunca o documento.

### Garantias e cuidados
- **Privacidade:** o preenchimento acontece no próprio navegador, com as rotinas de leitura de .docx que o app já tem; o documento não precisa passar por servidor de terceiros.
- **Fidelidade:** antes de liberar cada modelo, comparo o arquivo gerado com o original (estilos, margens, número de páginas e imagem das páginas). Você confere uma peça real de cada tipo.
- **Conferência humana sempre:** nada é protocolado nem enviado sozinho. Os modelos jurídicos precisam da sua revisão.
- **Se alguém mexer no modelo depois:** um botão "Conferir modelo" avisa se algum marcador foi apagado ou quebrado.
- **Limite honesto:** modelos muito complexos (tabelas aninhadas, controles de formulário do Word) podem exigir um ajuste manual na preparação; aviso na análise do primeiro modelo.

### O que preciso de você
1. Os .docx atuais de cada peça (pode começar pela procuração e pelo contrato de honorários).
2. Para cada um, quais dados mudam de cliente para cliente (eu proponho a lista e você corrige).
3. Os trechos opcionais e as variações que existem hoje (por exemplo "com e sem parcelamento").
