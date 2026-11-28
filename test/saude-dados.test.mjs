// Configurações › Saúde dos dados: as 14 checagens (só leitura), abas por área, "Dispensar" que volta só se o dado mudar, bolinha com os itens em "Atenção" e o que cada papel enxerga.
// Grupo 'telas-isoladas' (banco novo):  node test/rodar.mjs saude-dados
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const api = (q, m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK[q], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined });
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), mes0 = dia(0).slice(0, 7), agora = new Date().toISOString();
// ---- dados com um problema de cada tipo
for (const i of [1, 2]) await api('dono', 'PUT', 'despesas/sd-dup' + i, { nome: 'SD Material de escritório', coluna: 'pf', tipo: 'unica', valor: 321.45, data: dia(-2), mesReferencia: mes0, categoria: 'estrutura', pago: false, criadoEm: agora });
for (const i of [1, 2]) await api('dono', 'PUT', 'receitasManuais/sd-rec' + i, { coluna: 'pj', descricao: 'SD Honorário avulso', valor: 800, data: dia(-3), mesReferencia: mes0, recorrente: false, criadoEm: agora });
await api('dono', 'PUT', 'despesas/sd-tr', { nome: 'SD Repasse PJ para PF', coluna: 'pj', tipo: 'unica', valor: 500, data: dia(-1), mesReferencia: mes0, categoria: 'outros', transferenciaId: 'sd-tr-1', pago: true, criadoEm: agora });
await api('dono', 'PUT', 'despesas/sd-out', { nome: 'Farmácia Pague Menos', coluna: 'pf', tipo: 'unica', valor: 89.9, data: dia(-4), mesReferencia: mes0, categoria: 'outros', pago: true, criadoEm: agora });
await api('dono', 'PUT', 'extratos/dcm_sdfat', { tipo: 'documento', kind: 'fatura', status: 'concluido', titulo: 'Fatura SD Itaú', dados: { total: 189463, soma: 150000, vencimento: dia(5), diferenca: { v: 39463 } } });
await api('dono', 'PUT', 'metas/sd-res', { tipo: 'reserva', nome: 'SD Reserva de emergência', movimentos: [{ id: 'm1', tipo: 'inicial', valor: 4000, dia: dia(-70), data: agora }, { id: 'm2', tipo: 'aporte', valor: 300, dia: dia(-10), data: agora }, { id: 'm3', tipo: 'aporte', valor: 300, dia: dia(-10), data: agora }], criadoEm: agora });
await api('dono', 'POST', 'clientes', { nome: 'SD Banco Alfa S.A.' }); await api('dono', 'POST', 'clientes', { nome: 'SD Banco Alfa SA' });
await api('dono', 'POST', 'processos', { numero: '0000777-77.2026.8.09.0777', partes: 'SD Sem cliente x Alguém', clienteIds: [], advogados: [{ oab: '11111/GO', nome: 'Ana' }], criadoEm: agora });
await api('dono', 'PUT', 'termosAcordo/sd-ac', { cliente: 'SD Cliente Totalmente Diferente', numeroProcesso: '0000001-11.2024.8.09.0001', advogados: [{ oab: '11111/GO', nome: 'Ana' }] });
await api('dono', 'POST', 'delegadas', { tipo: 'fixa', titulo: 'SD Aluguel do escritório', valor: 1500, repete: 'mensal', dia: Number(dia(-20).slice(8, 10)), dow: 1, data: '', avisarDias: 3, resp: '', pagas: [], criadoEm: new Date(Date.now() - 80 * 864e5).toISOString() });
await api('dono', 'POST', 'delegadas', { titulo: 'SD Tarefa solta', status: 'afazer', prioridade: 'Média', criadoEm: agora });

