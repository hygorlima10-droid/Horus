# Estudo: enviar a petição da Inicial para correção (23/11/2026)

Só estudo e esboço; nada foi alterado no app. Esboço: `docs/esboco-iniciais-peticao-correcao.png`.

## 1. Como o Horus guarda arquivos hoje (e os limites)
- **Não existe guarda de arquivos.** Tudo é texto (JSON) numa tabela única do banco D1 (`docs`: coleção, id, dados).
- Só dois lugares guardam bytes de arquivo dentro do banco: a **caixa do "Compartilhar" do iPhone** (`_recebidos`, em base64, temporária, **máximo ≈ 600 KB por arquivo**, até 40 esperando) e os **backups semanais** (`_backups`, compactados e cortados em partes de 700 KB).
- O app lê PDF e foto no navegador (para extratos e "Ler documento") e **não guarda** o arquivo.
- **Limites reais:**
  - Cada registro do app: **900 KB** (trava do código, `MAX_DOC`). Um arquivo em base64 cresce 33%, então cabe **≈ 650 KB** de arquivo por registro.
  - D1 por linha/texto: **2 MB** (limite da Cloudflare, não muda).
  - Banco inteiro: 10 GB (plano pago) ou **500 MB** (plano gratuito). O banco hoje tem **3 MB**.
  - Envio ao servidor: 100 MB por requisição (plano gratuito/Pro) — não é o gargalo.
  - **R2 (armazenamento de arquivos da Cloudflare) não está ativado** na conta (a Cloudflare responde "Please enable R2 through the Cloudflare Dashboard"). Faixa gratuita do R2: 10 GB, sem cobrança de saída; ativar é feito pelo proprietário no painel.
- Plano da conta (gratuito ou pago): **não consegui confirmar daqui**. Importa porque no gratuito o D1 trava por dia (100 mil gravações) e o banco tem teto de 500 MB.

## 2. Tamanho típico de uma petição
- Inicial em Word, só texto: 40 a 200 KB. Com prints e documentos colados: 0,5 a 5 MB. PDF digitalizado: 1 a 20 MB.
- Com o limite atual (≈ 650 KB) muitas petições simples passam, mas as com imagens não. Por isso é preciso um limite maior.

## 3. Opções
**A. Guardar no próprio banco, em partes (recomendada para começar).** Um endpoint novo corta o arquivo em partes de 700 KB (como o backup já faz) e junta na hora de baixar. **Limite proposto: 10 MB por arquivo** (≈ 15 partes), só `.docx` e `.pdf`. Nada novo para contratar. Coleção começando com `_` fica **fora do backup semanal** (para não inflar as 8 cópias); então o arquivo só existe no banco (avisar na tela).
- Estimativa de espaço: 10 petições por mês × 3 versões × 300 KB ≈ 9 MB/mês ≈ 110 MB/ano (cabe até no plano gratuito por vários anos; se vierem muitos PDFs grandes, o espaço sobe rápido).
**B. R2.** Limite de 50 a 100 MB por arquivo, sem cortar em partes, melhor para volume e para PDFs grandes. Exige o proprietário **ativar o R2** no painel (pode pedir cadastro de pagamento, a conferir) e um acesso novo no Worker. Pode ser a segunda fase: o resto do desenho não muda, só onde o arquivo fica.

## 4. Desenho do fluxo
1. Ficha da Inicial → bloco "Petição" → **Enviar petição para correção** (.docx/.pdf, até 10 MB): escolhe **quem vai corrigir** (padrão: o advogado da Inicial), **prazo** (opcional) e **recado** (opcional).
2. A Inicial vai para a coluna **"A corrigir"** (coluna nova; as colunas já são editáveis em "Editar colunas") e o cartão mostra clipe, versão, quem corrige e prazo.
3. Quem corrige é lembrado: linha na **Central de atenção** do Início, selo de **pendências** (⚑), **aviso no celular** (segue as preferências de avisos da pessoa) e, se houver prazo, tarefa na **Agenda**. A pendência some quando a petição é marcada como corrigida.
4. Quem corrige **baixa**, ajusta no Word e **envia a versão corrigida** (v2, v3…; todas ficam guardadas, com autor, data e tamanho). **Marcar como corrigida** → coluna **"Pronta para protocolar"** (opcional) e dois botões: **Protocolar agora** (pede o número do processo, como hoje) ou **Delegar o protocolo** (cria tarefa em **Delegadas** para a pessoa escolhida, com o arquivo final; ao protocolar ela informa o número e a Inicial vai para "Protocolado").

