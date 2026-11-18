# Estudo — pagamento separado (o Murilo paga a parte de cada advogado, direto)

Estado: **código e testes prontos no ramo local `estudo-pagamento-direto`, NÃO publicado** (nada disso está no ar). Só vai para produção depois do OK do proprietário.

## 1. O que foi decidido (conversa de 18/11)

1. O Murilo paga **cada advogado separadamente**, direto (ele não paga tudo a uma pessoa para repassar aos outros).
2. **O Murilo entra na divisão** (ex.: contrato de R$ 50.000: Hygor 10%, Nathanny 5%, Murilo 85%). Isso permite calcular a parte de cada advogado nas finanças e no relatório.
3. Novo **marcador "o Murilo já recebeu do cliente"** em cada parcela: só depois dele a parte do advogado entra no relatório de cobrança do Murilo.
4. Os **seletores de parcelas** do relatório continuam; as parcelas **vencidas** sem o marcador podem ser incluídas à mão, para eventualidades.
5. **Processo sem divisão** = a parte lançada já é do proprietário (ou o processo só é dele, ou ainda não há honorários fixados). Quem não está cadastrado no processo não faz parte dele.
6. A regra vale para os próximos lançamentos de processos vindos do Murilo (já com os percentuais); processos particulares têm regras próprias (continuam no modo antigo).
7. Cada advogado cobra do Murilo só a **parte dele**; o relatório do proprietário também mostra só a **parte dele**.

## 2. Como funciona (modelo)

**Divisão com modo.** `divisao: { modo: 'direto', partes: [{ oab, nome, pct, pagador? }] }`. As partes somam 100% e incluem o pagador (`pagador: true`, o Murilo), que fica com a parte dele. Sem `modo` (todos os registros que existem hoje) vale o padrão antigo: uma conta recebe tudo e repassa (`conta`). Processo "próprio" é sempre `conta`.

**A parcela do ponto de vista de cada pessoa.** Para quem está na divisão, a parcela passa a valer só a parte dela (`valor = parcela × %`) e "recebida" significa "eu já recebi a minha parte". Todo o resto do app (finanças, alertas, Recebi R$, relatório) continua igual: ele já trabalha com "a parcela da pessoa". Quem não tem parte na parcela não a vê entre os valores dele.

**Livro-caixa por pessoa e por parcela** (coleção nova `recebimentos`):
- `tipo: 'parte'` — o recebimento de UMA pessoa naquela parcela (total ou parcial, com datas). Só ela e o proprietário leem e gravam. O advogado nunca vê o que outro recebeu.
- `tipo: 'cliente'` — o marcador "o pagador recebeu do cliente". Todo advogado do processo e o proprietário leem e gravam.
- Estagiário não lê nem grava. O servidor confere no banco que a pessoa está cadastrada no registro (não dá para falsificar a lista de advogados).

**Status geral da parcela.** O cadastro (Inicial/Acordo/Alvará) continua tendo a parcela "paga/aberta". No pagamento separado ela fica **recebida quando todos os recebedores receberam** e volta a **aberta** se alguém desfaz; quem mantém isso em dia é o app do proprietário (ele vê todos os livros-caixa). A baixa de um advogado nunca altera o cadastro da parcela.

**Relatório do Murilo.**
- Cada pessoa vê só a parte dela, e o título vira "Total da sua parte a receber do Murilo".
- Parcela **com** marcador: entra sozinha. **Sem** marcador: fica em "Aguardando o Murilo receber do cliente (ainda não cobrar)"; a vencida tem caixa para incluir à mão; a que ainda não venceu mostra "ainda não venceu" e a caixa fica travada.
- Processos sem divisão e do tipo antigo: nada muda (valor lançado).
- O advogado só ganha o botão "Relatório do Murilo" se tiver parcelas em pagamento separado.
- Telefone/Pix/dia do lembrete de cada pessoa são individuais (cofre dela).

**Ficha (Inicial, Acordo, Alvará).** Na divisão aparece "Cada um recebe a sua parte direto de quem paga" × "Uma conta recebe tudo e repassa" (começa em *direto* nos processos do Murilo) e, em cada linha, "quem paga". Depois que há recebimento registrado, o modo não pode mais mudar.

