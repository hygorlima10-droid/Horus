// Fichas: troca de textos de origem, aviso de backup em botões (só Início e Configurações), ficha ENXUTA de honorários de processo (aba Honorários e Acordo/Alvará),
// "Já recebi até agora" e honorários dentro da MESMA ficha de "Cadastrar processo".
// Servidor do grupo 'permissoes':  node test/rodar.mjs fichas-honorarios
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = 'tok-dono-0000000000000000000000000001';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
await api('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
const limpar = async () => { for (const c of ['casos', 'processos']) for (const d of (await api('GET', '/api/db/' + c)).j.docs || []) if (/FHON|0000901|0000902/.test(JSON.stringify(d.data))) await api('DELETE', '/api/db/' + c + '/' + d.id); };
await limpar();
await api('PUT', '/api/db/processos/fh1', { numero: '0000901-11.2024.8.09.0901', partes: 'FHON Fulano x Banco', orgao: 'TJGO', classe: 'Cumprimento de sentença', clienteIds: [], honorarios: 'sem', origem: 'manual', arquivado: false, criadoEm: new Date().toISOString() });
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
const p = await ctx.newPage(); p.erros = []; p.on('pageerror', (e) => p.erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) p.erros.push('console: ' + m.text()); });
await p.route(/fonts\./, (x) => x.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.prNovoHonorario, null, { timeout: 60000 }); await p.waitForTimeout(2500);
const T = (f, ...a) => p.evaluate(([src, args]) => (new Function('T', 'a', 'return (' + src + ')(T, a)'))(window.__horusTeste, args), [f.toString(), a]);
const rotulos = () => p.evaluate(() => { const raiz = document.querySelector('.overlay.show .modal') || document; return [...raiz.querySelectorAll('label.field-label, .f-sec-t, summary b')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.replace(/\s+/g, ' ').trim()); });
const fecha = () => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')));

console.log('\n— A · textos de origem');
await T((t) => t.abrirClienteEdit({})); await p.waitForTimeout(600);
let tx = await p.locator('.overlay.show .modal').first().innerText();
check(/Origem do cliente/.test(tx) && /Cliente do Murilo/.test(tx) && /Cliente próprio/.test(tx) && !/Quem me paga/i.test(tx), 'o cadastro do cliente diz "Origem do cliente: Cliente do Murilo / Cliente próprio" (sem "Quem me paga")');
await fecha();
await T((t) => t.abrirNovo()); await p.waitForTimeout(500);
tx = await p.locator('.overlay.show .modal').first().innerText(); check(/Cliente do Murilo/.test(tx) && !/Cliente Murilo\b/.test(tx), 'a Inicial diz "Cliente do Murilo"'); await fecha();
await p.evaluate(() => document.querySelector('#drawer [data-tab="clientes"]').click()); await p.waitForTimeout(700);
const filtro = await p.evaluate(() => [...document.querySelectorAll('#bodyClientes option, select option')].map((o) => o.textContent.trim()).filter((t) => /Murilo|Quem paga/.test(t)));
check(!filtro.some((t) => /Quem paga/.test(t)), 'os filtros de Clientes não têm mais "Quem paga": ' + JSON.stringify([...new Set(filtro)]));

console.log('\n— D · aviso de backup');
await p.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await p.waitForTimeout(700);
const bi = await p.evaluate(() => ({ n: document.querySelectorAll('.aviso-sis .pd-bt').length, h: [...document.querySelectorAll('.aviso-sis .pd-bt')].map((b) => Math.round(b.getBoundingClientRect().height)), fundo: [...document.querySelectorAll('.aviso-sis .pd-bt')].map((b) => getComputedStyle(b).borderTopWidth) }));
check(bi.n >= 2 && bi.h.every((h) => h >= 28) && bi.fundo.every((w) => parseFloat(w) > 0), 'no Início os botões do aviso são cartões (com borda e ≥ 28 px): ' + JSON.stringify(bi));
await p.evaluate(() => document.querySelector('#drawer [data-tab="clientes"]').click()); await p.waitForTimeout(600);
check((await p.locator('.aviso-sis:visible').count()) === 0, 'em Clientes o lembrete de backup não aparece');
await p.evaluate(() => document.querySelector('#drawer [data-tab="processos"]').click()); await p.waitForTimeout(600);
check((await p.locator('.aviso-sis:visible').count()) === 0, 'em Processos também não');
await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(600);
check((await p.locator('.aviso-sis:visible').count()) >= 1, 'em Configurações aparece');