## 5. Cuidados
- **Quem vê o arquivo:** quem vê a Inicial (as regras de visibilidade já existentes), mais quem enviou e quem corrige (incluindo estagiária). Download só por rota autenticada.
- **Segurança:** só `.docx` e `.pdf`, conferidos pelo começo do arquivo (assinatura), nome higienizado, `Content-Disposition: attachment`, tamanho conferido no servidor.
- **Rastro:** cada envio, correção e download entra no rastro (autor real, como nas demais telas).
- **Limpeza:** ao protocolar, oferecer "manter só a versão final" (poupa espaço); o arquivo fica 30 dias na Lixeira se for excluído.
- **Fora do escopo:** editar Word dentro do app e comentários dentro do texto (a correção é feita no Word/PDF e enviada de novo). Pré-visualização só de PDF (já há leitor), Word é baixado.

## 6. Etapas de trabalho (estimativa)
1. Servidor: endpoint de arquivos (envio em partes, download, limite, tipos, permissões) + testes.
2. Ficha da Inicial: bloco Petição, envio, versões, baixar.
3. Coluna "A corrigir" (e "Pronta para protocolar"), pendência na Central de atenção, selo, aviso e tarefa na Agenda.
4. Corrigir/devolver, protocolar ou delegar protocolo (Delegadas) + testes de ponta a ponta.

## 7. Decisões que dependem do proprietário
Limite de 10 MB (opção A) ou ativar o R2 já; só a coluna "A corrigir" ou também "Pronta para protocolar"; quem corrige por padrão; manter ou apagar versões antigas ao protocolar; se a estagiária vê as petições de outras estagiárias.

---
# Atualização (23/11/2026): R2 ativado, comentários e alerta de armazenamento
Esboço novo: `docs/esboco-iniciais-peticao-revisao-v2.png` (substitui o desenho do passo 4 da primeira versão).

## A. Reavaliação com o R2
- O R2 agora responde na conta (a Cloudflare não pede mais para ativar). **Ainda não há nenhum bucket**; será criado na hora de implementar (nome sugerido `horus-peticoes`, privado, sem endereço público) e ligado ao Worker em `wrangler.jsonc`.
- **Os arquivos saem do banco e vão para o R2** (a opção A, em partes no banco, fica descartada). No banco ficam só os dados leves: versões, comentários, histórico e a chave do arquivo no R2.
- **Limite por arquivo: proposta de 25 MB** (.docx ou .pdf). O Worker aceita até 100 MB por envio, então 25 MB sobra para petição com muitos anexos digitalizados. Dá para subir depois sem mudar o desenho.
- **Faixa gratuita do R2 (por mês):** 10 GB guardados (por mês de uso), 1 milhão de gravações (Class A) e 10 milhões de leituras (Class B); a saída de dados (baixar) é gratuita. Um envio = 1 gravação; baixar ou visualizar = 1 leitura; apagar não conta.
- **Conta de padaria:** 10 GB cabem ≈ 33 mil petições de 300 KB ou ≈ 2 mil de 5 MB. Com 10 petições por mês e 3 versões, levaria muitos anos; o espaço só vira problema com PDFs digitalizados grandes em volume.
- **Acesso e segurança:** o bucket é privado; só o Worker lê e grava. O download passa por rota autenticada que confere se a pessoa vê aquela Inicial (as mesmas regras de hoje), com `Content-Disposition: attachment`, tipo conferido pelo começo do arquivo e nome higienizado. Cada envio e download entra no rastro.
- O que **muda no backup:** o arquivo no R2 não entra nos backups semanais (que cobrem o banco). Opção futura: cópia semanal dos arquivos para um segundo bucket.