**Na lista.** Cada parcela em pagamento separado mostra "sua parte R$ x (y%)", o botão do marcador ("Murilo já recebeu do cliente ✓" / "Marcar: Murilo recebeu do cliente") e, para o proprietário, "Pagamentos por pessoa" (quadro onde ele marca o recebimento de cada um quando o advogado não marcou). A caixinha de pago da lista passa a significar **o recebimento da própria pessoa**.

## 3. O que NÃO muda
- Processos já cadastrados (sem `modo`) funcionam exatamente como hoje (conta + repasse).
- Os dados do proprietário não são migrados.
- Quem não está no processo não vê nada dele.

## 4. Limites conhecidos (a decidir)
- O valor registrado como recebido é a parte calculada (parcial é aceito). Se o Murilo pagar valor diferente, usa-se baixa parcial e o saldo fica aberto.
- "Parceiro sem cadastro" na divisão aparece no cálculo, mas não tem livro-caixa (não é usuário).
- A soma de partes arredondadas pode diferir em centavos do total.
- O status geral da parcela só se atualiza quando o app do proprietário está aberto.

## 5. Testes (todos passando no ramo de estudo)
`recebimentos` (servidor: quem vê/grava, falsificação, estagiário, desfazer, backup) · `pagamento-direto` (R$ 50.000 10/5/85: parte de cada um, marcador, seletor das vencidas, relatório do proprietário, livro-caixa, status geral, tela) · `pagamento-direto-ficha` (acordo com 2 parcelas, alvará, baixa parcial/total, Bruno fora do processo, ficha com modo/pagador e trava) · `pagamento-direto-fotos` (capturas das telas). Mais os grupos `permissoes`, `principal`, `configuracao`, `notificacoes` de regressão.

## 6. Revisão por aba (18/11) — a regra está em todas as telas?

Método: li todas as telas que leem "pago/recebido/valor" direto do cadastro (159 pontos) e separei em (A) o que já usa a "parcela da pessoa" e (B) o que lia o status geral do cadastro. Resultado e correções:

| Aba / tela | Situação | O que foi feito |
|---|---|---|
| **Início** — resumo, Central de atenção, próximos recebimentos, Recebi R$ | já usava a parcela da pessoa | nada a mudar; coberto por teste |
| **Início do advogado** — "Honorários dos seus processos" | **errava**: multiplicava a parte duas vezes (5% de 5%) | corrigido (`cliente/papel.js`) |
| **Iniciais** — lista, cartão do quadro, resumo de pagamento, "pagas / próxima / vencidas", caixinhas | lia o status geral | corrigido: desenha com a visão da pessoa (`pdVista`); a caixinha marca o recebimento da pessoa |
| **Termos de acordo** — lista, parcelas, status "Recebido/Pendente" | lia o status geral | corrigido (acordo com parcelas e acordo único) |
| **Alvarás** — lista, cartão do quadro, "Recebido/Pendente", fase "Depositado" | lia o status geral | corrigido; quando todos recebem, o alvará vai a "Depositado" (e volta se alguém desfaz) |
| **Processos** — ficha, linha do tempo, chips de honorários | linha do tempo e "a receber" já usavam a parcela da pessoa; o chip mostrava o contrato inteiro | corrigido: mostra "sua parte 5% de R$ 50.000,00" |
| **Finanças** (PJ, Divisão do mês, Análises, Patrimônio, metas) e totais do Início | já usavam a parcela da pessoa / o fator da divisão | coberto por teste (parte do proprietário e da advogada) |
| **Relatório do Murilo** | — | parte da pessoa, marcador, seletor das vencidas (seção 2) |
| **Avisos no celular** | o pagamento separado não gerava aviso | novo: o proprietário é avisado quando outra pessoa recebe ou desfaz; os advogados, quando o pagador recebeu do cliente |
| **Cobrança de clientes (clientes próprios)** | não se aplica (processo "próprio" é sempre o modo antigo) | nada a mudar |
| **Backup/Restauração** | a coleção `recebimentos` entra no backup do proprietário | coberto por teste |

O que cada tela mostra de propósito: a lista continua mostrando o valor cheio da parcela do contrato (o advogado também é parte dele), mas **sempre acompanhado de "sua parte R$ x (y%)"**; todo total, KPI, alerta, relatório e finança usa só a parte da pessoa.

Testes novos desta revisão: `pagamento-direto-abas` (Início, Iniciais, Acordos, Alvarás, Processos) e `recebimentos-avisos`. Os testes do estudo agora **limpam o que criam** (antes derrubavam testes de outros grupos).
