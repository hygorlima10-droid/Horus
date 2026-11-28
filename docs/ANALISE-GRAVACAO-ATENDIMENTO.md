# Análise: gravação e transcrição do atendimento ao cliente — 29/11/2026

Pedido do proprietário: ao atender um cliente novo (ou um caso novo de cliente já existente), gravar a reunião, guardar o áudio na ficha do cliente ou da Inicial e, se possível, ter uma **transcrição ou um resumo fidedigno** para depois redigir a petição inicial, no lugar de anotar em papel ou no computador. Esta análise **não implementa nada**; só diz se vale, como fazer e o que precisa ser decidido.

## 1. Resposta curta
**Vale a pena e é viável com o que o app já tem.** A recomendação é fazer em três passos, cada um útil sozinho:
1. **Gravar (ou enviar um áudio) e guardar** na ficha do cliente e na da Inicial, com o evento aparecendo na Linha do tempo.
2. **Transcrever** automaticamente (texto completo, com o horário de cada trecho, que toca o áudio ao ser tocado).
3. **Ficha de atendimento**: um resumo estruturado (fatos, pedidos, valores, datas, documentos) em que **cada afirmação aponta para o trecho da transcrição de onde veio**, com o que não foi dito marcado como "não mencionado". Nada entra na Inicial sozinho.

O ponto sensível não é a tecnologia: é **a fidelidade** (seção 4) e o **sigilo profissional e a LGPD** (seção 7). Os dois têm solução, mas dependem de decisões suas.

## 2. Como seria no dia a dia
1. Na ficha do cliente (ou ao abrir uma Inicial nova): botão **"Atendimento"** → **Gravar** (ou **Enviar áudio** gravado em outro lugar). Cliente que ainda não está cadastrado: grava como "atendimento sem cliente" e vincula depois.
2. Durante a gravação: tela com tempo, indicador de que está gravando, pausar/retomar. O áudio sobe ao servidor **em blocos de ~1 minuto**, então uma queda do app, da bateria ou da internet não perde a reunião inteira.
3. Ao terminar: o app guarda o áudio e transcreve. Em alguns minutos a ficha mostra: **áudio (com player)**, **transcrição** (clicar numa frase toca daquele ponto) e o **resumo**.
4. A Inicial mostra um bloco **"Atendimento de origem"** com o resumo e o link para o áudio. Você consulta enquanto redige; o app **não escreve a petição** (continua sem editor de texto; o plano das minutas não muda).
5. A **Linha do tempo do cliente** ganha o evento "Atendimento (47 min)".

## 3. Transcrição: opções
Preços do catálogo da Cloudflare em novembro/2026 (a plataforma que o app já usa):

| Opção | Preço por minuto de áudio | Observações |
|---|---|---|
| **Whisper large-v3 turbo** (Workers AI, `@cf/openai/whisper-large-v3-turbo`) | US$ 0,0005 | Roda dentro da Cloudflare; a página do modelo marca **"Zero data retention"**. Não identifica quem fala. Reunião de 1 hora ≈ **US$ 0,03 (cerca de R$ 0,17)**. |
| Deepgram Nova-3 (parceiro, também pelo Workers AI) | US$ 0,0052 | Pode separar quem fala; 10 vezes mais caro e ainda barato (1 hora ≈ US$ 0,31). |
| GPT-4o Transcribe (terceiro, via AI Gateway) | US$ 0,006 | Boa precisão; dados vão a um terceiro. |
| xAI Grok STT (terceiro, via AI Gateway) | US$ 0,0017 | Separa quem fala e traz horário por palavra; dados vão a um terceiro. |
| Reconhecimento do navegador (Web Speech) | grátis | **Não recomendo**: manda o áudio a servidores do Google/Apple, não guarda o áudio e é instável. |
| Transcrever no próprio aparelho (WASM) | grátis | Privado, mas lento e menos preciso no celular. |

**Recomendação:** começar com o **Whisper turbo da Cloudflare** (barato, mesma plataforma, sem retenção). Se a falta de "quem está falando" incomodar, trocar por Nova-3 ou Grok STT mexendo só numa linha do servidor.

### 3.1 Opções gratuitas para 3 a 5 transcrições por dia (pesquisa de 29/11)
Premissa: reuniões de 30 a 60 minutos, ou seja, de **1,5 a 5 horas de áudio por dia**. Cotas de terceiros mudam; **conferir na página do fornecedor antes de contratar**.

