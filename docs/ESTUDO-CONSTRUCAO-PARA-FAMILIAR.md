# Estudo: acesso só à aba Construção para o seu irmão

*23/11 · só estudo e esboço, nada foi alterado no app.* Esboço: `docs/esboco-obra-irmao.png`.

## 1. Objetivo
Dar ao irmão do proprietário (não advogado, fora do escritório) um **login próprio** que abre **só a Construção**: orçamento total, gastos, etapas, resumo, calculadora de custos e o crédito (consórcio da Caixa). Sem Início, Finanças, jurídico, Extratos, Delegadas ou Central de atenção. Os dados dele **não se misturam** com os do proprietário.

## 2. Como encaixa no Horus
- **Papel novo "Obra (só Construção)"** ao lado de proprietário, advogado e estagiário, criado pela tela Usuários que já existe (convite de 48 h, uso único; a pessoa cria a própria senha).
- **Dados separados (cofre):** o mesmo mecanismo do cofre pessoal dos advogados (`colecao@<id>`). Hoje a Construção (`obraMov` e `config/obra`) é só do proprietário; o servidor passaria a guardar, para esse papel, `obraMov@<id>` e `configDono@<id>`. Ninguém lê o cofre do outro, nem o proprietário pelo app, e ele fica fora do backup, da lixeira e do registro de ações do proprietário.
- **Servidor com lista branca:** para esse papel só abrem as rotas necessárias (dados da obra dele, a própria conta, os índices da calculadora em leitura, comprovantes dele). Todo o resto responde 403, mesmo que alguém tente chamar direto.
- **Tela:** o menu mostra só Construção e Minha conta; ele já entra na Construção; o aplicativo não pede ao servidor as coleções jurídicas e financeiras (como já se faz para quem não é proprietário).

## 3. O que tirar, trocar ou manter na Construção (PF/PJ)
| Hoje (a sua) | Para ele |
|---|---|
| Aporte "Conta PF / Conta PJ / Já está na conta da obra / Terceiro" | Troca por **Recursos próprios / Já está na conta da obra / Terceiro**. O dado guardado continua `pf` por baixo (só muda o rótulo); some "PJ". |
| "Devolver sobra à PF/PJ" | **Devolver sobra para mim.** |
| Resumo "Aportes: PF · PJ · direto" e nota "− devolvido à PF/PJ" | Textos trocados (próprios · terceiros · direto). |
| Aportes automáticos "Recebido: cliente (processo)" (honorários marcados como obra) | **Tira**: ele não tem jurídico. |
| Comparação "saldo da conta da obra: extrato × Construção" (vem de Extratos) | **Tira**; no lugar, campo para ele conferir o saldo à mão. |
| Avisos da obra na Central de atenção do Início | **Muda de lugar**: card "Avisos da obra" no topo do Resumo (vencimento de gasto, checklist, medição, parcela). |
| Financiamento (juros de obra, SAC/Price, medições) | **Mantém** se ele escolher financiamento; **troca** por campos do consórcio. |
| Etapas, Gastos, contratos de mão de obra, checklist, Calculadora (SINAPI/INCC) | **Mantém** igual. |
| Comprovantes (foto/PDF) | **Mantém**, mas cada pessoa só vê os dela (hoje a caixa é só do proprietário; passa a ser por pessoa, como os extratos recebidos). |
| "Ler foto ou PDF" com IA | **Fora por ora**: o custo seria na conta do proprietário. |
| Integrações com Finanças (aporte da PJ sai da base da divisão do mês, retirada entra no caixa PF/PJ) | Sem efeito para ele (não tem esses módulos); o código fica inerte. |

## 4. Consórcio da Caixa x financiamento: são diferentes
O que a pesquisa permitiu confirmar (com fontes secundárias; **não encontrei fonte oficial da Caixa** sobre a liberação na construção):
- **Sem juros:** o custo do consórcio é **taxa de administração + fundo de reserva (+ seguro)**, diluídos nas parcelas (a taxa da Caixa aparece como "sob consulta" em comparadores). O financiamento tem juros, SAC/Price e **juros de obra** enquanto a obra recebe liberações.
- **Contemplação:** a carta de crédito só sai depois de **contemplado por sorteio ou lance**; antes disso o dinheiro da obra não existe. O financiamento tem aprovação e cronograma conhecidos.
- **Liberação para construir:** no financiamento da Caixa, o dinheiro vem **por etapas, conforme vistoria da evolução da obra**. Para o consórcio, **não confirmei** se a Caixa libera por medição; as fontes dizem só que segue as regras da administradora e exige documentação do imóvel/terreno em dia. Por isso a conclusão do proprietário ("regras parecidas") **não deve ser assumida**: confirmar no contrato/regulamento do grupo.
- **Seguro DFI** cobrado após a compra/construção (segundo o iDinheiro); obrigatoriedade varia por contrato.

Proposta para a tela "Dinheiro e crédito": escolha de **Tipo de crédito: Financiamento | Consórcio | Só recursos próprios**. No consórcio: valor da carta, prazo, parcela, taxa de administração, fundo de reserva, situação da contemplação (aguardando / contemplado em tal data, por sorteio ou lance), **liberações lançadas à mão** (como hoje) e "Parcelas do consórcio" (pagas x total, custo do crédito até agora). Sem juros de obra, SAC/Price. Medições seguem opcionais, caso o contrato dele preveja liberação por etapa.

## 5. Riscos e cuidados
- **Cópia de segurança:** o cofre fica fora do backup do proprietário; sem ajuste, os dados dele só existem no banco. Sugestão: backup automático separado desse papel + botão "Exportar" para ele.
- **Privacidade:** o proprietário não vê a obra dele pelo app (decisão a confirmar).
- **Custo:** praticamente nulo (poucos dados; calculadora usa índices que o servidor já busca).
- **Segurança:** lista branca de rotas no servidor (não só esconder na tela); testes de que ele não abre nada do proprietário e vice-versa.
- **Calculadora:** usa o custo do m² de Goiás (SINAPI). Se ele construir em outro estado, é preciso parametrizar.

## 6. Etapas sugeridas
1. **Servidor:** papel "obra", cofre `obraMov`/config, lista branca de rotas, convite com o papel novo, comprovantes por pessoa. Testes de isolamento.
2. **Tela:** menu e abertura só com Construção, textos sem PF/PJ, avisos dentro da aba.
3. **Crédito:** tipo de crédito e campos do consórcio.
4. **Backup/exportação** e conferência com o contrato dele.

## 7. Pontos a decidir
1. Contrato do consórcio dele (prazo, taxa de administração, fundo de reserva, forma de contemplação e de liberação) para montar os campos certos.
2. Cópia de segurança: automática separada + "Exportar"? (sugestão: sim)
3. O proprietário vê a obra dele? (sugestão: não)
4. Comprovantes por pessoa? (sugestão: sim) Leitura por IA? (sugestão: fora)
5. Ele constrói em Goiás (calculadora)?
6. Avisos no celular dele (vencimentos)?