const br = await chromium.launch(); const erros = [];
async function abrir(q, w = 1280, h = 900) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Sao_Paulo' }); await ctx.addCookies([{ name: 'sessao', value: TOK[q], url: B }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(q + ': ' + e.message)); await p.route(/fonts\./, (r) => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(3500);
  return { ctx, p };
}
const t = (p, sel) => p.locator(sel).innerText().then((x) => x.replace(/\s+/g, ' '));
let { ctx, p } = await abrir('dono');
await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(800);
check(/Saúde dos dados/.test(await t(p, '#cfWrap')), 'Configurações tem a linha "Saúde dos dados"');
await p.click('#cfWrap [data-cf="saude"]'); await p.waitForTimeout(3500);
check(await p.locator('#overlaySd.show').count() === 1, 'a janela "Saúde dos dados" abre');
const abas = await p.evaluate(() => [...document.querySelectorAll('#overlaySdC .sd-tab')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()));
check(abas.length === 4 && /^Finanças \d+$/.test(abas[0]) && /^Jurídico \d+$/.test(abas[1]) && /^Equipe \d+$/.test(abas[2]) && /^Sistema \d+$/.test(abas[3]), 'proprietário vê as 4 abas, cada uma com o número de itens: ' + abas.join(' | '));
// ---- Finanças
let fin = await t(p, '#overlaySdC');
check(/Lançamentos duplicados/.test(fin) && /SD Material de escritório · R\$ 321,45/.test(fin) && /SD Honorário avulso/.test(fin) && /SD Reserva de emergência · aporte de R\$ 300,00/.test(fin), 'Finanças: acha despesa, receita e aporte da reserva duplicados');
check(/Transferência sem o outro lado/.test(fin) && /SD Repasse PJ para PF/.test(fin) && /falta o outro lado/.test(fin), 'Finanças: acha a transferência com uma ponta só');
await p.click('[data-sd="ck"][data-id="fin-outros"]'); await p.waitForTimeout(300); fin = await t(p, '#overlaySdC');
check(/Farmácia Pague Menos/.test(fin) && /sugestão:/.test(fin), 'Finanças: acha despesa em "Outros" com categoria sugerida');
await p.click('[data-sd="ck"][data-id="fin-fatura"]'); await p.waitForTimeout(300); await p.click('[data-sd="ck"][data-id="fin-reserva"]'); await p.waitForTimeout(300); fin = await t(p, '#overlaySdC');
check(/Fatura SD Itaú/.test(fin) && /diferença R\$ 394,63/.test(fin), 'Finanças: acha a fatura com total diferente das compras');
check(/SD Reserva de emergência/.test(fin) && /há 70 dias/.test(fin), 'Finanças: acha a reserva sem conferência há mais de 40 dias');
// ---- Jurídico
await p.click('[data-sd="aba"][data-v="jur"]'); await p.waitForTimeout(400);
for (const id of ['jur-semcliente', 'jur-semadv', 'jur-semproc', 'jur-partes']) { const aberto = await p.evaluate((id) => document.querySelector('[data-sd="ck"][data-id="' + id + '"]') && document.querySelector('[data-sd="ck"][data-id="' + id + '"]').getAttribute('aria-expanded') === 'true', id); if (!aberto && await p.locator('[data-sd="ck"][data-id="' + id + '"]').count()) await p.click('[data-sd="ck"][data-id="' + id + '"]'); }
await p.waitForTimeout(300); const jur = await t(p, '#overlaySdC');
check(/Clientes com nome quase igual/.test(jur) && /SD Banco Alfa S\.A\. ≈ SD Banco Alfa SA|SD Banco Alfa SA ≈ SD Banco Alfa S\.A\./.test(jur), 'Jurídico: acha clientes com nome quase igual' + (/Clientes com nome quase igual/.test(jur) ? '' : ' — texto: ' + jur.slice(0, 400)));
check(/0000777-77\.2026\.8\.09\.0777/.test(jur) && /nenhum cliente vinculado/.test(jur), 'Jurídico: acha processo sem cliente');
check(/Registros sem advogado definido/.test(jur), 'Jurídico: mostra os registros sem advogado definido (proprietário)');
check(/não está cadastrado em Processos/.test(jur), 'Jurídico: acha inicial/acordo/alvará com processo que não está cadastrado');
check(/Mesmo processo, clientes diferentes/.test(jur) && /SD Cliente Totalmente Diferente/.test(jur), 'Jurídico: acha o mesmo processo com clientes que não batem');
// ---- Equipe e Sistema
await p.click('[data-sd="aba"][data-v="eq"]'); await p.waitForTimeout(400); await p.evaluate(() => { const b = document.querySelector('[data-sd="ck"][data-id="eq-tarefas"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await p.waitForTimeout(300);
const eq = await t(p, '#overlaySdC');
check(/SD Aluguel do escritório/.test(eq) && /venceu em/.test(eq), 'Equipe: acha conta fixa atrasada');
check(/SD Tarefa solta/.test(eq) && /sem responsável e sem data/.test(eq), 'Equipe: acha tarefa sem responsável e sem data');
await p.click('[data-sd="aba"][data-v="sis"]'); await p.waitForTimeout(400); await p.evaluate(() => { const b = document.querySelector('[data-sd="ck"][data-id="sis-backup"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await p.waitForTimeout(300);
check(/Nenhum backup automático encontrado/.test(await t(p, '#overlaySdC')), 'Sistema: avisa que não há backup automático');
// ---- "Tudo certo" e só leitura
await p.click('[data-sd="aba"][data-v="fin"]'); await p.waitForTimeout(300);
check(await p.locator('.sd-ok').count() === 0 || /Tudo certo nesta área/.test(await t(p, '.sd-ok')), 'checagens sem problema aparecem em "Tudo certo nesta área"');
// ---- bolinha
const at = await p.evaluate(() => window.__horusTeste.sdContagens().atencao), bol = await t(p, '#menuNSaude');
check(at >= 5 && bol === String(at), 'a bolinha do menu mostra os itens em "Atenção" (' + bol + ' = ' + at + ')');
// ---- dispensar volta só se o dado mudar
const antes = await p.evaluate(() => window.__horusTeste.sdContagens().atencao);
await p.click('[data-sd="ck"][data-id="fin-dup"]').catch(() => { }); await p.waitForTimeout(200);
const aberto = await p.evaluate(() => document.querySelector('[data-sd="ck"][data-id="fin-dup"]').getAttribute('aria-expanded') === 'true'); if (!aberto) await p.click('[data-sd="ck"][data-id="fin-dup"]');
await p.waitForTimeout(200);
const total0 = await p.locator('[data-sd="disp"][data-id="fin-dup"]').count();
await p.locator('[data-sd="disp"][data-id="fin-dup"]').first().click(); await p.waitForTimeout(500);
const depois = await p.evaluate(() => window.__horusTeste.sdContagens().atencao);
check(depois === antes - 1 && await p.locator('[data-sd="disp"][data-id="fin-dup"]').count() === total0 - 1, 'Dispensar tira o item e a bolinha cai 1 (' + antes + ' → ' + depois + ')');
await p.click('[data-sd="mostrarDisp"]'); await p.waitForTimeout(300);
check(await p.locator('[data-sd="rest"]').count() === 1 && /volta sozinho se o dado dele mudar/.test(await t(p, '#overlaySdC')), '"Mostrar item dispensado" lista o item com Restaurar');
await p.reload(); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(12000);
check(await p.evaluate(() => window.__horusTeste.sdContagens().atencao) === depois, 'a dispensa continua depois de recarregar o app (' + depois + ')');
// ---- outro aparelho (contexto novo, sem nada guardado): a dispensa feita aqui já vale lá, e desfazer lá vale aqui
const aparelho2 = await abrir('dono'); await aparelho2.p.evaluate(() => window.__horusTeste.sdVerificar(true)); await aparelho2.p.waitForTimeout(2500);
check(await aparelho2.p.evaluate(() => window.__horusTeste.sdContagens().atencao) === depois, 'outro aparelho: a dispensa feita aqui já vale lá (' + depois + ' em "Atenção")');
await aparelho2.p.evaluate(() => window.__horusTeste.sdAbrir()); await aparelho2.p.waitForTimeout(2500);
await aparelho2.p.click('[data-sd="mostrarDisp"]'); await aparelho2.p.waitForTimeout(300); await aparelho2.p.click('[data-sd="rest"]'); await aparelho2.p.waitForTimeout(1500);
check(await aparelho2.p.evaluate(() => window.__horusTeste.sdContagens().atencao) === antes, 'no outro aparelho, Restaurar traz o item de volta lá (' + antes + ')');
await p.evaluate(() => window.__horusTeste.sdVerificar(true)); await p.waitForTimeout(2500);
check(await p.evaluate(() => window.__horusTeste.sdContagens().atencao) === antes, 'e aqui o item também volta depois de sincronizar (' + antes + ')');
await aparelho2.ctx.close();
// redispensa para o teste seguinte (o dado mudar)
await p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await p.waitForTimeout(500);
await p.evaluate(() => window.__horusTeste.sdAbrir()); await p.waitForTimeout(2500);
await p.evaluate(() => { const b = document.querySelector('[data-sd="ck"][data-id="fin-dup"]'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); }); await p.waitForTimeout(200);
await p.locator('[data-sd="disp"][data-id="fin-dup"]').first().click(); await p.waitForTimeout(1500);
check(await p.evaluate(() => window.__horusTeste.sdContagens().atencao) === depois, 'dispensa de novo (' + depois + ')');
// o servidor: o carimbo mais novo vale, cada pessoa só vê a própria lista
const sv = (q, m, b) => fetch(B + '/api/saude', { method: m, headers: { cookie: 'sessao=' + TOK[q], 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) }));
const T0 = Date.now();
await sv('dono', 'PUT', { d: { 'teste|a': { s: 'v1', t: T0 + 2000 } } });
let r1 = await sv('dono', 'PUT', { d: { 'teste|a': { s: 'velho', t: T0 + 1000 } } });
check(r1.j.d['teste|a'].s === 'v1', 'o servidor guarda o carimbo mais novo (um pedido mais antigo não sobrescreve)');
r1 = await sv('dono', 'PUT', { d: { 'teste|a': { s: null, t: T0 + 3000 } } });
check(r1.j.d['teste|a'].s === null, 'desfazer (null) com carimbo mais novo vale');
const anaLista = await sv('ana', 'GET');
check(anaLista.s === 200 && !('teste|a' in anaLista.j.d), 'cada pessoa só vê a própria lista de dispensas');
check((await sv('dono', 'PUT', { d: Object.fromEntries([['x'.repeat(200), { s: 'a', t: 1 }], ['ruim', 'texto'], ['nulo', null]]) })).s === 200 && !('ruim' in (await sv('dono', 'GET')).j.d), 'entradas inválidas são ignoradas');
check((await sv('caio', 'PUT', { d: { 'eq|b': { s: 'z', t: T0 + 5 } } })).j.d['eq|b'].s === 'z', 'estagiário também tem a lista (mesmo sem cofre próprio)');
// muda o dado (terceira despesa igual): a assinatura muda e o item volta
await api('dono', 'PUT', 'despesas/sd-dup3', { nome: 'SD Material de escritório', coluna: 'pf', tipo: 'unica', valor: 321.45, data: dia(-2), mesReferencia: mes0, categoria: 'estrutura', pago: false, criadoEm: agora });
await p.evaluate(() => document.querySelector('#drawer [data-tab="inicio"]').click()); await p.waitForTimeout(18000);
await p.evaluate(() => window.__horusTeste.sdVerificar(true)); await p.waitForTimeout(1500);
check(await p.evaluate(() => window.__horusTeste.sdContagens().atencao) === antes, 'o item dispensado VOLTA quando o dado muda (terceiro lançamento igual): ' + await p.evaluate(() => window.__horusTeste.sdContagens().atencao));
// só leitura: nada foi gravado pela verificação
const desp = await (await api('dono', 'GET', 'despesas')).json();
check(desp.docs.filter((d) => /^SD /.test(d.data.nome || '')).length === 4 && desp.docs.length === 6, 'a verificação não alterou nem criou nenhum lançamento (6 despesas: as de teste)');
await ctx.close();
// ---- papéis
const rotulos = async (q) => { const x = await abrir(q); await x.p.evaluate(() => document.querySelector('#drawer [data-tab="configuracoes"]').click()); await x.p.waitForTimeout(600);
  const r = await x.p.evaluate(() => ({ ids: window.__horusTeste.sdChecksDoPapel().map((c) => c.id), abas: [...new Set(window.__horusTeste.sdChecksDoPapel().map((c) => c.aba))], regras: document.querySelectorAll('#cfWrap [data-cf="extregras"]').length })); await x.ctx.close(); return r; };
const ana = await rotulos('ana'), caio = await rotulos('caio');
check(ana.abas.join() === 'fin,jur' && !ana.ids.includes('sis-backup') && !ana.ids.includes('jur-semadv'), 'advogada: só Finanças e Jurídico, sem backup nem "sem advogado": ' + ana.abas.join());
check(ana.regras === 1 && caio.regras === 0, 'advogada vê "Extratos: regras que você ensinou" (as dela); estagiário não vê');
check(caio.abas.join() === 'eq' && caio.ids.join() === 'eq-contas,eq-tarefas', 'estagiário: só Equipe (contas fixas e tarefas): ' + caio.ids.join());
// ---- celular
({ ctx, p } = await abrir('dono', 390, 844));
await p.evaluate(() => window.__horusTeste.sdAbrir()); await p.waitForTimeout(3500);
check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && await p.locator('#overlaySd.show').count() === 1, 'celular: a janela abre sem rolar para o lado');
await ctx.close(); await br.close();
check(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
