// Contas fixas do escritório (aba Delegadas > Fixas): a conta vencida e não paga continua atrasada (sem limite de dias), o pagamento é registrado com data e valor,
// o Histórico lista o que foi pago e a conta pode ser pausada sem perder o histórico.  Use: node test/rodar.mjs delegadas-contas
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8812', SENHA = 'senha-de-teste-123';
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const r0 = await fetch(B + '/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ senha: SENHA }), headers: { 'cf-connecting-ip': '9.9.9.72' } }); const ck = r0.headers.get('set-cookie').split(';')[0];
const f = (m, p, b) => fetch(B + p, { method: m, headers: { cookie: ck, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const dia = n => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const lista = async () => (await f('GET', '/api/db/delegadas')).j.docs.map(d => ({ id: d.id, ...d.data }));
const conta = (o) => f('POST', '/api/db/delegadas', { tipo: 'fixa', valor: '', repete: 'mensal', dow: 1, data: '', avisarDias: 3, resp: '', pagas: [], criadoEm: new Date(Date.now() - 90 * 864e5).toISOString(), ...o });
const dAtras = Number(dia(-25).slice(8, 10)), cAtras = dia(-25).slice(0, 7);
await conta({ titulo: 'Aluguel atrasado há 25 dias', valor: 1500, dia: dAtras });
await conta({ titulo: 'Água variável', valor: '', dia: Number(dia(-3).slice(8, 10)), criadoEm: new Date(Date.now() - 20 * 864e5).toISOString() });
await conta({ titulo: 'Conta do formato antigo', valor: 80, dia: 5, pagas: [dia(-40).slice(0, 7)], criadoEm: new Date(Date.now() - 120 * 864e5).toISOString() });

const br = await chromium.launch(); const erros = [];
async function abrir(w, h) {
  const page = await (await br.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Sao_Paulo' })).newPage(); await page.route(/fonts\./, x => x.abort());
  await page.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } }); page.on('pageerror', e => erros.push(String(e)));
  await page.goto(B + '/'); await page.fill('input[name=senha]', SENHA); await page.click('button[type=submit]'); await page.waitForTimeout(3500);
  return page;
}
const t = (page, sel) => page.locator(sel).innerText().then(x => x.replace(/\s+/g, ' '));
let page = await abrir(1280, 900);
await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1500);

// A) conta vencida há 25 dias (e há mais de 20) continua atrasada
const aten = await page.evaluate(() => window.__horusTeste.dgFixaAtencao().map(x => ({ t: x.titulo, d: x.data, c: x.c })));
check(aten.some(x => x.t === 'Aluguel atrasado há 25 dias' && x.d === dia(-25)), 'conta vencida há 25 dias continua na lista de atrasadas (antes sumia depois de 20 dias): ' + JSON.stringify(aten.filter(x => /Aluguel/.test(x.t)).map(x => x.d)));
check(!aten.some(x => x.t === 'Conta do formato antigo' && x.c === dia(-40).slice(0, 7)), 'o ciclo do formato antigo (pagas) continua valendo como pago');

// B) registrar o pagamento pela Central de atenção
await page.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await page.waitForTimeout(1200);
const idAl = (await lista()).find(d => d.titulo === 'Aluguel atrasado há 25 dias').id;
check(/Atrasada há 25 dias/.test(await t(page, '#atencaoLista')), 'o aviso diz há quantos dias está atrasada');
await page.click('[data-fixa-pagar="' + idAl + '|' + cAtras + '"]'); await page.waitForTimeout(500);
check(await page.locator('#overlayDgPg.show').count() === 1 && (await page.inputValue('#dgpg_valor')) === '1500' && (await page.inputValue('#dgpg_data')) === dia(0), 'tocar na conta abre a janela com a data de hoje e o valor da conta preenchidos');
await page.fill('#dgpg_valor', 'abc'); await page.click('#dgpg_ok'); await page.waitForTimeout(300);
check(/Valor inválido/.test(await t(page, '#dgpg_erro')) && await page.locator('#overlayDgPg.show').count() === 1, 'valor inválido não grava e avisa');
await page.fill('#dgpg_valor', '1.512,50'); await page.fill('#dgpg_data', dia(-1)); await page.click('#dgpg_ok'); await page.waitForTimeout(1200);
let al = (await lista()).find(d => d.id === idAl), pg = al['pg_' + cAtras];
check(!!pg && pg.data === dia(-1) && pg.valor === 1512.5 && pg.venc === dia(-25) && !!pg.em && !(al.pagas || []).includes(cAtras), 'o pagamento guarda data, valor, vencimento e quando foi registrado: ' + JSON.stringify(pg));
check(!(await page.locator('[data-fixa-pagar="' + idAl + '|' + cAtras + '"]').count()), 'o ciclo pago sai da Central');

// C) Histórico
await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1000);
await page.click('.dg-aba >> text=Histórico de contas'); await page.waitForTimeout(500);
const h1 = await t(page, '#dgWrap');
check(/Aluguel atrasado há 25 dias/.test(h1) && /R\$\s?1\.512,50/.test(h1) && /Conta do formato antigo/.test(h1) && /sem data/.test(h1), 'o Histórico lista o pagamento novo (com valor) e o do formato antigo (sem data)');
check(/Pago no período\s*R\$\s?1\.512,50/i.test(h1), 'o total do período soma só o que tem valor');
await page.selectOption('[data-dgf="hconta"]', idAl); await page.waitForTimeout(300);
check(!/Conta do formato antigo/.test(await t(page, '.dg-hist')) && /Aluguel atrasado/.test(await t(page, '.dg-hist')), 'o filtro por conta funciona');
await page.selectOption('[data-dgf="hconta"]', ''); await page.click('[data-dg="hper"][data-v="6"]'); await page.waitForTimeout(300);
check(await page.locator('[data-dg="hper"][data-v="6"].on').count() === 1, 'o período muda (6 meses / 12 meses / tudo)');
// corrigir um pagamento pelo histórico
await page.click('tr[data-hc="' + idAl + '|' + cAtras + '"] [data-dg="pgeditar"]'); await page.waitForTimeout(400);
check(/Pagamento registrado/.test(await t(page, '#overlayDgPg h2')) && (await page.inputValue('#dgpg_valor')) === '1512,5', 'abre o pagamento já registrado para corrigir');
await page.fill('#dgpg_valor', '1600'); await page.click('#dgpg_ok'); await page.waitForTimeout(1000);
check((await lista()).find(d => d.id === idAl)['pg_' + cAtras].valor === 1600, 'corrigir o valor grava no mesmo pagamento');
// desfazer o pagamento: o ciclo volta a ficar em aberto
await page.click('tr[data-hc="' + idAl + '|' + cAtras + '"] [data-dg="pgeditar"]'); await page.waitForTimeout(300); await page.click('[data-dgpg="desfazer"]'); await page.waitForTimeout(1000);
check((await lista()).find(d => d.id === idAl)['pg_' + cAtras] == null && (await page.evaluate(() => window.__horusTeste.dgFixaAtencao().some(x => x.titulo === 'Aluguel atrasado há 25 dias' && x.data)) ), 'desfazer o pagamento devolve o ciclo para as atrasadas');