| Opção | Cota gratuita | Cobre 3 a 5 por dia? | Observações |
|---|---|---|---|
| **Cloudflare Workers AI (Whisper turbo)** | **10.000 "neurons" por dia** no plano gratuito (46,63 por minuto de áudio) = **cerca de 214 min/dia** | **Sim para reuniões de até ~45 min** (3 de 1 h = 180 min; 5 de 1 h passam e o excedente custa centavos) | Mesma plataforma do app (nenhuma conta nova); página do modelo marca "zero data retention". Precisa ligar o recurso de IA no Worker. Limite de tamanho por chamada não confirmado: por isso o envio em blocos de poucos minutos. |
| **Groq (Whisper large-v3 turbo)** | 7.200 s de áudio por hora e **28.800 s por dia = 8 h/dia**; 20 requisições/min; arquivo de até 25 MB no plano gratuito | **Sim, com folga** | Serviço de terceiro (EUA): **conferir os termos de retenção e treinamento**. Arquivos acima de 25 MB precisam ser divididos. |
| AssemblyAI | crédito **único** de US$ 50 (cerca de 185 h) | Por 1 a 2 meses | Cota que acaba; boa para testar qualidade e separação de falantes. |
| Deepgram | crédito **único** de US$ 200 (cerca de 26.000 min = 430 h) | Por 3 a 5 meses | Separa quem fala; também acaba. |
| Speechmatics | 480 min/mês | **Não** (cerca de 8 reuniões de 1 h por mês) | |
| ElevenLabs Scribe | de 12 a 30 min/mês | **Não** | |
| Google Gemini API (plano gratuito) | gratuito, limites não confirmados | Talvez | **Não recomendo para este uso:** no plano gratuito o Google usa o conteúdo enviado para melhorar os produtos dele (no plano pago, não). Incompatível com sigilo. |
| Azure Speech (F0) | 5 h/mês, só em tempo real | **Não** | |

**Recomendação:** usar o **Whisper turbo da própria Cloudflare** como primeira opção (214 min/dia grátis, sem conta nova, sem retenção) e deixar o **Groq como reserva** para os dias em que passar da cota (8 h/dia grátis). Se a separação de quem fala for importante, testar o crédito do Deepgram. Nenhuma opção gratuita de terceiro deve ser usada sem conferir antes o que ela faz com o áudio, por causa do sigilo profissional.

## 4. "Fidedigno": o que é possível prometer
A transcrição automática **erra**. O que se vê na prática: nomes próprios e de empresas, **números** (CPF, valores, datas, número de processo), siglas, trechos com ruído ou sobreposição de vozes, e, em silêncios longos, frases inventadas ("alucinação" do reconhecimento). Em áudio limpo de uma sala o resultado costuma ser bom, mas **ninguém deve tratá-lo como ata**.

O desenho abaixo existe para que o resumo seja confiável **porque pode ser conferido**, não porque a máquina acerta sempre:
- **O áudio e a transcrição são sempre a fonte.** O resumo é derivado e vem marcado **"gerado por IA — confira"**.
- **Cada item do resumo traz o horário do trecho** (ex.: "[12:31] vendeu o carro em março de 2024") e um toque toca o áudio ali.
- **Nada de preencher lacuna.** Quando algo não foi dito, o campo diz **"não mencionado"** em vez de supor (ex.: data do fato, valor, nome completo).
- **Números, valores, datas e nomes saem destacados** para conferência.
- **Vocabulário:** o app passa ao modelo dicas (nomes de clientes cadastrados, termos jurídicos, tribunais) para errar menos os termos do seu dia a dia.
- **Nada é gravado em Inicial, Cliente ou Processo sem o seu "Usar".** Dá para editar o resumo; a transcrição original fica guardada sem alteração.
- Boas práticas para melhorar a qualidade: celular perto, ambiente sem eco, uma pessoa de cada vez, repetir em voz alta números e nomes ("então o CPF é…").

## 5. Gravar pelo app: o que o iPhone permite
- O navegador grava (microfone com permissão) e funciona no iPhone e no computador. **Limites do iPhone:** a tela precisa ficar ligada (o app pede para a tela não apagar), uma ligação telefônica interrompe a gravação e o app não grava em segundo plano. Por isso o envio em blocos e o botão de **retomar**.
- **Plano B sempre disponível:** **"Enviar áudio"** aceita arquivo gravado no app Gravador/Notas do iPhone ou em qualquer outro (m4a, mp3, wav). Para reunião longa e importante, **é o caminho mais seguro**.
- Tamanho: voz em mono compactada ocupa de **15 a 60 MB por hora**, conforme o formato.

## 6. Onde o áudio fica guardado
- O app **já usa um bucket do R2** (`ARQUIVOS`, hoje usado pelos extratos e pelo atalho do iPhone) e já tem a proteção contra estourar o limite gratuito (`r2Bloqueado`). O áudio entraria nele, em pasta própria.
- **Custo de armazenamento:** US$ 0,015 por GB-mês (os primeiros 10 GB são grátis). 100 horas de reunião ≈ 3 a 6 GB, ou seja, dentro do gratuito ou centavos.
- **Acesso:** só por rota autenticada, com a mesma política do cadastro: proprietário vê tudo; advogado vê os atendimentos dos clientes e processos em que participa; **estagiário não acessa**; familiar não tem clientes.
- **Retenção:** botão para apagar o áudio e manter a transcrição (ou apagar tudo); opção de apagar sozinho o áudio depois de X dias, se você quiser.
- **Observação:** em 28/11 você não aprovou "anexos por processo no R2". Aqui o uso é diferente (áudio de atendimento) e o bucket já existe, mas **preciso do seu ok explícito**.

