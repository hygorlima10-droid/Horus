# Descrição para criar o atalho do iPhone que envia extratos ao Horus

O app Atalhos do iPhone tem **"Descrever um atalho"**: a IA do próprio iPhone monta o atalho a partir de um texto. No Horus, em Configurações › **Atalho do iPhone**, o botão **"Copiar a descrição do atalho (já com o meu código)"** copia o texto abaixo com o **código exato da própria pessoa** no lugar de `{CÓDIGO}`; basta abrir o app Atalhos, criar um atalho novo e colar em "Descrever um atalho". Cada pessoa (proprietário e advogados) tem o seu código; estagiário não usa.

## Texto (como o app copia)

> Crie um atalho chamado "Enviar extrato ao Horus". Ele deve aparecer na Folha de Compartilhamento e receber arquivos (PDF, OFX ou ZIP). Para cada arquivo recebido: use a ação "Obter conteúdo do URL" no endereço https://controle-juridico.hygorlima10.workers.dev/api/enviar com método POST, cabeçalho Authorization com o valor Bearer {CÓDIGO} (a palavra Bearer, um espaço e o código, exatamente assim, em minúsculas e com os traços), cabeçalho X-Nome com o nome do arquivo codificado para URL, e corpo da requisição do tipo Arquivo (o próprio arquivo recebido). Se o arquivo tiver mais de 25 MB, mostre um alerta com o nome dele e pule para o próximo. Se a resposta do servidor não tiver "ok" verdadeiro, mostre um alerta com o nome do arquivo e a mensagem de erro. Ao terminar, mostre apenas uma notificação: "N extrato(s) enviado(s) ao Horus." (N = quantos deram certo). Não abra nenhum app nem site.

## Conferir antes de salvar (a IA pode errar)
- O atalho aparece na Folha de Compartilhamento e aceita arquivos.
- Ação "Obter conteúdo do URL": método **POST**, corpo **Arquivo**.
- Cabeçalho **Authorization** = `Bearer` + o código da pessoa; cabeçalho **X-Nome** = nome do arquivo.
- No fim, só uma notificação.

## Servidor (referência)
`POST /api/enviar` · `Authorization: Bearer <código>` · `X-Nome` · corpo = arquivo (até 25 MB). Respostas: `ok: true`; erros 401 (código inválido), 413 (acima de 25 MB), 429 (muitos arquivos esperando ou 5 tentativas erradas: aguardar 15 minutos).
