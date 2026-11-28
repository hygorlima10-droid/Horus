# Estudo: leitor geral de documentos (extrato, boleto, comprovante) sem modelo por banco

Data: 24/11/2026. Estudo e esboço (`docs/esboco-leitor-geral.png`). **Status: etapas A a E implementadas no mesmo dia** (ver `docs/DECISOES.md`).

## 1. Resposta curta

**Dá, em grande parte, e sem pedir modelo de cada banco.** Mas os documentos não são todos iguais em "quão padronizados" são, e isso muda o que dá para prometer:

| Documento | Existe padrão oficial? | Como ler sem modelo | Acerto esperado |
|---|---|---|---|
| **Boleto** (linha digitável / código de barras) | **Sim** (FEBRABAN) | Os 44 dígitos têm posições fixas e **dígitos verificadores**: banco, moeda, vencimento (fator), valor | **Quase 100%** e a própria leitura se confere (se os dígitos não fecham, o app sabe que errou) |
| **Pix "copia e cola" / QR Code** (BR Code) | **Sim** (Banco Central, padrão EMV) | Texto em blocos `código+tamanho+valor`; valor, chave, nome, cidade, txid; termina com CRC | **100%**, com CRC de conferência |
| **Extrato em OFX** | **Sim** (padrão aberto) | Tags `STMTTRN`, `TRNAMT`, `DTPOSTED`, `FITID` | **100%** (Nubank, Caixa e outros exportam OFX); o Horus já lê |
| **Extrato em PDF** | **Não** (cada banco desenha o seu) | Todos têm a mesma "anatomia": data, histórico, valor (com sinal ou C/D), saldo. Lê por estrutura e **prova com os saldos** (saldo anterior + lançamentos = saldo final) | **Alto**, e quando não fecha o app avisa em vez de errar calado |
| **Comprovante de Pix / TED / pagamento** | **Parcial** (o formato do ID "E2E" é padrão; o desenho do comprovante não) | Todo comprovante mostra os mesmos campos (valor, data e hora, quem pagou, quem recebeu, CPF/CNPJ, banco, ID da transação). Lê por **rótulos + tipo do dado** (R$, CPF/CNPJ, data, ID E2E) | **Médio a alto**; sempre com conferência antes de lançar |
| **Foto ou print** (imagem) | Não | Precisa transformar imagem em texto (OCR); dá para fazer **no próprio aparelho** (sem custo, sem enviar nada para fora) | Menor que PDF; depende da qualidade da foto |

Em uma frase: **o que é padrão oficial lê-se por regra e com prova; o que não é padrão lê-se pela estrutura comum e é conferido por contas (saldos) ou por você antes de lançar.** Não dá para garantir 100% em PDF de banco novo, mas dá para garantir que **o app nunca lance errado sem avisar**.

## 2. O que a pesquisa confirmou (fontes)

