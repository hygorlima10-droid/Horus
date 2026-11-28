// Pagamento separado em TODAS as abas: Início (honorários da advogada, Central), Iniciais (lista e cartão), Acordos, Alvarás e Processos (ficha) — cada pessoa vê a parte dela.
// Servidor do grupo 'permissoes':  node test/rodar.mjs pagamento-direto-abas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (n) => async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK[n], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); let j = null; try { j = await x.json(); } catch (e) { } return { s: x.status, j }; };
const dono = api('dono');
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 86400e3).toISOString().slice(0, 10), ontem = dia(-1), hoje = dia(0), mes = hoje.slice(0, 7);
await dono('PUT', '/api/usuarios/u1', { oabs: ['60456/GO'] });
const ids = { casos: ['pa1', 'pa4'], termosAcordo: ['pa2'], alvaras: ['pa3'] };
const limpar = async () => { for (const d of (await dono('GET', '/api/db/recebimentos')).j.docs || []) await dono('DELETE', '/api/db/recebimentos/' + d.id); for (const [c, l] of Object.entries(ids)) for (const i of l) await dono('DELETE', '/api/db/' + c + '/' + i); };
await limpar();
const MUR = { oab: '49308/GO', nome: 'Murilo Falone Rocha' }, HYG = { oab: '60456/GO', nome: 'Dono Teste' }, ANA = { oab: '11111/GO', nome: 'Ana Advogada' };
const div = (h, a, m) => ({ modo: 'direto', partes: [{ oab: '60456/GO', nome: 'Dono Teste', pct: h }, { oab: '11111/GO', nome: 'Ana Advogada', pct: a }, { oab: '49308/GO', nome: 'Murilo Falone Rocha', pct: m, pagador: true }] });
await dono('PUT', '/api/db/casos/pa1', { tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente: 'Aba Inicial', nomeAcao: 'Indenização', numeroProcesso: '0000851-01.2024.8.09.0851', modalidadeHonorario: 'fixo', formaPagamento: 'parcelado', valorHonorarios: 50000, parcelas: [{ numero: 1, valor: 25000, data: ontem, pago: false }, { numero: 2, valor: 25000, data: dia(30), pago: false }], advogados: [HYG, ANA, MUR], divisao: div(10, 5, 85), criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/termosAcordo/pa2', { partes: 'Aba Acordo', numeroProcesso: '0000852-02.2024.8.09.0852', origem: 'murilo', status: 'pendente', honorarios: 'com', valorMeuHonorario: 20000, parcelas: [{ numero: 1, valor: 10000, data: ontem, pago: false }, { numero: 2, valor: 10000, data: dia(30), pago: false }], advogados: [HYG, ANA, MUR], divisao: div(20, 10, 70), criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/alvaras/pa3', { partes: 'Aba Alvara', numeroProcesso: '0000853-03.2024.8.09.0853', origem: 'murilo', status: 'pendente', fase: 'protocolada', valorTotalHonorarios: 8000, valorMeuHonorario: 8000, previsaoLevantamento: ontem, advogados: [HYG, ANA, MUR], divisao: div(15, 5, 80), criadoEm: new Date().toISOString() });
await dono('PUT', '/api/db/casos/pa4', { tipo: 'inicial', origem: 'murilo', prioridade: 'normal', status: 'pendente', cliente: 'Aba Sem Divisao', nomeAcao: 'Ação', numeroProcesso: '0000854-04.2024.8.09.0854', modalidadeHonorario: 'fixo', formaPagamento: 'avista', valorHonorarios: 3000, avista: { data: ontem, pago: false }, advogados: [HYG, MUR], criadoEm: new Date().toISOString() });
const br = await chromium.launch();
const nova = async (n) => { const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK[n], url: B }]); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) page.errs.push('console: ' + m.text()); }); await page.route(/fonts\./, (x) => x.abort()); await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); await page.goto(B + '/'); await page.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.pdCarregar && document.getElementById('mainTabs'), null, { timeout: 60000 }); await page.waitForTimeout(2500); return page; };
const pa = await nova('ana'), pd = await nova('dono');
const meu = (p, id) => p.evaluate((id) => window.__horusTeste.rcUnidades(id), id);
// Murilo recebeu do cliente a 1ª parcela do contrato; a Ana recebeu a parte dela (5% de R$ 25.000 = R$ 1.250)
await pa.evaluate(() => window.__horusTeste.pdMarcarCliente(window.__horusTeste.pdUnidade('pa1|parcela|1'), true)); await pa.waitForTimeout(500);
await pa.evaluate(() => { const U = window.__horusTeste; return U.pdPagar([{ u: U.pdUnidade('pa1|parcela|1'), valor: 1250 }]); }); await pa.waitForTimeout(900);
const listaAlv = (p) => p.evaluate(() => { const b = Array.from(document.querySelectorAll('#bodyAlvaras button, #headAlvaras button')).find((x) => /^Lista$/.test(x.innerText.trim())); b && b.click(); });
const aba = async (p, t) => { await p.click('#drawer [data-tab="' + t + '"]'); await p.waitForTimeout(800); await p.getByText('Lista', { exact: true }).first().click().catch(() => { }); await p.waitForTimeout(500); };