## 7. Sigilo, consentimento e LGPD (pontos de decisão, não parecer)
- **Sigilo profissional** (Estatuto da Advocacia, art. 34, VII, e Código de Ética): o áudio e a transcrição são o conteúdo mais sensível do escritório. O desenho mantém tudo dentro da conta do escritório na Cloudflare, sem compartilhar com ninguém.
- **Quem processa:** a transcrição pelo Whisper roda na Cloudflare (página do modelo: sem retenção de dados). O **resumo por IA** é o ponto de atenção: se usar um modelo de terceiro (ex.: Claude por API), o texto da conversa vai a esse provedor. Duas saídas: (a) modelo aberto rodando na própria Cloudflare (Workers AI), sem terceiro, com qualidade um pouco menor; (b) Claude pela API, com melhor português jurídico e estrutura, conferindo antes os termos de retenção e de não treinamento do contrato empresarial. **Decisão sua.**
- **Consentimento:** recomendo **avisar o cliente e registrar o consentimento** (uma linha na ficha: "cliente ciente da gravação e do uso de IA para transcrição", com data), mesmo que a gravação por um dos participantes da conversa seja admitida pela jurisprudência. O app pode trazer um **texto-padrão curto** para ler ou enviar ao cliente.
- **LGPD:** o cliente é titular dos dados; áudio e transcrição podem conter dados sensíveis (saúde, por exemplo). Vale registrar a finalidade ("atendimento e elaboração de peças") e o prazo de guarda. Recomendo que a política de privacidade do escritório cite a gravação.

## 8. O resumo (a "ficha de atendimento")
Estrutura proposta, sempre com horário do trecho e "não mencionado" quando faltar:
1. **Quem:** partes e qualificação citadas (nome, profissão, estado civil, endereço) — só o que foi dito.
2. **Fatos em ordem cronológica.**
3. **O que o cliente quer** (pedidos e expectativas) e o que **não** quer.
4. **Valores, datas e prazos citados** (com marca "conferir") e **possíveis prazos a verificar** (ex.: data do fato → prescrição), sempre como alerta, nunca como cálculo definitivo.
5. **Documentos:** o que o cliente tem, o que falta, o que ficou de trazer.
6. **Honorários e combinados** (se foram tratados).
7. **Pendências e dúvidas** para a próxima conversa.
Fica ao lado da transcrição para conferência. Para a Inicial, vira a base de **Fatos** e **Pedidos** (você copia o que quiser).

## 9. Custo por atendimento de 1 hora
| Item | Custo estimado |
|---|---|
| Transcrição (Whisper turbo) | cerca de R$ 0,17 |
| Resumo por IA | de poucos centavos a cerca de R$ 1 (depende do modelo) |
| Armazenamento do áudio | centavos por mês |
| **20 atendimentos por mês** | **na faixa de R$ 5 a R$ 30** |

Pré-requisito técnico: o plano pago do Workers (US$ 5/mês) e o recurso de IA ligado ao Worker; o resumo com Claude exige uma chave de API guardada como segredo (eu não consigo cadastrá-la daqui).

## 10. Riscos e limites honestos
- **Fidelidade:** descrita na seção 4. O app reduz o risco, não o elimina; o resumo nunca substitui ouvir os trechos que importam.
- **Qualidade do áudio** decide quase tudo (sala com eco, celular longe, duas pessoas falando juntas).
- **iPhone:** limites da gravação pelo navegador (seção 5). Para reuniões longas, preferir gravar no aparelho e enviar.
- **Quem fala:** o Whisper não separa as vozes; a transcrição vem "corrida". Separar exige outro modelo (mais caro, ainda barato).
- **Dependência de serviço externo** para a transcrição; se estiver fora do ar, o áudio fica guardado e a transcrição é refeita depois com um toque.
- **Não é prova nem ata:** é apoio de memória do advogado.

## 11. Etapas sugeridas
| Etapa | O que entrega | Esforço |
|---|---|---|
| **1** | Gravar/enviar áudio, guardar no R2, player na ficha do cliente e da Inicial, evento na Linha do tempo, termo de consentimento, apagar | M |
| **2** | Transcrição automática com horários (toque na frase toca o áudio), refazer, apagar | M |
| **3** | Ficha de atendimento ancorada na transcrição, conferência lado a lado, "Usar na Inicial" (copia fatos e pedidos) | M |
| **4 (se quiser)** | Separar quem fala, vocabulário personalizado que aprende com seus clientes | M |

## 12. O que preciso que você decida
1. **R2 para áudios:** autoriza usar o bucket existente para os áudios de atendimento (com a política de acesso da seção 6)?
2. **Resumo por IA:** modelo aberto na Cloudflare (sem terceiro) ou Claude pela API (melhor qualidade; precisa de chave e de conferir os termos)?
3. **Quem fala:** é importante separar cliente e advogado na transcrição já na etapa 2, ou fica para depois?
4. **Consentimento:** quer o texto-padrão e o registro de ciência do cliente dentro da ficha?
5. **Onde primeiro:** começar pela ficha do cliente, pela Inicial, ou pelos dois (recomendo os dois, é o mesmo bloco)?
6. **Posição na fila:** entra **antes** do "Meu dia" e da atualização monetária, ou depois das minutas?
