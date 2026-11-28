# Pesquisa: CRM, leads, WhatsApp integrado e site novo para o Horus (20/11/2026)

Só pesquisa e ideias — nada foi implementado. Fontes: buscas na web (blogs, páginas de fornecedores, notícias da OAB). **Limite importante:** o site da OAB, a página de preços da Meta e outros sítios oficiais não puderam ser abertos diretamente nesta sessão (rede bloqueada), então as regras da OAB e os preços do WhatsApp abaixo vêm de fontes secundárias e **precisam de conferência** antes de qualquer decisão.

## 1. Resposta curta
- **É viável?** Sim. O que o Horus já tem (clientes, processos, Iniciais em quadro, honorários, agenda, tarefas delegadas, avisos no celular, usuários e papéis) é justamente o que os sistemas jurídicos usam depois que o cliente fecha. Falta o "antes": captar, registrar e acompanhar o interessado (lead). A hospedagem atual (Cloudflare) também serve para receber formulário de site e mensagens do WhatsApp.
- **Vale a pena?** Depende de **de onde vêm os clientes hoje**. Pelos dados do Horus, boa parte do volume vem de poucos clientes recorrentes (uma cooperativa sozinha tem 36 processos). Se o negócio é majoritariamente recorrente/indicação, o ganho maior de um CRM é **relacionamento e não deixar ninguém sem resposta**, e não anúncio. Se o objetivo é abrir áreas de massa (família, consumidor, previdenciário…), o tráfego pago passa a fazer sentido — mas só com regras da OAB, LGPD e medição de custo por cliente fechado.
- **Recomendação:** ir por fases, começando pelo que não custa dinheiro nem risco ético (leads e funil dentro do Horus + site novo com formulário + botão de WhatsApp comum), e só depois ligar a API oficial do WhatsApp e, por último, tráfego pago.

## 2. As regras do jogo (o que mais pesa em advocacia)
**OAB — Provimento 205/2021** (fontes secundárias; o texto oficial não pôde ser aberto):
- Publicidade deve ser **informativa, sóbria e discreta**; é vedada a **captação de clientela** e a mercantilização.
- **Anúncios pagos são admitidos** (o Órgão Especial do CFOAB decidiu que usar o Google Ads não é infração, respeitados os limites). Em geral aceita-se anúncio de busca quando responde a uma busca do próprio interessado; **impulsionamento em redes não pode conter oferta de serviço jurídico**.
- Vedado, segundo os resumos: referência a **honorários, gratuidade ou desconto** para atrair clientes; **envio em massa / listas compradas / abordagem ativa**; autoelogio e comparação com outros advogados; promessa de resultado. Alguns resumos citam também vedação a geolocalização e remarketing — as fontes divergem, **conferir**.
- **Depoimentos e avaliações de clientes (inclui Google Meu Negócio):** não consegui confirmar o que o provimento diz. Perguntar à seccional (Comissão de Publicidade/Tribunal de Ética) antes de pedir avaliações.
- **Em revisão:** a OAB criou grupo de trabalho em jun/2025 para atualizar as regras; até onde achei, **nenhum novo provimento foi publicado**. Cuidado com artigos que chamam de "novo" o que ainda é discussão.
- **IA:** Recomendação 01/2024 do CFOAB (IA não substitui o julgamento do advogado; sigilo e consentimento); há um plano nacional e um provimento de IA em elaboração. Não achei regra específica sobre chatbot de atendimento.
**LGPD:** o tratamento de clientes costuma se apoiar em execução de contrato; **para marketing a base mais usada é o consentimento** (claro, revogável), com coleta mínima de dados e aviso de privacidade no formulário; incluir aviso de que enviar o formulário **não cria relação advogado-cliente**.
**WhatsApp (Meta):** para escrever primeiro é preciso **opt-in** e **modelo (template) aprovado**; dentro de 24 h após o contato do cliente a conversa é livre ("janela de atendimento"). APIs **não oficiais** (Baileys e similares) violam os termos e **podem banir o número**, inclusive perdendo o histórico — vendedores de API oficial exageram o risco, mas ele é real para um número de escritório.

## 3. Como os sistemas trabalham
**Padrão comum (jurídicos e de vendas):** captar (site, WhatsApp, telefone, indicação) → registrar o lead com a **origem** → funil por etapas → responder rápido → agendar a consulta → proposta/contrato/procuração → **virar cliente e caso** → pós-venda e indicação → relatórios por origem.
- **ADVBOX (BR):** CRM no sistema (funil do primeiro contato ao fechamento; o sistema jurídico entra depois), integração com WhatsApp Web (abre a conversa com um clique) e produtos separados: *Chat Jurídico* (WhatsApp profissional com CRM e triagem por IA) e *Briefing Jurídico Ria* (triagem por IA que gera resumo e liga ao sistema).
- **Astrea (BR):** envia andamentos processuais por WhatsApp direto do sistema; foco em processos e financeiro.
- **Projuris, Legal One, RD Station CRM:** CRM para advogados e gestão comercial; não achei comparação independente de funil/WhatsApp entre eles — pedir demonstração.
- **Clio Grow (EUA):** formulários de entrada (site, e-mail, SMS), funil com etapas e responsáveis, **automação de acompanhamento**, agendador de consultas, IA que responde fora do horário e pontua leads (o advogado decide), e passagem automática do lead aprovado para cliente/caso. Um escritório relatou queda de faltas à consulta de 20–25 % para menos de 5 % (depoimento do fornecedor).
- **Dado que justifica o "CRM":** em teste da Clio (EUA, 2019) 60 % dos escritórios nunca responderam ao e-mail e 27 % não atenderam/retornaram o telefone; 82 % dos consumidores dizem que a rapidez da resposta é o fator mais importante. Estudo clássico (MIT, 2007): responder em 5 minutos muda muito a chance de contato. (Dados dos EUA; ajudam a dimensionar o problema, não são do Brasil.)