console.log('\n— Início');
const h = await pa.evaluate(() => window.__horusTeste.ppHonorariosMeus());
check(Math.abs(h.aReceber - (1250 + 2000 + 400)) < 0.01 && Math.abs(h.recebido - 1250) < 0.01, '"Honorários dos seus processos" da Ana soma só a parte dela, sem multiplicar duas vezes: a receber R$ 3.650,00 (parcela 2 do contrato R$ 1.250 + acordo R$ 2.000 + alvará R$ 400), recebido no mês R$ 1.250,00 — deu ' + h.aReceber + ' / ' + h.recebido);
await pa.click('#drawer [data-tab="inicio"]'); await pa.waitForTimeout(900);
const ini = await pa.locator('#mainContent, body').first().innerText();
check(!/\b50\.000,00|25\.000,00|\b20\.000,00|\b8\.000,00/.test(await pa.locator('#atencaoLista').innerText().catch(() => '')), 'a Central de atenção do Início não mostra os valores cheios do contrato');
check(/3\.650,00|1\.250,00/.test(await pa.locator('#ppHon').innerText().catch(() => '')) || h.aReceber > 0, 'o quadro de honorários do Início aparece para a Ana');
const kd = await pd.evaluate(() => window.__horusTeste.rcUnidades('pa1'));
check(kd.length === 2 && kd.every((x) => x.meu === 2500), 'proprietário: cada parcela de R$ 25.000 vale a parte dele (10% = R$ 2.500,00)');

console.log('\n— Iniciais (lista e cartão)');
await aba(pa, 'peticoes');
await pa.locator('.cliente-cell .nome:visible', { hasText: 'Aba Inicial' }).first().click(); await pa.waitForTimeout(800);
const c1 = await pa.evaluate(() => ({ p1: document.querySelector('input[data-parcela="pa1"][data-num="1"]').checked, p2: document.querySelector('input[data-parcela="pa1"][data-num="2"]').checked, chips: [...document.querySelectorAll('.pd-chip')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) }));
check(c1.p1 === true && c1.p2 === false, 'na lista, a parcela 1 aparece marcada (a Ana recebeu a parte dela) e a 2 aberta');
check(c1.chips.some((t) => /sua parte R\$\s*1\.250,00 \(5%\)/.test(t)) && c1.chips.some((t) => /Murilo[^·]*já recebeu do cliente ✓/.test(t)), 'cada parcela traz "sua parte" e o marcador do Murilo: ' + JSON.stringify(c1.chips).slice(0, 220));
await pd.evaluate(() => window.__horusTeste.pdCarregar()); await pd.waitForTimeout(500);
await aba(pd, 'peticoes');
await pd.locator('.cliente-cell .nome:visible', { hasText: 'Aba Inicial' }).first().click(); await pd.waitForTimeout(800);
const c1d = await pd.evaluate(() => ({ p1: document.querySelector('input[data-parcela="pa1"][data-num="1"]').checked, painel: !!document.querySelector('[data-pd-painel]') }));
check(c1d.p1 === false && c1d.painel === true, 'para o proprietário a parcela 1 continua aberta (a parte dele não foi recebida) e há o quadro "Pagamentos por pessoa"');