console.log('\n— B · ficha enxuta (aba Honorários do processo)');
await T((t) => { t.prAbrir('00009011120248090901'); }); await p.waitForTimeout(700);
await T((t) => t.prNovoHonorario('caso')); await p.waitForTimeout(900);
let r = await rotulos();
const ficou = ['Modalidade de honorário', 'Valor dos honorários (R$)', 'Forma de pagamento', 'Já recebi até agora (opcional)', 'Cliente cadastrado', 'Origem'];
const saiu = ['Prioridade', 'Status', 'Nome da ação ou do procedimento', 'Descrição do cliente', 'Prazo processual (opcional)', 'Modelo de honorário (opcional)', 'Tipo', 'Número do processo ou protocolo (opcional)', 'Processo'];
check(ficou.every((x) => r.includes(x)), 'a ficha de honorários do processo mantém: ' + ficou.join(', '));
check(saiu.every((x) => !r.includes(x)), 'e tira tudo que é de petição nova (prioridade, status, nome da ação, descrição do cliente, prazo, modelo, número): sobraram ' + JSON.stringify(saiu.filter((x) => r.includes(x))));
check(/0000901-11\.2024\.8\.09\.0901/.test(await p.locator('#honCab').innerText()), 'o cabeçalho mostra o número do processo');
// 1.000 à vista, já recebi 400
await p.fill('#valorInput', '1000'); await p.fill('#dataAvistaInput', dia(10)); await p.fill('#jaRecebiValor', '400'); await p.fill('#jaRecebiData', hoje);
await p.click('#saveBtn'); await p.waitForTimeout(1500);
let c1 = (await api('GET', '/api/db/casos')).j.docs.map((d) => d.data).find((c) => c.numeroProcesso === '0000901-11.2024.8.09.0901' && c.doProcesso);
check(!!c1 && c1.valorHonorarios === 1000 && c1.formaPagamento === 'avista' && !c1.avista.pago && (c1.avista.parciais || []).length === 1 && c1.avista.parciais[0].valor === 400 && c1.avista.parciais[0].data === hoje, '"Já recebi R$ 400,00" em 1.000 à vista: vira recebimento parcial de R$ 400 na data informada: ' + JSON.stringify(c1 && c1.avista));
check(c1 && c1.status === 'pendente' && c1.prioridade === 'normal', 'os campos escondidos ficam com o padrão (status pendente, prioridade normal)');
for (const d of (await api('GET', '/api/db/casos')).j.docs) if (d.data.doProcesso && d.data.numeroProcesso === '0000901-11.2024.8.09.0901') await api('DELETE', '/api/db/casos/' + d.id);
await T((t) => { t.prAbrir('00009011120248090901'); }); await p.waitForTimeout(500);
await T((t) => t.prNovoHonorario('caso')); await p.waitForTimeout(700);
await p.fill('#valorInput', '1500'); await p.click('#segPagamento [data-value="parcelado"]'); await p.fill('#genN', '3'); await p.fill('#genPrimeira', dia(5)); await p.click('#genBtn'); await p.waitForTimeout(300);
await p.fill('#jaRecebiValor', '700'); await p.fill('#jaRecebiData', hoje); await p.click('#saveBtn'); await p.waitForTimeout(1500);
c1 = (await api('GET', '/api/db/casos')).j.docs.map((d) => d.data).find((c) => c.numeroProcesso === '0000901-11.2024.8.09.0901' && c.doProcesso);
check(!!c1 && c1.parcelas.length === 3 && c1.parcelas[0].pago === true && c1.parcelas[0].dataRecebimento === hoje && !c1.parcelas[1].pago && (c1.parcelas[1].parciais || [])[0] && c1.parcelas[1].parciais[0].valor === 200, '3 parcelas de R$ 500, já recebi R$ 700: 1ª paga e R$ 200 parcial na 2ª');
await p.evaluate(() => { });
await T((t) => t.prAbrir('00009011120248090901')); await p.waitForTimeout(400);
await T((t) => t.prNovoHonorario('caso')); await p.waitForTimeout(700);
await p.fill('#valorInput', '1000'); await p.fill('#dataAvistaInput', dia(3)); await p.fill('#jaRecebiValor', '1500'); await p.click('#saveBtn'); await p.waitForTimeout(500);
check(/passa do total/.test(await p.locator('#formError').innerText()), 'valor já recebido maior que o total é recusado com aviso');
await fecha();
for (const d of (await api('GET', '/api/db/casos')).j.docs) if (d.data.doProcesso && d.data.numeroProcesso === '0000901-11.2024.8.09.0901') await api('DELETE', '/api/db/casos/' + d.id);

