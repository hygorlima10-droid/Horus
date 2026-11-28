// Linha do tempo do cliente: junta publicações, Agenda, honorários, cobranças, promessas e contatos dos processos do cliente numa tela só; filtros, "Próximos", meses,
// publicações antigas sob demanda, registrar/editar/excluir contato (guardado em cliente.notas) e "Copiar resumo".  Grupo 'telas-isoladas':  node test/rodar.mjs linha-cliente
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined });
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), agora = new Date().toISOString();
const N1 = '0000004-44.2024.8.09.0004', N2 = '0007788-90.2024.8.09.0010', N3 = '0009999-11.2025.8.09.0001', dg = (n) => n.replace(/\D/g, '');
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 390, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); await p.route(/fonts\./, (r) => r.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) {} });
await api('PUT', 'clientes/lc-c1', { nome: 'MARIA DA SILVA', telefone: '(62) 99999-0000', pagador: 'cliente', criadoEm: dia(-300) + 'T12:00:00.000Z', atualizadoEm: agora,
  notas: [{ id: 'n1', data: dia(-2) + 'T12:00:00.000Z', texto: 'Ligou perguntando do processo' }], cobrancas: [{ id: 'cb1', data: dia(-4), valor: 500, canal: 'whatsapp' }], promessas: [{ id: 'pm1', data: dia(2), obs: 'pix até sexta', cumprida: false, criadoEm: agora }] });