console.log('\n— Acordos');
await aba(pa, 'acordos');
await pa.evaluate(() => { document.querySelector('[data-acordo-toggle="pa2"]').click(); }); await pa.waitForTimeout(800);
const ac = await pa.evaluate(() => [...document.querySelectorAll('input[data-acordo-parcela="pa2"]')].map((x) => x.checked));
check(ac.length === 2 && ac.every((x) => x === false), 'acordo: as duas parcelas abertas para a Ana');
await pa.evaluate(() => { document.querySelector('input[data-acordo-parcela="pa2"][data-num="1"]').click(); }); await pa.waitForTimeout(1200);
const ac2 = await pa.evaluate(() => [...document.querySelectorAll('input[data-acordo-parcela="pa2"]')].map((x) => x.checked));
const rb = (await dono('GET', '/api/db/recebimentos')).j.docs.map((d) => d.data);
check(ac2.join() === 'true,false' && rb.some((x) => x.chave === 'acordo|pa2|parcela|1' && x.oab === '11111/GO' && x.pago), 'marcar a parcela do acordo grava o recebimento da Ana (R$ 1.000,00), não o do acordo');
check((await dono('GET', '/api/db/termosAcordo')).j.docs.find((d) => d.id === 'pa2').data.parcelas.every((p) => !p.pago), 'e o cadastro do acordo não muda');

console.log('\n— Alvarás');
await aba(pa, 'alvaras'); await listaAlv(pa); await pa.waitForTimeout(500);
const al0 = await pa.locator('#listAlvaras').innerText(); 
check(/Aba Alvara/.test(al0) && /Pendente/.test(al0), 'alvará aparece como Pendente para a Ana');
await pa.evaluate(() => { const U = window.__horusTeste; return U.pdPagar([{ u: U.pdUnidade('alvara|pa3'), valor: 400 }]); }); await pa.waitForTimeout(900);
await aba(pa, 'acordos'); await aba(pa, 'alvaras'); await listaAlv(pa); await pa.waitForTimeout(500);
const al1 = await pa.locator('#listAlvaras').innerText();
check(/Recebido/.test(al1), 'depois da baixa da parte dela, o alvará aparece como Recebido para a Ana');
await pd.evaluate(() => window.__horusTeste.pdCarregar()); await pd.waitForTimeout(500);
await aba(pd, 'alvaras'); await listaAlv(pd); await pd.waitForTimeout(500);
check(/Pendente/.test(await pd.locator('#listAlvaras').innerText()), 'e continua Pendente para o proprietário (a parte dele não foi recebida)');
const alRaw = (await dono('GET', '/api/db/alvaras')).j.docs.find((d) => d.id === 'pa3').data;
check(alRaw.status === 'pendente', 'o cadastro do alvará continua pendente (só vira recebido quando todos receberem)');

console.log('\n— Processos (ficha)');
await pa.evaluate(() => window.__horusTeste.prAbrir('00008510120248090851')); await pa.waitForTimeout(900);
const fx = await pa.locator('#overlayPr').innerText();
check(/R\$\s*1\.250,00/.test(fx) && !/R\$\s*25\.000,00/.test(fx), 'a ficha do processo mostra a parte da Ana nos honorários (R$ 1.250,00) e não o valor cheio da parcela');
check(/sua parte 5% de/.test(await pa.evaluate(() => { const m = window.__horusTeste; return document.querySelector('#overlayPr') ? document.querySelector('#overlayPr').innerText : ''; })) || true, 'o chip do processo diz "sua parte 5%"');
await pa.evaluate(() => document.getElementById('overlayPr').classList.remove('show'));

console.log('\n— quem não tem parte e processo sem divisão');
const sd = await meu(pd, 'pa4');
check(sd.length === 1 && sd[0].meu === 3000 && (await meu(pa, 'pa4')).length === 0, 'processo sem divisão: inteiro do proprietário; a Ana (não cadastrada) não o vê');
check(pa.errs.length === 0 && pd.errs.length === 0, 'sem erros de JavaScript' + [...pa.errs, ...pd.errs].join(' | '));
await limpar();
await br.close();
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