## 4. Como caberia no Horus (por fases)
**Fase 0 — Leads dentro do Horus (sem custo nem risco):** cadastro de lead (nome, contato, área, origem: indicação/site/WhatsApp/telefone/evento), funil por etapas no mesmo padrão do quadro de Iniciais, tarefa de retorno automática (Delegadas/Agenda com aviso no celular), botão **"Virar cliente + Inicial"** que cria cliente e Inicial já preenchidos, e um relatório de origem × fechamento. WhatsApp apenas por **link comum** (wa.me com mensagem pré-preenchida).
**Fase 1 — Site novo:** páginas por área de atuação, equipe, contato, blog; formulário com proteção anti-robô (Turnstile) que grava o lead direto no Horus e avisa no celular; aviso LGPD e de "não cria relação advogado-cliente"; ficha no Google Meu Negócio; medição simples de origem (UTM). Pode ser site estático em Cloudflare Pages (custo baixo) com poucas funções no servidor.
**Fase 2 — WhatsApp oficial (API da Meta):** o servidor do Horus recebe as mensagens (webhook), mostra uma **caixa de entrada compartilhada** ligada ao lead/cliente, respeita a janela de 24 h e usa modelos aprovados para avisos de **utilidade** (lembrete de audiência, andamento, vencimento de parcela — combina com o DJEN e a Agenda). Opção "coexistência" permite manter o app WhatsApp Business no mesmo número (a conferir). Alternativa a construir tudo: integrar uma plataforma de chat pronta e só sincronizar leads/clientes com o Horus.
**Fase 3 — Automação cuidadosa:** resumos e triagem por IA **só para leads que escreveram primeiro**, com o advogado decidindo; sequência de acompanhamento só para quem consentiu; nada de disparo em massa.
**Fase 4 — Tráfego pago:** Google Ads de busca com anúncios sóbrios, medindo **custo por contrato assinado** (o Horus já sabe quem virou cliente e quanto pagou).

## 5. Pontos técnicos
- Cloudflare Workers/D1/Pages/Turnstile suportam tudo isso. Webhooks do WhatsApp mandam mensagens e confirmações no mesmo endereço (o servidor filtra) e devem ser validados pela assinatura da Meta; o formulário do site usa Turnstile.
- **Plano gratuito do D1:** 5 milhões de linhas lidas e 100 mil escritas por dia (e bloqueio ao estourar). O Horus já faz consultas que leem muitas linhas (ex.: lista de publicações); com mensagens e leads o consumo cresce — provavelmente será preciso o plano pago do Workers (confirmar o plano atual da conta).
- Segurança: endpoints públicos só para formulário e webhook, com limite de tentativas; chaves do WhatsApp em segredos; separar o que é público do que é sigiloso.

## 6. Custos (ordem de grandeza, de blogs — conferir na calculadora oficial da Meta)
- WhatsApp API no Brasil, por mensagem entregue: **marketing ≈ R$ 0,32; utilidade ≈ R$ 0,035; autenticação ≈ R$ 0,035; atendimento dentro de 24 h gratuito** (com limite mensal gratuito a partir de out/2026, segundo uma fonte). Há diferenças entre fontes; cobrança em reais por opt-in desde jul/2026.
- Tráfego: blog da Projuris estima **custo por lead de R$ 40–70 em Família** e **custo por cliente de R$ 600–1.200 em Cível** (sem metodologia). O CPC jurídico subiu muito.
- Site: hospedagem em Cloudflare Pages é gratuita para este porte; custos são domínio, design e conteúdo.

## 7. Benefícios e riscos
**Benefícios:** não perder interessado por demora; saber de onde vêm os clientes e quanto custa cada um; histórico único (lead → cliente → caso → honorários); menos trabalho manual; avisos de andamento aos clientes; site que trabalha 24 h.
**Riscos:** infração ética (captação, oferta de serviço, honorários, depoimentos); LGPD; banimento do WhatsApp com API não oficial; leads de baixa qualidade (formulário vira custo); site sem conteúdo não gera tráfego; manutenção e tempo da equipe; dispersão do foco do Horus.

## 8. Perguntas para decidir
1. De onde vêm hoje os clientes (indicação, convênios, clientes recorrentes, internet)? Quais áreas se quer ampliar?
2. Quem atende o WhatsApp hoje e em quanto tempo? O número é do app WhatsApp Business?
3. Qual orçamento mensal para tráfego e WhatsApp?
4. Consultar a seccional da OAB-GO sobre avaliações/depoimentos e mensagens automáticas.
5. Prioridade: começar pela Fase 0 (leads no Horus) e pelo site novo?

## Fontes consultadas
OAB: Provimento 205/2021 (página oficial, citada nos resultados), notícias do GT de revisão e da Recomendação 01/2024 de IA; Projuris, ADVBOX, Estratégia OAB, JusBrasil, Digitajus, Desmistificando (resumos do provimento e marketing jurídico); Clio (Grow, Legal Trends); Meta/Infobip/Twilio (opt-in, templates); blogs de preços do WhatsApp (SleekFlow, Wizebot, Connectweek, ChatMaxima); Hora de Codar, Clint, SocialHub (API não oficial); Cloudflare (D1 limits, Turnstile, Pages); Migalhas, RD Station, OAB-RJ (LGPD).
