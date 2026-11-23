# Prompt: atalho do iPhone para enviar extratos ao Horus

**Atenção antes de usar (ver `docs/DECISOES.md`):** hoje o envio por Atalho é de uma pessoa só. Existe **um único token** (`ENVIO_TOKEN`) e todo arquivo cai na **caixa de entrada do proprietário**, que é quem lê e confere. Se outra pessoa usar este atalho com o token atual, o extrato dela vai parar na caixa do proprietário. Para os outros usuários, é preciso primeiro ter **token individual** e **caixa de entrada por pessoa** (alteração no servidor e no app, ainda não feita). O prompt abaixo já está escrito para esse cenário: onde diz `{TOKEN_DA_PESSOA}`, vai o token individual de cada um.

---

## Prompt (copie daqui)

Você é especialista no app **Atalhos** (Shortcuts) do iPhone, em português. Escreva o passo a passo, ação por ação, para criar um atalho chamado **"Enviar extrato ao Horus"**. Use os nomes das ações como aparecem no Atalhos em português. Não invente ações que não existem.

**Objetivo.** A pessoa abre o extrato bancário (PDF, OFX ou ZIP) no app do banco, no Arquivos, no e-mail ou no WhatsApp, toca em Compartilhar › "Enviar extrato ao Horus", e o arquivo é enviado ao meu aplicativo (Horus). Depois ela abre o Horus, que lê o arquivo e monta a conferência. O atalho só envia; não lê nem interpreta o arquivo.

**Dados do servidor (use exatamente assim):**
- Endereço: `https://controle-juridico.hygorlima10.workers.dev/api/enviar`
- Método: **POST**
- Cabeçalho `Authorization`: `Bearer {TOKEN_DA_PESSOA}` (cada pessoa tem o seu token; ele fica guardado só neste atalho)
- Cabeçalho `X-Nome`: o nome do arquivo, **codificado para URL** (acentos e espaços)
- Corpo da requisição: **Arquivo** (o próprio arquivo, sem converter), com o tipo original (PDF, OFX ou ZIP)
- Resposta de sucesso: JSON com `"ok": true`. Erros: **401** (token inválido), **413** (arquivo grande demais), **429** (muitos arquivos esperando no Horus, ou muitas tentativas erradas: aguardar 15 minutos).
- Limite de tamanho: **cerca de 600 KB por arquivo**. Acima disso o servidor recusa.

**Comportamento esperado do atalho:**
1. **Aparecer na Folha de Compartilhamento** (Mostrar na folha de compartilhamento), aceitando **Arquivos** (PDF, OFX, ZIP e qualquer arquivo). Se não houver entrada, pedir para **escolher um arquivo** em Arquivos.
2. **Pergunta de importação** ("Pergunta ao importar") para o token: o texto da pergunta deve ser "Cole o seu código do Horus (Configurações › Atalho do iPhone)". O valor vai numa ação **Texto** no começo do atalho, usada no cabeçalho `Authorization`. O token **nunca** aparece em mensagens ou notificações.
3. **Repetir com cada item** da entrada (a pessoa pode compartilhar vários extratos de uma vez), com estes passos:
   - Obter o **Nome** e o **Tamanho do arquivo**.
   - **Se o tamanho for maior que 600 KB:** mostrar o alerta "O arquivo [nome] é grande demais para o atalho. Abra o Horus e use *Escolher extratos*." e **pular** este arquivo (não enviar).
   - Senão: **Obter conteúdo do URL** (POST, cabeçalhos acima, corpo = Arquivo) e guardar a resposta.
   - Ler o campo `ok` do **dicionário** da resposta. Se `ok` for verdadeiro, contar um envio bem-sucedido. Senão, ler a mensagem de erro (`error.message`) e mostrar num alerta com o nome do arquivo.
4. No final, mostrar **uma notificação**: "N extrato(s) enviado(s) ao Horus. Abra o app para conferir." Se algum falhou, dizer quais.
5. Depois do envio, **Abrir URL** `https://controle-juridico.hygorlima10.workers.dev/` para abrir o Horus (se o app estiver na tela de início, abre o app).

**Cuidados que o passo a passo deve incluir:**
- Tratar offline/sem sinal: se a requisição falhar, mostrar "Sem conexão. Tente de novo." sem perder o arquivo.
- Não enviar o mesmo arquivo duas vezes se a pessoa tocar duas vezes (o Horus ignora duplicados na conferência, mas explique para esperar a notificação).
- Dizer como **testar** (enviar um extrato pequeno e abrir o Horus), como **trocar o token** depois (Editar atalho › Ação Texto) e como **adicionar à tela de início** com ícone.
- Explicar em uma frase, para quem não é técnico, **por que o código é pessoal e não deve ser repassado**.

**Formato da resposta:** lista numerada de ações do Atalhos (nome da ação + o que preencher em cada campo), seguida de "Como testar", "Erros comuns (401, 413, 429)" e "Como compartilhar o atalho com outra pessoa sem passar o código dela".