## B. Alerta de limite gratuito (a criar junto com o envio de arquivos)
- **Contagem:** como todo envio/download passa pelo Worker, o app conta no banco: bytes guardados (soma das versões), gravações do mês e leituras do mês (zera todo mês). Não depende de chave de API da Cloudflare.
- **Faixas:** **80%** (amarelo) e **95%** (vermelho) de **qualquer** dos três limites (espaço, gravações, leituras).
- **Onde aparece (só para o proprietário):** linha na **Central de atenção** do Início; tela **Configurações › Armazenamento de petições** com as três barras de uso; **aviso no celular** uma vez por faixa, a cada mês.
- **Trava preventiva (opção):** ao chegar em **100%**, o app **bloqueia só os envios novos** (baixar, ver e comentar continuam), para não gerar cobrança no R2 se houver cartão cadastrado; o proprietário pode liberar ou apagar versões antigas. A confirmar se você quer a trava ligada.
- Observação: o limite de espaço do R2 é "10 GB-mês" (média do mês); o app usa o espaço guardado no momento como medida, que é conservadora.

## C. Comentários e devolução ao autor (viável, em três níveis)
Ciclo desejado: **revisor comenta → petição volta para quem criou → autor ajusta e envia nova versão → reenvia para o mesmo revisor ou outro → repete até aprovar.**

**Nível 1 (base, recomendado já na primeira entrega):** comentários no Horus, ligados à versão: texto livre, **trecho citado** (colado ou digitado) e, para PDF, **o número da página**; cada comentário tem autor, data e estado (**aberto / resolvido**). Botões do revisor: **Devolver ao autor** (com N comentários) e **Aprovar**. O autor vê a lista, marca cada um como resolvido, envia a nova versão e **Reenvia para revisão** (escolhe o revisor; o padrão é quem revisou antes). Avisa se houver comentário aberto antes de reenviar. É simples e seguro.

**Nível 2 (segunda etapa): ler e comentar sobre o próprio texto, dentro do Horus.**
- **PDF:** o app já carrega o leitor de PDF (pdf.js); dá para mostrar a página e selecionar o trecho para comentar (âncora: página + trecho).
- **Word:** converter o .docx em texto na tela com uma biblioteca de leitura de Word (ex.: mammoth.js, carregada como o leitor de PDF hoje) e comentar selecionando o trecho. A tela mostra o **texto**, não a formatação exata do Word (margens, numeração de página); para ver o layout fiel, baixa-se o arquivo.
- Pontos a validar na implementação: se a biblioteca é aceita no navegador do iPhone e a leitura de documentos longos.

**Nível 3 (opcional): ler os comentários feitos dentro do próprio Word.** O .docx é um arquivo zip com `word/comments.xml`; o app já tem leitura de zip no navegador (usada nos extratos). Dá para **trazer para a lista do Horus** os comentários que o revisor fez no Word (autor, data, texto e trecho). Escrever comentários **dentro** do arquivo Word pelo Horus (gravar no .docx) é possível, mas bem mais trabalhoso e frágil; **não recomendo**.

**Mudanças no desenho do quadro:** além de "A corrigir" e "Pronta para protocolar", entra a coluna **"Devolvida para ajustes"** (quem espera é o autor). As colunas continuam editáveis em "Editar colunas".
**Estados da petição:** enviada → em revisão → (comentários) devolvida ao autor → nova versão reenviada → … → aprovada/pronta para protocolar → protocolada. Cada passo grava quem e quando.
**Lembretes:** em cada passo a pessoa da vez recebe a pendência (Central de atenção, selo ⚑ e aviso no celular); a pendência do outro lado some.

## D. Dados e etapas de trabalho
- **Banco:** nova coleção `peticoes` (um registro por Inicial) com versões (chave do R2, nome, tamanho, autor, data), comentários (versão, trecho, página, texto, autor, data, resolvido), estado, revisor atual e histórico; regras de acesso iguais às da Inicial. Coleção de uso `armazenamento` (contadores do mês).
- **Etapas:** (1) bucket + endpoint de arquivos (envio, download, limites, tipos, permissões, contadores) + testes; (2) bloco Petição na ficha, envio e versões; (3) colunas, estados, pendências, avisos e Agenda; (4) comentários (nível 1) e devolução/reenvio; (5) alerta e tela de armazenamento; (6) protocolar/delegar (Delegadas); (7) segunda etapa: leitura com comentário sobre o texto (nível 2) e leitura de comentários do Word (nível 3).

## E. Decisões que dependem do proprietário
Limite de 25 MB; trava em 100% do limite gratuito (sim/não); revisor padrão = advogado da Inicial; ao protocolar, manter todas as versões ou só a final; colunas novas (A corrigir, Devolvida para ajustes, Pronta para protocolar); se a estagiária vê as petições de outras estagiárias; se o nível 2 e o nível 3 entram na primeira entrega ou depois.