console.log('\n— B · Acordo e Alvará abertos do processo');
await T((t) => t.prAbrir('00009011120248090901')); await p.waitForTimeout(400);
await T((t) => t.prNovoHonorario('acordo')); await p.waitForTimeout(800);
r = await rotulos();
check(!r.includes('Número do processo') && !r.includes('Partes') && /0000901-11/.test(await p.locator('#overlayAcordo .pr-hon-cab').innerText()), 'Acordo aberto do processo: sem número e partes (vêm do processo), com cabeçalho do processo');
await fecha(); await T((t) => t.abrirNovoAcordo()); await p.waitForTimeout(500);
r = await rotulos(); check(r.includes('Número do processo') && r.includes('Partes'), 'Acordo aberto pelo botão "+" continua completo');
await fecha();
await T((t) => t.prAbrir('00009011120248090901')); await p.waitForTimeout(400); await T((t) => t.prNovoHonorario('alvara')); await p.waitForTimeout(800);
r = await rotulos(); check(!r.some((x) => /^Número do processo/.test(x)) && !r.includes('Partes') && /0000901-11/.test(await p.locator('#overlayAlvara .pr-hon-cab').innerText()), 'Alvará aberto do processo: enxuto também');
await fecha();

console.log('\n— B · honorários dentro da ficha "Cadastrar processo"');
await T((t) => t.prAbrirNovo()); await p.waitForTimeout(800);
await p.evaluate(() => { const d = document.getElementById('pr_dadosDet'); if (d) d.open = true; });
await p.fill('#pr_numero', '0000902-22.2024.8.09.0902'); await p.fill('#pr_partes', 'FHON Beltrano x Empresa'); 
await p.evaluate(() => { const s = document.getElementById('pr_hon'); s.value = 'receber'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(700);
r = await rotulos();
check(r.includes('Modalidade de honorário') && r.includes('Valor dos honorários (R$)') && r.includes('Já recebi até agora (opcional)') && !r.includes('Prioridade') && !r.includes('Status'), 'ao escolher "a receber", os campos dos honorários aparecem na mesma ficha (sem prioridade/status)');
check((await p.locator('#overlay.show').count()) === 0, 'nenhuma segunda janela abriu');
await p.click('[data-prf="salvar"]'); await p.waitForTimeout(800);
check(/Informe o valor dos honorários/.test(await p.locator('#pr_erro').innerText()) && !(await api('GET', '/api/db/processos')).j.docs.some((d) => /0000902/.test(d.data.numero || '')), 'sem valor: mostra o aviso na própria ficha e NÃO cadastra o processo');
await p.fill('#valorInput', '2000'); await p.fill('#dataAvistaInput', dia(7));
await p.click('[data-prf="salvar"]'); await p.waitForTimeout(2200);
const proc = (await api('GET', '/api/db/processos')).j.docs.map((d) => d.data).find((d) => /0000902/.test(d.numero || ''));
const cas = (await api('GET', '/api/db/casos')).j.docs.map((d) => d.data).find((c) => /0000902/.test(c.numeroProcesso || ''));
check(!!proc && !!cas && cas.doProcesso === true && cas.valorHonorarios === 2000 && cas.formaPagamento === 'avista', 'salvou o processo e os honorários (R$ 2.000 à vista) de uma vez: processo=' + !!proc + ' honorários=' + (cas ? cas.valorHonorarios : '—'));
check((await p.locator('#overlayPr.show').count()) === 0 && (await p.locator('#overlay.show').count()) === 0, 'e fechou tudo, sem abrir outra janela');
// a ficha de Inicial continua inteira para uso normal
await T((t) => t.abrirNovo()); await p.waitForTimeout(600);
r = await rotulos(); check(['Tipo', 'Descrição do cliente', 'Nome da ação ou do procedimento', 'Modalidade de honorário', 'Advogados responsáveis'].every((x) => r.includes(x)) || ['Tipo', 'Descrição do cliente', 'Nome da ação ou do procedimento', 'Modalidade de honorário'].every((x) => r.includes(x)), 'depois disso a "Nova inicial" abre completa (tipo, descrição, nome da ação, honorários no lugar certo)');
check(await p.evaluate(() => !!document.querySelector('#overlay #segModalidade') && !!document.querySelector('#overlay #esResp_casos')), 'e os blocos de honorários e responsáveis estão de volta na ficha de Inicial');
await fecha();
// desistir: os blocos voltam
await T((t) => t.prAbrirNovo()); await p.waitForTimeout(600);
await p.evaluate(() => { const s = document.getElementById('pr_hon'); s.value = 'receber'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('[data-prf="cancelar"]').click()); await p.waitForTimeout(500);
check(await p.evaluate(() => !!document.querySelector('#overlay #segModalidade') && !!document.querySelector('#overlay #esResp_casos')), 'cancelar o cadastro devolve os blocos à ficha de Inicial');
check(p.erros.length === 0, 'sem erros de JavaScript' + p.erros.join(' | '));
await limpar(); for (const d of (await api('GET', '/api/db/processos')).j.docs) if (/0000902|0000901/.test(d.data.numero || '')) await api('DELETE', '/api/db/processos/' + d.id);
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