- **Boleto.** Linha digitável de 47 dígitos (cobrança) ou 48 (arrecadação: água, luz, tributos); o código de barras tem 44 posições: banco (1–3), moeda (4), dígito geral (5), **fator de vencimento (6–9)**, **valor em centavos (10–19)** e campo livre (20–44, definido por cada banco). Os campos da linha digitável levam dígitos verificadores (módulo 10 e 11). Fator de vencimento = dias desde 07/10/1997; **"0000" = sem vencimento**; **a partir de 22/02/2025 o fator voltou a 1000** (22/02/2025 = 1000; 23/02/2025 = 1001), o que cria uma ambiguidade que o leitor precisa tratar (há quem tenha lido data errada por isso). Fontes: [Circular 2.926 do Banco Central](https://www.bcb.gov.br/pre/normativos/c_circ/2000/pdf/c_circ_2926_v1_O.pdf), [layout FEBRABAN de código de barras](https://cmsarquivos.febraban.org.br/Arquivos/documentos/PDF/Layout%20-%20C%C3%B3digo%20de%20Barras%20-%20Vers%C3%A3o%208%20-%2011_05_2026.pdf), [layout Caixa/Santander](https://cms.santander.com.br/sites/WPS/documentos/arq-cobranca-barras-port-jul22/25-05-06_134319_codigo-de+barras-santander-abril-2025-v36-ptbr.pdf), [Alterdata sobre o novo fator](https://ajuda.alterdata.com.br/prosofterp/e1781-company-novo-processo-para-emissao-de-boletos-253563447.html), [ACBr](https://www.projetoacbr.com.br/forum/topic/79601-recupera%C3%A7%C3%A3o-do-vencimento-pela-leitura-da-linha-digit%C3%A1vel/).
- **Pix cobrança (copia e cola / QR).** É o **BR Code**, baseado no padrão internacional EMV (Circular 3.682/2013). Campos fixos por código (ex.: 54 valor, 59 nome, 60 cidade, 62 txid, 63 CRC). Manual oficial: [Manual de Padrões para Iniciação do Pix](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf) (versão 2.9.0 em 2025) e [Manual do BR Code](https://www.bcb.gov.br/content/estabilidadefinanceira/spb_docs/ManualBRCode.pdf).
- **Comprovante de Pix.** O "ID da transação" (E2E, `EndToEndId`) tem 32 caracteres e começa com `E`; os bancos o chamam de "ID da transação", "E2E", "EndToEndId" ou "Número do comprovante". Pelo manual do Banco Central a estrutura é `E` + ISPB do pagador (8) + data e hora (12) + sequência (11) (essa composição interna **não ficou confirmada nas buscas**; vou conferir no manual antes de usar como validação). Fontes: [Stark Infra](https://starkinfra.zendesk.com/hc/en-us/articles/42184580226587), [Manual do Pix](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).
- **OFX.** Cada lançamento fica em `STMTTRN` com `TRNAMT` (negativo = saída), `DTPOSTED` e `FITID` (identificador único, bom para não duplicar). O **Nubank exporta PDF, OFX e CSV** (Conta > Extrato > Exportar extrato) e a **Caixa oferece OFX** pelo internet banking (confirmar o nome exato do botão no site). Fontes: [documentação OFX](https://docs.fileformat.com/pt/finance/ofx), [Conta Azul](https://contaazul.com/blog/o-que-e-extrato-ofx-e-como-utilizar/), [Tecnoblog (Nubank)](https://tecnoblog.net/responde/como-tirar-o-extrato-da-conta-nubank-no-aplicativo/), [Caixa OFX](https://www.meucontadoronline.com.br/blog/como-exportar-o-extrato-ofx-da-caixa-economica/).
- **Extrato em PDF sem modelo.** Não achei padrão público; a literatura confirma que regras puras falham em tabelas sem linhas de grade e que alternativas são aprendizado de máquina ou IA. Por isso a proposta abaixo combina **estrutura + prova matemática dos saldos** em vez de um modelo por banco.
- **Foto/print.** [Tesseract.js](https://transloadit.com/devtips/integrating-ocr-in-the-browser-with-tesseract-js/) roda **no navegador** (WebAssembly), sem enviar nada para fora; o idioma português pesa cerca de 8 MB (número de um projeto brasileiro, [não confirmado em documentação oficial](https://www.tabnews.com.br/Zengkkj/crow-docs-ocr-de-alta-precisao-para-documentos-brasileiros-100-por-cento-offline-e-gratuito)). Serviços em nuvem (Google, Amazon) são melhores em casos difíceis, mas mandam o documento para fora. **Não achei dado de precisão para comprovantes**: só testando com amostras reais.
- **Open Finance** (o banco entrega os dados prontos, sem ler documento) é o caminho "ideal", mas **não encontrei fonte de que uma pessoa física consiga usar as APIs para o próprio app sem ser instituição participante**; fica fora por ora.

## 3. Como o leitor geral funcionaria (3 camadas + selo)

1. **Texto do arquivo.** PDF: o Horus já extrai texto com posição (pdf.js, `EX.pdfLinhas`). OFX: já lê. Foto/print: OCR local (só quando for imagem; baixa o motor uma vez).
2. **"Que documento é?" pelo conteúdo, não pelo banco.** Pistas: linha digitável que passa nos dígitos verificadores → boleto; texto `000201…6304XXXX` com CRC válido → Pix copia e cola; ID `E`+31 → comprovante de Pix; tabela de datas e valores com coluna de saldo → extrato; tags OFX → OFX.
3. **Campos universais.**
   - Boleto: banco (tabela de códigos do Banco Central: 104 Caixa, 260 Nubank, 341 Itaú…), valor, vencimento (tratando o fator antigo e o novo), beneficiário e CNPJ (por rótulos "Beneficiário", "Cedente", "Pagador").
   - Comprovante: valor, data e hora, **quem pagou** e **quem recebeu** (nome, CPF/CNPJ mascarado, banco, agência/conta ou chave), tipo (Pix, TED, DOC, boleto), ID da transação, autenticação. Leitura por **sinônimos de rótulo** ("Favorecido", "Recebedor", "Para", "Destino"…) mais o tipo do dado ao lado.
   - Extrato PDF: acha as colunas pela **posição dos números** (alinhamento) e pelo formato (data `dd/mm`, valor `1.234,56`, sinal `-` ou `C`/`D`); junta descrições que quebram em duas linhas; separa linhas de saldo ("saldo anterior", "saldo do dia").
4. **Prova e selo de confiança** (o que substitui o "modelo").
   - Boleto: dígitos verificadores fecham? Pix: CRC fecha? Extrato: **saldo anterior + lançamentos = saldo do dia, dia a dia** (o Horus já faz essa conta em `EX.conferir`; passa a valer para qualquer banco). Comprovante: ID no formato, valor e data coerentes.
   - **Selo verde** (tudo fechou), **amarelo** (leu, mas algo não fechou: você confere), **vermelho** (não entendi: mostro o texto e você preenche). **O app nunca lança sozinho: continua pedindo a sua conferência**, como hoje.
   - **Aprende com a sua correção**: se você corrigir uma coluna, o app guarda a "assinatura" daquele layout e acerta sozinho da próxima vez. Isso é o que dispensa mandar modelo: o modelo se forma com o uso.

## 4. O que cada documento vira no Horus (vale para todos os perfis)

Mesma regra para proprietário, advogado e familiar; só muda o destino permitido (familiar: só pessoa física; estagiário continua sem finanças). A leitura é **no aparelho** (nada sai para um serviço externo; diferente da leitura por IA).

- **Extrato** (PDF, OFX, foto): cai na **fila de conferência de extratos que já existe**, com categorias, regras que você ensinou e comparação com a obra. Hoje só lê Itaú, Sicoob e C6; passa a ler **qualquer banco** (Caixa e Nubank entram sem criar modelo).
- **Boleto**: cria (ou preenche) uma **despesa a pagar** com valor, vencimento e beneficiário, e **sugere a categoria** pelas regras já ensinadas (ex.: "CELG" → energia). O Pix copia e cola igual.
- **Comprovante de pagamento/Pix**: **dá baixa** na despesa que combina (valor, data e nome parecidos, mesma lógica de `extAcharMov`) ou lança uma despesa já paga; **guarda o arquivo como comprovante** (anexos que já existem, por pessoa). Comprovante de **recebimento** (Pix recebido) vira entrada ou baixa de honorário/parcela, conforme o perfil.
- **Mesma porta de entrada**: "Escolher extratos" vira **"Enviar documentos"**; o Atalho do iPhone e o Compartilhar usam a mesma caixa.

## 5. Limites e cuidados (sem prometer o que não dá)

- **PDF de banco novo pode não fechar de primeira.** O selo amarelo/vermelho existe para isso; não é erro silencioso.
- **Foto de baixa qualidade** (borrada, torta, com reflexo) lê pior; o leitor mostra o que entendeu e deixa corrigir.
- **Fator de vencimento** tem dois calendários possíveis (antes e depois de 22/02/2025): o leitor calcula os dois e escolhe o que cai numa janela razoável em torno de hoje; se ficar na dúvida, pergunta.
- **CPF/CNPJ mascarados** nos comprovantes (`***.123.456-**`): serve para conferir, não para identificar sozinho; o casamento usa também nome e valor.
- **Privacidade**: leitura local; o arquivo só vai ao servidor se você o anexar como comprovante (R2 do próprio perfil, já existente).
- **IA fica só como reserva** (opcional, só proprietário, como hoje), para o que o leitor geral não resolver.

## 6. Plano em etapas (cada uma testável e implantável sozinha)

- **A. Núcleo por regra** (não precisa de amostra): linha digitável (47/48) com dígitos verificadores e vencimento, BR Code com CRC, formato do ID E2E, OFX geral (tabela de bancos do Banco Central), CNPJ/CPF. Testes com **boletos e códigos sintéticos que eu gero** (os padrões são públicos).
- **B. Extrato PDF geral com prova de saldos**: colunas por alinhamento, sinal e C/D, descrição em duas linhas, saldo do dia. Preciso de **1 extrato de cada banco que vocês usam** (Caixa, Nubank, e se der um de outro banco) para **medir** (não para criar modelo).
- **C. Comprovantes por rótulos** (PDF de comprovante): preciso de **3 a 5 comprovantes reais** de bancos diferentes (Pix enviado, Pix recebido, boleto pago, TED), com dados apagados.
- **D. Foto/print com OCR local** (carrega o motor só na primeira vez).
- **E. Tela única "Enviar documentos"**, casamento com despesas, baixa e anexo, selo de confiança e aprendizado de layout.

Ordem sugerida: A → B → E (parte de extrato e boleto) → C → D. A etapa A já resolve **boleto e Pix copia e cola para todos** sem nenhuma amostra.

## 7. Decisões que preciso de você

1. Pode ser **A primeiro** (boleto e Pix copia e cola por regra) enquanto você me manda as amostras?
2. **OCR local** (baixa ~8 MB uma vez, sem custo e sem enviar o documento para fora) para fotos/prints: aprova?
3. **Boleto lido vira despesa "a pagar" automaticamente** (você confere depois) ou **só preenche o formulário** para você confirmar antes de salvar?
4. **Comprovante que combina com uma despesa**: dar baixa **com um toque de confirmação** (sugestão) ou **sozinho** quando valor, data e nome baterem?
5. Amostras (sem dados sensíveis, ou com tarja): extrato PDF da Caixa e do Nubank; 3 a 5 comprovantes de bancos diferentes.
