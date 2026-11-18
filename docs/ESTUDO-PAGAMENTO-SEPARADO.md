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
