// Auditoria: como as fichas de honorários e de cadastro aparecem dentro do processo e a partir de uma publicação (capturas e lista de campos).
// Servidor do grupo 'auditoria':  FOTOS=/tmp/auditoria node test/rodar.mjs auditoria
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const B = process.env.BASE || 'http://127.0.0.1:8816', OUT = process.env.FOTOS || '/tmp/auditoria', TOK = 'tok-dono-0000000000000000000000000001';
const api = async (m, p, b) => { const x = await fetch(B + p, { method: m, headers: { cookie: 'sessao=' + TOK, 'content-type': 'application/json' }, body: b !== undefined ? JSON.stringify(b) : undefined }); return x.status; };
await api('PUT', '/api/db/processos/aud1', { numero: '0000871-01.2024.8.09.0871', partes: 'Fulano x Banco', orgao: 'TJGO', classe: 'Cumprimento de sentença', clienteIds: [], honorarios: 'sem', origem: 'manual', arquivado: false, criadoEm: new Date().toISOString() });
const br = await chromium.launch(); const rel = {};
for (const w of [1280, 390]) {
  const ctx = await br.newContext({ viewport: { width: w, height: w < 600 ? 800 : 900 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
  const p = await ctx.newPage(); await p.route(/fonts\./, (x) => x.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.prNovoHonorario, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  const campos = () => p.evaluate(() => { const raiz = document.querySelector('.overlay.show .modal') || document; return [...raiz.querySelectorAll('label.field-label, .f-sec-t, summary b, h2, .pb-sec-t')].filter((e) => e.offsetParent !== null).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean); });
  const fecha = () => p.evaluate(() => document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')));
  // 1) ficha do processo (resumo) com a seção de honorários
  await p.evaluate(() => window.__horusTeste.prAbrir('00008710120248090871')); await p.waitForTimeout(900);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#overlayPr [data-prf], #overlayPr button')].find((x) => /Dados|Honor/i.test(x.textContent)); });
  rel['processo-' + w] = await campos(); await p.screenshot({ path: OUT + '/proc-ficha-' + w + '.png' });
  // 2) "Adicionar honorários (fixo, êxito…)" = ficha de Inicial em modo "Honorários do processo"
  for (const t of ['caso', 'acordo', 'alvara']) {
    await p.evaluate(() => window.__horusTeste.prAbrir('00008710120248090871')); await p.waitForTimeout(500);
    await p.evaluate((t) => window.__horusTeste.prNovoHonorario(t), t); await p.waitForTimeout(900);
    rel['hon-' + t + '-' + w] = await campos();
    await p.screenshot({ path: OUT + '/hon-' + t + '-' + w + '.png' });
    // rolar o corpo da ficha até o fim para a captura completa
    await p.evaluate(() => { const c = document.querySelector('.overlay.show .modal-body, .overlay.show .modal .f-corpo, .overlay.show .modal'); if (c) c.scrollTop = 99999; }); await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '/hon-' + t + '-' + w + '-fim.png' });
    await fecha(); await p.waitForTimeout(300);
  }
  // 3) cadastrar processo a partir de uma publicação
  await p.evaluate(() => document.querySelector('#drawer [data-tab="publicacoes"]').click()); await p.waitForTimeout(900);
  await p.evaluate(() => window.__horusTeste.prEscolherCadastro('104')).catch(() => { }); await p.waitForTimeout(800);
  rel['pub-cadastrar-' + w] = await campos(); await p.screenshot({ path: OUT + '/pub-cadastrar-' + w + '.png' });
  await fecha();
  await ctx.close();
}
{ // ficha inteira (viewport alto, tudo aberto) para o esboço
  const ctx = await br.newContext({ viewport: { width: 1280, height: 2600 } }); await ctx.addCookies([{ name: 'sessao', value: TOK, url: B }]);
  const p = await ctx.newPage(); await p.route(/fonts\./, (x) => x.abort()); await p.addInitScript(() => { try { localStorage.setItem('horus.leituraAuto', '0'); } catch (e) { } });
  await p.goto(B + '/'); await p.waitForFunction(() => window.__horusEu && window.__horusEu.pronto && window.__horusTeste && window.__horusTeste.prNovoHonorario, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  await p.evaluate(() => window.__horusTeste.prAbrir('00008710120248090871')); await p.waitForTimeout(500);
  await p.evaluate(() => window.__horusTeste.prNovoHonorario('caso')); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelectorAll('.overlay.show details').forEach((d) => { d.open = true; })); await p.waitForTimeout(400);
  await p.locator('.overlay.show .modal').first().screenshot({ path: OUT + '/hon-caso-inteira.png' });
  await p.evaluate(() => document.querySelectorAll('.overlay.show').forEach((o) => o.classList.remove('show')));
  await p.evaluate(() => window.__horusTeste.abrirClienteEdit({})); await p.waitForTimeout(700);
  await p.locator('.overlay.show .modal').first().screenshot({ path: OUT + '/cliente-novo-modal.png' });
  await ctx.close();
}
await api('DELETE', '/api/db/processos/aud1');
fs.writeFileSync(OUT + '/campos-honorarios.json', JSON.stringify(rel, null, 1));
console.log(Object.keys(rel).join(', '));
process.exit(0);