// D) pausar sem perder o histórico
await page.click('.dg-aba >> text=Fixas'); await page.waitForTimeout(500);
await page.click('tr[data-dgl="' + idAl + '"] [data-dg="fixaficha"]'); await page.waitForTimeout(500);
check(/apaga também o histórico/.test(await t(page, '#overlayDgC')) && await page.locator('[data-dgfa="pausar"]').count() === 1, 'a ficha da conta tem Pausar e avisa que Excluir apaga o histórico');
await page.click('[data-dgfa="pausar"]'); await page.waitForTimeout(1200);
al = (await lista()).find(d => d.id === idAl);
check(al.ativa === false && al.pausadaEm === dia(0), 'Pausar marca a conta como pausada');
check(!(await page.evaluate(() => window.__horusTeste.dgFixaAtencao().some(x => x.titulo === 'Aluguel atrasado há 25 dias'))), 'a conta pausada sai da Central de atenção');
check(/Contas pausadas \(1\)/i.test(await t(page, '#dgWrap')) && await page.locator('[data-dg="fixareativar"]').count() === 1, 'aparece em "Contas pausadas", com Reativar');
await page.click('.dg-aba >> text=Histórico de contas'); await page.waitForTimeout(400);
check(/Conta do formato antigo/.test(await t(page, '.dg-hist')), 'o histórico continua listando as contas depois de pausar');
await page.click('.dg-aba >> text=Fixas'); await page.waitForTimeout(300);
await page.click('[data-dg="fixareativar"]'); await page.waitForTimeout(1200);
al = (await lista()).find(d => d.id === idAl);
check(al.ativa === true && al.fixaDesde === dia(0) && !(await page.evaluate(() => window.__horusTeste.dgFixaAtencao().some(x => x.titulo === 'Aluguel atrasado há 25 dias' && x.data < new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)))), 'Reativar volta a avisar e os meses pausados não viram atraso');
check(erros.length === 0, 'computador: sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await page.close();

// celular
page = await abrir(390, 844);
await page.evaluate(() => document.querySelector('#drawer [data-tab="delegadas"]').click()); await page.waitForTimeout(1200);
await page.click('.dg-aba >> text=Histórico de contas'); await page.waitForTimeout(500);
check(await page.locator('.dg-mob .dg-card').count() >= 1 && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'celular: o Histórico vira cartões e não rola para o lado');
check(erros.length === 0, 'celular: sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await br.close();
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
