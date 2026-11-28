// Auditoria de tela: percorre todas as abas (e sub-abas) em vários tamanhos de tela e papéis e procura o que o usuário costuma flagrar a olho:
// botão sobre botão, botão sobre texto, botão fora da tela, tela que rola para o lado e erro de JavaScript. Também abre as janelas de "novo/adicionar".
// Grupo 'telas-isoladas' (porta 8816):  node test/rodar.mjs auditoria-botoes   (RELATORIO=/pasta/arquivo.json grava tudo; FOTOS=/pasta guarda uma foto de cada achado)
// Por padrão olha 3 telas (proprietário no celular e no computador, estagiário no celular, ~4 min); AUD_TELAS=todas olha as 6 (~10 min); AUD_TELAS=0,3 escolhe pelo número.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816';
const TOK = { dono: 'tok-dono-0000000000000000000000000001', ana: 'tok-adv-ana-00000000000000000000000002', caio: 'tok-est-caio-0000000000000000000000004' };
const api = (q, m, p, b) => fetch(B + '/api/db/' + p, { method: m, headers: { cookie: 'sessao=' + TOK[q || 'dono'], 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined });
const dia = (n) => new Date(Date.now() - 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10), mes0 = dia(0).slice(0, 7), agora = new Date().toISOString();
// ---- dados de teste variados (textos compridos, valores grandes, estados diferentes)
const parc = [['2', 60], ['8', 50], ['13', 110], ['15', 50], ['21', 50]].map(([d, v], i) => ({ id: 'ab' + i, valor: v, data: mes0 + '-' + d.padStart(2, '0') }));
await api('dono', 'PUT', 'despesas/au1', { nome: 'AU Combustível com nome bem comprido para testar quebra de linha', coluna: 'pf', tipo: 'fixa', valorPadrao: 600, diaVencimento: null, categoria: 'transporte', ativa: true, pagamentos: { [mes0]: { pago: false, valor: 600, parciais: parc } }, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('dono', 'PUT', 'despesas/au2', { nome: 'AU Aluguel do escritório', coluna: 'pj', tipo: 'fixa', valorPadrao: 15000.5, diaVencimento: 27, categoria: 'estrutura', ativa: true, pagamentos: {}, criadoEm: '2026-01-01T00:00:00.000Z' });
await api('dono', 'PUT', 'despesas/au3', { nome: 'AU Notebook parcelado', coluna: 'pf', tipo: 'fixa', valorPadrao: 400, diaVencimento: 10, categoria: 'pessoal', ativa: true, parcelamento: { n: 10, inicio: mes0, valores: null }, pagamentos: {}, criadoEm: agora });
await api('dono', 'PUT', 'despesas/au4', { nome: 'AU Única paga', coluna: 'pj', tipo: 'unica', valor: 99.9, data: dia(-2), mesReferencia: mes0, categoria: 'outros', pago: true, dataPagamento: dia(-1), criadoEm: agora });
await api('dono', 'PUT', 'despesas/au5', { nome: 'AU Única pendente vencida', coluna: 'pf', tipo: 'unica', valor: 1894.63, data: dia(-3), mesReferencia: mes0, categoria: 'cartao', pago: false, criadoEm: agora });
for (const [i, t] of ['Internet', 'Água', 'Energia elétrica do escritório central'].entries()) await api('dono', 'POST', 'delegadas', { tipo: 'fixa', titulo: t, valor: i ? '' : 189.9, repete: 'mensal', dia: 3 + i, dow: 1, data: '', avisarDias: 3, resp: '', pagas: [], criadoEm: new Date(Date.now() - 80 * 864e5).toISOString(), ...(i === 0 ? { ['pg_' + dia(-35).slice(0, 7)]: { data: dia(-33), valor: 189.9, venc: dia(-35), por: '11111/GO', em: agora } } : {}) });
await api('dono', 'POST', 'delegadas', { tipo: 'fixa', titulo: 'Conta pausada', valor: 50, repete: 'mensal', dia: 8, dow: 1, data: '', avisarDias: 3, resp: '', ativa: false, pausadaEm: dia(-5), pagas: [], criadoEm: new Date(Date.now() - 80 * 864e5).toISOString() });
for (let i = 0; i < 6; i++) await api('dono', 'POST', 'delegadas', { titulo: 'AU Tarefa delegada número ' + i + ' com um título razoavelmente comprido para quebrar linha', resp: i % 2 ? '11111/GO' : 'u:u4', delegadoPor: '11111/GO', prioridade: ['Alta', 'Média', 'Baixa'][i % 3], status: ['afazer', 'andamento', 'aguardando', 'revisao'][i % 4], fatal: dia(i - 2), trabalhar: dia(i - 3), processo: '0000001-11.2024.8.09.000' + (i % 3 + 1), criadoEm: agora });
await api('dono', 'POST', 'delegadas', { titulo: 'AU Tarefa fixa semanal', resp: 'u:u4', fixa: true, repete: 'semanal', dow: 2, status: 'afazer', fixaDesde: dia(-20), feitas: {}, criadoEm: agora });
for (let i = 0; i < 4; i++) await api('dono', 'POST', 'agenda', { titulo: 'AU Audiência de instrução e julgamento ' + i, data: dia(i + 1), hora: '14:00', tipo: i % 2 ? 'prazo' : 'audiencia', resp: ['11111/GO'], fatal: i === 1, processo: '0000001-11.2024.8.09.0001', cliente: 'Cliente Um', criadoEm: agora });
await api('dono', 'PUT', 'metas/aumeta', { tipo: 'reserva', nome: 'Reserva de emergência', alvo: 20000, movimentos: [{ id: 'm1', tipo: 'aporte', valor: 5045.13, data: dia(-10) }], criadoEm: agora });
await api('dono', 'POST', 'receitasManuais', { nome: 'AU Receita avulsa', valor: 1200, data: dia(0), coluna: 'pj', mesReferencia: mes0, criadoEm: agora });

const TELAS = [['dono', 390, 844], ['dono', 360, 740], ['dono', 768, 1024], ['dono', 1280, 900], ['ana', 390, 844], ['caio', 390, 844]];
const br = await chromium.launch(); const achados = [], erros = [];
const AUDITAR = () => {
  const out = [], W = window.innerWidth;
  const cs = (e) => getComputedStyle(e);
  const H = window.innerHeight;
  const escondido = (e) => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = cs(x); if (+s.opacity < 0.05 || s.visibility === 'hidden' || x.hidden || (x.tagName === 'DETAILS' && !x.open && !(x.querySelector(':scope > summary') || { contains: () => false }).contains(e)) || (/(hidden|clip)/.test(s.overflowY) && x !== e && x.getBoundingClientRect().height < 2) || (s.clipPath && s.clipPath !== 'none' && /inset\(\s*(50|100)%/.test(s.clipPath))) return true; } return false; };
  const rect = (e) => { if (escondido(e)) return null; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; if (r.bottom < 0 || r.top > H) return null; const s = cs(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return null; return r; };
  /* só vale o que a pessoa enxerga: algum ponto do elemento tem que ser o próprio elemento (ou filho/pai) no topo da pilha */
  const aparece = (e, r) => { const xs = [r.left + r.width / 2], ys = [r.top + r.height / 2]; for (const x of xs) for (const y of ys) { if (x < 0 || y < 0 || x > innerWidth || y > H) continue; const t = document.elementFromPoint(x, y); if (t && e.contains(t)) return true; } return false; };
  const flutua = (e) => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const p = cs(x).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const rolaLado = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = cs(x); if (/(auto|scroll)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return true; } return false; };
  const recortado = (e, r) => { if (rolaLado(e)) return true; for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = cs(x); if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) { const R = x.getBoundingClientRect(); if (R.width && (r.right < R.left + 2 || r.left > R.right - 2 || r.bottom < R.top + 2 || r.top > R.bottom - 2)) return true; } } return false; };
  const ovAberto = [...document.querySelectorAll('.overlay.show, .modal-overlay.show, dialog[open]')].pop();
  const raiz = ovAberto || document.body;
  const sig = (e) => (e.tagName.toLowerCase() + '|' + (e.id || '') + '|' + ((e.className && e.className.baseVal === undefined ? String(e.className) : '').split(/\s+/).slice(0, 2).join('.')) + '|' + (e.innerText || e.value || e.placeholder || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 28));
  const inter = [...raiz.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')].map((e) => ({ e, r: rect(e) })).filter((x) => x.r && !flutua(x.e) && !recortado(x.e, x.r) && aparece(x.e, x.r) && (ovAberto || !x.e.closest('.overlay')) && !(x.e.tagName === 'BUTTON' && !(x.e.innerText || '').trim() && !x.e.querySelector('svg, img') && !x.e.getAttribute('aria-label') && !x.e.title));
  const texto = [...raiz.querySelectorAll('*')].filter((e) => !e.children.length && (e.textContent || '').trim() && !/^(SCRIPT|STYLE|OPTION|SVG|PATH|TITLE)$/i.test(e.tagName) && !e.closest('select, button, a[href], [role=button], textarea, svg') ).map((e) => ({ e, r: rect(e) })).filter((x) => x.r && !flutua(x.e) && !recortado(x.e, x.r) && aparece(x.e, x.r) && (ovAberto || !x.e.closest('.overlay')));
  const cruza = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4;
  for (let i = 0; i < inter.length; i++) {
    for (let j = i + 1; j < inter.length; j++) { const a = inter[i], b = inter[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue; if (a.e.tagName === 'LABEL' || b.e.tagName === 'LABEL') continue; if (cruza(a.r, b.r)) { out.push({ tipo: 'botao-sobre-botao', a: sig(a.e), b: sig(b.e), ha: a.e.outerHTML.slice(0, 220), hb: b.e.outerHTML.slice(0, 220), pa: a.e.parentElement.outerHTML.slice(0, 260), ch: (() => { const l = []; for (let x = a.e; x && x !== document.body; x = x.parentElement) { const q = cs(x); l.push(x.tagName.toLowerCase() + '.' + String(x.className).split(' ')[0] + ' d=' + q.display + ' ov=' + q.overflowY + ' h=' + Math.round(x.getBoundingClientRect().height) + ' op=' + q.opacity + ' mh=' + q.maxHeight + ' pos=' + q.position + ' vis=' + q.visibility); } return l.slice(0, 8); })() }); a.e.setAttribute('data-aud', '1'); b.e.setAttribute('data-aud', '1'); } }
    for (const t of texto) { if (inter[i].e.contains(t.e) || t.e.contains(inter[i].e)) continue; if (cruza(inter[i].r, t.r)) { out.push({ tipo: 'botao-sobre-texto', a: sig(inter[i].e), b: sig(t.e), ha: inter[i].e.outerHTML.slice(0, 220), hb: t.e.outerHTML.slice(0, 160), pa: inter[i].e.parentElement.outerHTML.slice(0, 260), ra: JSON.stringify(inter[i].r), rb: JSON.stringify(t.r) }); inter[i].e.setAttribute('data-aud', '1'); t.e.setAttribute('data-aud', '2'); } }
    const r = inter[i].r; if (r.right > W + 1 || r.left < -1) { out.push({ tipo: 'fora-da-tela', a: sig(inter[i].e), x: Math.round(r.right - W) }); inter[i].e.setAttribute('data-aud', '1'); }
  }
  if (document.documentElement.scrollWidth > W + 1 && !ovAberto) out.push({ tipo: 'rola-para-o-lado', x: document.documentElement.scrollWidth - W });
  return out;
};
const FECHAR = () => { document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')); document.querySelectorAll('[class*=menu-aberto]').forEach(() => 0); };
for (const [quem, w, h] of TELAS.filter((_, i) => process.env.AUD_TELAS === 'todas' || (process.env.AUD_TELAS ? process.env.AUD_TELAS.split(',') : ['0', '3', '5']).includes(String(i)))) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, timezoneId: 'America/Sao_Paulo' }); await ctx.addCookies([{ name: 'sessao', value: TOK[quem], url: B }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(`${quem}@${w} erro JS: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(m.text())) erros.push(`${quem}@${w} console: ${m.text().slice(0, 160)}`); }); await p.route(/fonts\./, (r) => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#drawer [data-tab]')].filter((b) => b.offsetParent !== null || true).map((b) => b.getAttribute('data-tab')));
  const registra = async (onde) => {
    const alt = await p.evaluate(() => document.documentElement.scrollHeight), passo = Math.max(200, h - 160), vistos = new Set();
    const ov = await p.evaluate(() => !!document.querySelector('.overlay.show'));
    for (let y = 0; y < (ov ? 1 : Math.min(alt, 9000)); y += passo) {
      if (!ov) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(60); }
      const r = await p.evaluate(AUDITAR); r.forEach((x) => achados.push({ tela: `${quem}@${w}`, onde, ...x }));
      if (r.length && process.env.FOTOS && !vistos.has(y)) { vistos.add(y); await p.evaluate(() => { document.querySelectorAll('[data-aud]').forEach((e) => { e.style.outline = e.getAttribute('data-aud') === '2' ? '2px solid blue' : '2px solid red'; }); }); await p.waitForTimeout(150); await p.screenshot({ path: process.env.FOTOS + '/' + quem + w + '-' + onde.replace(/[^a-z0-9]+/gi, '_') + '-' + y + '.png' }); }
      await p.evaluate(() => document.querySelectorAll('[data-aud]').forEach((e) => { e.style.outline = ''; e.removeAttribute('data-aud'); }));
    }
    if (!ov) await p.evaluate(() => window.scrollTo(0, 0));
  };
  for (const tab of [...new Set(tabs)]) {
    await p.evaluate((t) => { const b = document.querySelector('#drawer [data-tab="' + t + '"]'); if (b) b.click(); }, tab); await p.waitForTimeout(1300);
    await p.evaluate(FECHAR); await registra(tab);
    // sub-abas: botões dentro de grupos de abas/segmentos visíveis
    const subs = await p.evaluate(() => { const g = [...document.querySelectorAll('.dg-abas, .segmented, [role=tablist], .fin-sub, .sub-abas, .ab-abas, .abas, .tabs')].filter((e) => e.offsetParent !== null && !e.closest('.overlay')); const l = []; g.forEach((c, gi) => [...c.querySelectorAll('button')].forEach((b, bi) => { if (b.offsetParent !== null && !b.disabled) l.push([gi, bi, (b.innerText || '').trim().slice(0, 24)]); })); return l.slice(0, 14); });
    for (const [gi, bi, tx] of subs) {
      const ok = await p.evaluate(([gi, bi]) => { const g = [...document.querySelectorAll('.dg-abas, .segmented, [role=tablist], .fin-sub, .sub-abas, .ab-abas, .abas, .tabs')].filter((e) => e.offsetParent !== null && !e.closest('.overlay'))[gi]; const b = g && g.querySelectorAll('button')[bi]; if (!b) return false; b.click(); return true; }, [gi, bi]); if (!ok) continue; await p.waitForTimeout(600); await p.evaluate(FECHAR); await registra(tab + ' › ' + tx); await expandir(tab + ' › ' + tx);
    }
    // abre menus "⋯", listas de abatimentos, "pagas" e detalhes: é onde os botões costumam se atropelar
    async function expandir(onde) {
      let n = 0;
      for (let k = 0; k < 8; k++) {
        const clicou = await p.evaluate((vistos) => { const c = [...document.querySelectorAll('[data-menu-toggle], .btn-abat-lista, .btn-pagas, details > summary')].filter((b) => b.offsetParent !== null && !b.closest('.overlay') && !b.hasAttribute('data-aud-ok')); const b = c[0]; if (!b) return false; b.setAttribute('data-aud-ok', '1'); b.click(); return true; }, n); if (!clicou) break; n++; await p.waitForTimeout(350);
      }
      if (n) { await registra(onde + ' (menus abertos)'); }
      await p.evaluate(() => document.querySelectorAll('[data-aud-ok]').forEach((e) => e.removeAttribute('data-aud-ok')));
    }
    await expandir(tab);
    // janelas de "novo / adicionar"
    const novos = await p.evaluate(() => [...document.querySelectorAll('button, a.btn')].filter((b) => b.offsetParent !== null && !b.closest('.overlay') && /^\s*(\+|nov[oa]\b|adicionar|cadastrar|lançar)/i.test(b.innerText || '')).slice(0, 5).map((b) => (b.innerText || '').trim().slice(0, 30)));
    for (const tx of novos) {
      const abriu = await p.evaluate((tx) => { const b = [...document.querySelectorAll('button, a.btn')].find((x) => x.offsetParent !== null && !x.closest('.overlay') && (x.innerText || '').trim().slice(0, 30) === tx); if (!b) return false; b.click(); return true; }, tx); if (!abriu) continue; await p.waitForTimeout(700);
      if (await p.evaluate(() => !!document.querySelector('.overlay.show'))) await registra(tab + ' ⊕ ' + tx); await p.evaluate(FECHAR); await p.waitForTimeout(150);
    }
  }
  // janela "Saúde dos dados" (todas as abas dela)
  if (await p.evaluate(() => !!(window.__horusTeste && window.__horusTeste.sdAbrir))) {
    await p.evaluate(() => window.__horusTeste.sdAbrir()); await p.waitForTimeout(2500); await registra('saude');
    const abasSd = await p.evaluate(() => [...document.querySelectorAll('#overlaySdC [data-sd="aba"]')].map((b) => b.getAttribute('data-v')));
    for (const a of abasSd) { await p.evaluate((a) => document.querySelector('#overlaySdC [data-sd="aba"][data-v="' + a + '"]').click(), a); await p.waitForTimeout(300); await p.evaluate(() => document.querySelectorAll('#overlaySdC [data-sd="ck"]').forEach((b) => { if (b.getAttribute('aria-expanded') !== 'true') b.click(); })); await p.waitForTimeout(300); await registra('saude › ' + a); }
    await p.evaluate(FECHAR);
  }
  await ctx.close();
}
await br.close();
const uniq = new Map(); for (const a of achados) { const k = [a.tela, a.onde, a.tipo, a.a, a.b].join('§'); if (!uniq.has(k)) uniq.set(k, a); }
const lista = [...uniq.values()], errU = [...new Set(erros)];
if (process.env.RELATORIO) writeFileSync(process.env.RELATORIO, JSON.stringify({ achados: lista, erros: errU }, null, 1));
for (const a of lista.slice(0, 80)) console.log('  ACHADO', a.tela, '|', a.onde, '|', a.tipo, '|', a.a, a.b ? '⟷ ' + a.b : '', a.x ? '(' + a.x + 'px)' : '');
for (const e of errU.slice(0, 20)) console.log('  ERRO  ', e);
console.log(lista.length + ' achado(s) de layout, ' + errU.length + ' erro(s) de JavaScript');
process.exit(lista.length || errU.length ? 1 : 0);
