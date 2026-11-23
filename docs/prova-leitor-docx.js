/* prova de conceito: ler .docx no navegador (zip + document.xml) e ancorar comentários */
async function zipEntradas(buf){
  const dv = new DataView(buf), u = new Uint8Array(buf); let e = u.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let i = 0; i < n; i++){
    const metodo = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl)); out[nome] = { metodo, cs, lo }; p += 46 + nl + el + cl;
  }
  return out;
}
async function zipLer(buf, ent){
  const dv = new DataView(buf), u = new Uint8Array(buf), nl = dv.getUint16(ent.lo + 26, true), el = dv.getUint16(ent.lo + 28, true), ini = ent.lo + 30 + nl + el, d = u.subarray(ini, ini + ent.cs);
  if (ent.metodo === 0) return d;
  const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(d); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
async function lerDocx(buf){
  const ent = await zipEntradas(buf), x = ent['word/document.xml']; if (!x) throw new Error('não é um .docx');
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(await zipLer(buf, x)), 'application/xml');
  const body = xml.getElementsByTagNameNS(W, 'body')[0], blocos = [], cont = {}; let idx = 0, avisos = { imagens: 0, notas: 0, campos: 0 };
  const pr = (el, tag) => { const a = el.getElementsByTagNameNS(W, 'rPr')[0]; return !!(a && a.getElementsByTagNameNS(W, tag)[0] && a.getElementsByTagNameNS(W, tag)[0].getAttributeNS(W, 'val') !== '0' && a.getElementsByTagNameNS(W, tag)[0].getAttributeNS(W, 'val') !== 'false'); };
  function par(p){
    const runs = []; let txt = '';
    for (const r of p.getElementsByTagNameNS(W, 'r')){
      let t = '';
      for (const c of r.childNodes){
        if (c.localName === 't') t += c.textContent; else if (c.localName === 'tab') t += '\t'; else if (c.localName === 'br') t += '\n';
        else if (c.localName === 'drawing' || c.localName === 'pict') avisos.imagens++; else if (c.localName === 'footnoteReference') avisos.notas++; else if (c.localName === 'fldChar') avisos.campos++;
      }
      if (t) runs.push({ t, b: pr(r, 'b'), i: pr(r, 'i'), u: pr(r, 'u') }); txt += t;
    }
    const ppr = p.getElementsByTagNameNS(W, 'pPr')[0], est = ppr && ppr.getElementsByTagNameNS(W, 'pStyle')[0], jc = ppr && ppr.getElementsByTagNameNS(W, 'jc')[0], np = ppr && ppr.getElementsByTagNameNS(W, 'numPr')[0];
    let num = '';
    if (np){ const id = (np.getElementsByTagNameNS(W, 'numId')[0] || {}).getAttributeNS && np.getElementsByTagNameNS(W, 'numId')[0].getAttributeNS(W, 'val'); cont[id] = (cont[id] || 0) + 1; num = cont[id] + '.'; }
    return { t: 'p', i: idx++, estilo: est ? est.getAttributeNS(W, 'val') : '', jc: jc ? jc.getAttributeNS(W, 'val') : '', num, runs, txt };
  }
  for (const c of body.childNodes){
    if (c.localName === 'p') blocos.push(par(c));
    else if (c.localName === 'tbl') blocos.push({ t: 'tbl', linhas: [...c.getElementsByTagNameNS(W, 'tr')].map((tr) => [...tr.getElementsByTagNameNS(W, 'tc')].map((tc) => [...tc.getElementsByTagNameNS(W, 'p')].map(par))) });
  }
  const todos = []; for (const b of blocos){ if (b.t === 'p') todos.push(b); else b.linhas.forEach((l) => l.forEach((cel) => cel.forEach((q) => todos.push(q)))); }
  return { blocos, pars: todos, avisos };
}
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
function dice(a, b){ if (a.length < 2 || b.length < 2) return a === b ? 1 : 0; const m = new Map(); for (let i = 0; i < a.length - 1; i++){ const g = a.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } let k = 0; for (let i = 0; i < b.length - 1; i++){ const g = b.slice(i, i + 2), c = m.get(g) || 0; if (c){ m.set(g, c - 1); k++; } } return 2 * k / (a.length + b.length - 2); }
/* comentário = { p, ini, fim, quote, antes, depois }  →  nova âncora numa versão nova */
function reancorar(com, doc){
  const par = doc.pars[com.p];
  if (par && par.txt.slice(com.ini, com.fim) === com.quote) return { como: 'igual', p: com.p, ini: com.ini, fim: com.fim };
  if (par){ const k = par.txt.indexOf(com.quote); if (k >= 0) return { como: 'mesmo-paragrafo', p: com.p, ini: k, fim: k + com.quote.length }; }
  for (const q of doc.pars){ const k = q.txt.indexOf(com.quote); if (k >= 0 && (com.antes === '' || q.txt.slice(Math.max(0, k - com.antes.length), k) === com.antes || com.quote.length > 25)) return { como: 'moveu', p: q.i, ini: k, fim: k + com.quote.length }; }
  let melhor = null, nota = 0; for (const q of doc.pars){ const d = dice(norm(q.txt), norm(com.paragrafo || com.quote)); const d2 = dice(norm(q.txt), norm(com.quote)); const s = Math.max(q.i === com.p ? d : 0, d2 * 0.9); if (s > nota){ nota = s; melhor = q; } }
  if (melhor && nota >= 0.45) return { como: 'alterado', p: melhor.i, ini: 0, fim: melhor.txt.length, nota: Math.round(nota * 100) };
  return { como: 'perdido' };
}