await api('PUT', 'clientes/lc-c2', { nome: 'OUTRO CLIENTE', pagador: 'cliente', criadoEm: agora, atualizadoEm: agora, notas: [], cobrancas: [], promessas: [] });
await api('PUT', 'processos/lc-p1', { numero: N1, partes: 'Maria da Silva x Banco X', clienteIds: ['lc-c1'], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
await api('PUT', 'processos/lc-p2', { numero: N2, partes: 'Maria da Silva x Município', clienteIds: ['lc-c1'], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
await api('PUT', 'processos/lc-p3', { numero: N3, partes: 'Outro x Empresa', clienteIds: ['lc-c2'], honorarios: 'sem', arquivado: false, origem: 'manual', criadoEm: agora });
const A = (id, o) => api('PUT', 'agenda/' + id, { situacao: 'afazer', concluido: false, avisos: [], criadoEm: agora, ...o });
await A('lc-a1', { tipo: 'audiencia', titulo: 'Audiência de instrução', processo: N1, cliente: 'MARIA DA SILVA', data: dia(5), hora: '14:00', local: '2ª Vara Cível' });
await A('lc-a2', { tipo: 'tarefa', titulo: 'Juntar procuração', processo: N1, cliente: 'MARIA DA SILVA', data: dia(-3), concluido: true, situacao: 'feito', concluidoEm: dia(-3) });
await A('lc-a3', { tipo: 'prazo', titulo: 'Contestação', processo: N2, cliente: 'MARIA DA SILVA', data: dia(-20), concluido: true, situacao: 'feito', protocoladoEm: dia(-21) });
await A('lc-a4', { tipo: 'audiencia', titulo: 'Audiência de outro cliente', processo: N3, cliente: 'OUTRO CLIENTE', data: dia(6), hora: '10:00' });
/* publicações: a semente do grupo já tem a de número 103 (a única que o proprietário enxerga) para o processo 0000004-44.2024.8.09.0004, de 10/11 */
await api('PUT', 'casos/lc-caso1', { tipo: 'inicial', cliente: 'Maria da Silva', nomeAcao: 'Ação de cobrança', numeroProcesso: N1, origem: 'proprio', prioridade: 'normal', status: 'pendente', statusDesde: agora, modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 4500, parcelas: [{ numero: 1, valor: 1500, data: dia(-30), pago: true, dataPagamento: dia(-30) }, { numero: 2, valor: 1500, data: dia(-5), pago: false }, { numero: 3, valor: 1500, data: dia(20), pago: false }], clienteIds: ['lc-c1'], criadoEm: dia(-100) + 'T12:00:00.000Z', atualizadoEm: agora });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(3500);
// ---- 1) a ficha do cliente tem o botão e o bloco antigo saiu
await p.evaluate(() => { const d = document.querySelector('#drawer [data-tab="clientes"]'); if (d) d.click(); }); await p.waitForTimeout(1000);
await p.evaluate(() => document.querySelector('[data-cli-abrir="lc-c1"]').click()); await p.waitForTimeout(1000);
let t = await p.locator('#perfilBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(await p.locator('#perfilBody [data-pf="linha"]').count() === 1 && /Linha do tempo/.test(t) && /eventos/.test(t), 'a ficha do cliente tem o botão "Linha do tempo" com a contagem de eventos');
check(await p.locator('#perfilBody details[data-sec="linha"]').count() === 0, 'o bloco antigo de 20 itens saiu da ficha');
// ---- 2) os eventos vêm de todas as fontes e só do cliente
const ev = await p.evaluate(() => window.__horusTeste.lcEventos('lc-c1').map((e) => e.tipo + '|' + e.titulo + '|' + e.data));
const tem = (re) => ev.some((x) => re.test(x));
check(tem(/^aud\|Audiência de instrução\|/) && !tem(/outro cliente/i), 'traz a audiência do cliente e NÃO a de outro cliente');
check(tem(/^tar\|Juntar procuração/) && tem(/^prazo\|Contestação/), 'traz a tarefa e o prazo dos processos do cliente');
check(tem(/^pub\|Publicação\|2026-11-10/) && !tem(/Sentença antiga/), 'traz a publicação dos últimos 90 dias e não a de 200 dias atrás (ainda)');
check(tem(/^din\|Pagamento recebido · R\$\s?1\.500,00/) && tem(/^din\|.*R\$\s?1\.500,00\|/) && tem(/^din\|Cobrança enviada/) && tem(/^din\|Promessa de pagamento: pix até sexta/), 'traz pagamento recebido, parcelas em aberto, cobrança enviada e promessa');
check(tem(/^nota\|Anotação\|/) && tem(/^marco\|Cliente cadastrado\|/) && tem(/^marco\|Inicial cadastrado/), 'traz a anotação, o cadastro do cliente e o cadastro da inicial');
// ---- 3) a tela
await p.click('#perfilBody [data-pf="linha"]'); await p.waitForTimeout(800);
t = await p.locator('#lcBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(await p.locator('#overlayLc.show').count() === 1 && /Próximos/i.test(t) && /Audiência de instrução/.test(t) && /Publicação/.test(t), 'abre a tela com "Próximos" e os eventos passados');
check(await p.locator('#lcBody .lc-mes').count() >= 3, 'os eventos passados vêm agrupados por mês');
check(await p.locator('#lcBody select[data-lc-proc] option').count() === 3, 'o filtro de processo lista os 2 processos do cliente (e "todos")');
await p.click('#lcBody [data-lc="filtro"][data-v="aud"]'); await p.waitForTimeout(300);
t = await p.locator('#lcBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Audiência de instrução/.test(t) && !/Publicação/.test(t) && !/Pagamento recebido/.test(t), 'filtro Audiências: só as audiências');
await p.click('#lcBody [data-lc="filtro"][data-v="din"]'); await p.waitForTimeout(300);
t = (await p.locator('#lcBody .lc-ev').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
check(/Pagamento recebido/.test(t) && /Atrasado/.test(t) && /Promessa de pagamento/.test(t) && !/Audiência/.test(t), 'filtro Dinheiro: pagamento, parcela atrasada, promessa');
await p.click('#lcBody [data-lc="filtro"][data-v="tudo"]');
await p.selectOption('#lcBody select[data-lc-proc]', dg(N2)); await p.waitForTimeout(300);
t = await p.locator('#lcBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Contestação/.test(t) && !/Audiência de instrução/.test(t), 'filtro por processo: só o que é daquele processo');
await p.selectOption('#lcBody select[data-lc-proc]', ''); await p.waitForTimeout(300);
// ---- 4) publicações antigas sob demanda
check(!/Sentença antiga/.test(await p.locator('#lcBody').innerText()), 'a publicação de 200 dias não aparece de início');
await p.route(/\/api\/djen\/lista\?dias=400/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pubs: [{ id: '9100002', data: dia(-200), processo: dg(N1), numero: N1, tipo: 'Sentença antiga', trecho: 'Julgo procedente o pedido.', lida: false }, { id: '103', data: '2026-11-10', processo: dg(N1), numero: N1, tipo: 'Publicação', trecho: 'Intimação 103', lida: false }] }) }));
await p.click('#lcBody [data-lc="antigas"]'); await p.waitForTimeout(1500);
t = await p.locator('#lcBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Sentença antiga/.test(t) && /400 dias/.test(t), '"Carregar publicações antigas" traz a de 200 dias e avisa que são 400 dias');
// ---- 5) registrar, editar e excluir contato
await p.click('#lcBody [data-lc="novo-contato"]'); await p.waitForTimeout(300);
await p.click('#lcBody [data-lc="canal"][data-v="whatsapp"]'); await p.waitForTimeout(200);
await p.click('#lcBody [data-lc="salvar-contato"]'); await p.waitForTimeout(300);
check(/Escreva o que foi combinado/i.test(await p.locator('#toast').innerText().catch(() => '')) || await p.locator('#lcTexto').count() === 1, 'sem o texto, não salva');
await p.fill('#lcTexto', 'Vai trazer os documentos na terça'); await p.click('#lcBody [data-lc="salvar-contato"]'); await p.waitForTimeout(1800);
let cli = (await (await api('GET', 'clientes')).json()).docs.find((d) => d.id === 'lc-c1').data;
const nv = (cli.notas || []).find((n) => n.canal === 'whatsapp');
check(nv && nv.texto === 'Vai trazer os documentos na terça' && String(nv.data).slice(0, 10) === dia(0), 'o contato é gravado em cliente.notas, com o canal e a data de hoje');
t = await p.locator('#lcBody').innerText().then((x) => x.replace(/\s+/g, ' '));
check(/Contato: WhatsApp/.test(t) && /Vai trazer os documentos/.test(t), 'o contato aparece na linha do tempo');
await p.click('#lcBody [data-lc="filtro"][data-v="contato"]'); await p.waitForTimeout(300);
await p.locator('#lcBody [data-lc="nota"]').first().click(); await p.waitForTimeout(300);
await p.fill('#lcTexto', 'Vai trazer os documentos na quarta'); await p.click('#lcBody [data-lc="salvar-contato"]'); await p.waitForTimeout(1500);
cli = (await (await api('GET', 'clientes')).json()).docs.find((d) => d.id === 'lc-c1').data;
check((cli.notas || []).some((n) => /quarta/.test(n.texto)) && (cli.notas || []).length === 2, 'editar o contato altera o mesmo registro (sem duplicar)');
// ---- 6) resumo para o cliente
await p.click('#lcBody [data-lc="resumo"]'); await p.waitForTimeout(400);
let res = await p.inputValue('#lcResTexto');
check(/^Olá, Maria!/.test(res) && res.includes(N1) && /Publicação/.test(res) && /Próxima audiência/.test(res) && /14:00/.test(res) && !/Honorários em aberto/.test(res), 'o resumo traz o nome, o processo, as publicações recentes e a próxima audiência (sem honorários por padrão)');
check(!/outro cliente/i.test(res) && !/Juntar procuração/.test(res) && !/Ligou perguntando/.test(res), 'o resumo não traz tarefa interna, anotação nem dado de outro cliente');
await p.check('#lcBody [data-lc-op="honorarios"]'); await p.waitForTimeout(300);
res = await p.inputValue('#lcResTexto');
check(/Honorários em aberto/.test(res) && /venceu em/.test(res) && /vence em/.test(res), 'marcando "Honorários em aberto", entram as parcelas vencida e a vencer');
await p.uncheck('#lcBody [data-lc-op="audiencias"]'); await p.waitForTimeout(300);
check(!/Próxima audiência/.test(await p.inputValue('#lcResTexto')), 'desmarcar "Próximas audiências" tira a linha do texto');
check(await p.locator('#lcBody [data-lc="res-wa"]').count() === 1, 'com telefone cadastrado há o botão "Abrir no WhatsApp"');
await p.click('#lcBody [data-lc="res-voltar"]'); await p.waitForTimeout(300);
// excluir o contato pela edição
await p.click('#lcBody [data-lc="filtro"][data-v="contato"]'); await p.locator('#lcBody [data-lc="nota"]').first().click(); await p.waitForTimeout(300);
await p.click('#lcBody [data-lc="excluir-contato"]'); await p.waitForTimeout(1500);
cli = (await (await api('GET', 'clientes')).json()).docs.find((d) => d.id === 'lc-c1').data;
check((cli.notas || []).length === 1, 'Excluir remove o contato');
// a ficha mostra o canal na anotação
await p.click('#lcFecha'); await p.waitForTimeout(300);
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close(); console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
