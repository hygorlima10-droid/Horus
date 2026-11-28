/* ============================================================
   LEITOR DE PETIÇÃO (prefixo pl) — comentários no texto (nível 2)
   Lê o .docx no próprio navegador (nada vai a terceiros): zip → document.xml + styles.xml + numbering.xml, e desenha uma
   LEITURA SIMPLIFICADA parecida com o Word (estilos do escritório, cores, bordas, numeração, tabelas, imagens do corpo).
   Não reproduz: papel timbrado (cabeçalho/rodapé), quebras de página, SmartArt. O Word/PDF original é sempre baixável.
   O comentário guarda o trecho citado + parágrafo + posição + contexto; em outra versão o trecho é reencontrado (leiReancorar).
   Usa impZipEntradas/impZipEntrada (importação de extratos) para abrir o zip.
   ============================================================ */
var LEI_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
var LEI_PX = 96 / 72 / 20;   /* twips → px */
function leiF(el, nome){ if (!el) return null; for (var i = 0; i < el.children.length; i++){ var c = el.children[i]; if (c.localName === nome) return c; } return null; }
function leiV(el, nome){ var x = leiF(el, nome); return x ? (x.getAttributeNS(LEI_W, 'val') == null ? '' : x.getAttributeNS(LEI_W, 'val')) : null; }
function leiLig(el, nome){ var x = leiF(el, nome); if (!x) return undefined; var v = x.getAttributeNS(LEI_W, 'val'); return !(v === '0' || v === 'false' || v === 'off'); }
function leiNum(s){ var n = parseInt(s, 10); return isNaN(n) ? 0 : n; }
function leiBorda(el){ if (!el) return null; var v = el.getAttributeNS(LEI_W, 'val'); if (!v || v === 'nil' || v === 'none') return null; var c = el.getAttributeNS(LEI_W, 'color'); return { estilo: v === 'dotted' ? 'dotted' : (v === 'dashed' ? 'dashed' : (v === 'double' ? 'double' : 'solid')), larg: Math.max(1, Math.round(leiNum(el.getAttributeNS(LEI_W, 'sz')) / 8 * 96 / 72)), cor: (c && c !== 'auto') ? '#' + c : '#000', esp: leiNum(el.getAttributeNS(LEI_W, 'space')) * 96 / 72 }; }
function leiLerRPr(r){
  var o = {}; if (!r) return o;
  var f = leiF(r, 'rFonts'); if (f){ var n = f.getAttributeNS(LEI_W, 'ascii') || f.getAttributeNS(LEI_W, 'hAnsi'); if (n) o.fonte = n; }
  ['b', 'i', 'caps', 'smallCaps', 'strike'].forEach(function(k){ var v = leiLig(r, k); if (v !== undefined) o[k] = v; });
  var u = leiV(r, 'u'); if (u !== null) o.u = u !== 'none';
  var c = leiV(r, 'color'); if (c && c !== 'auto') o.cor = '#' + c;
  var sz = leiV(r, 'sz'); if (sz) o.sz = leiNum(sz) / 2;
  var sp = leiV(r, 'spacing'); if (sp) o.esp = leiNum(sp) / 20;
  var va = leiV(r, 'vertAlign'); if (va) o.va = va;
  var hl = leiV(r, 'highlight'); if (hl && hl !== 'none') o.hl = { yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', lightGray: '#D3D3D3' }[hl] || '#FFFF00';
  var sh = leiF(r, 'shd'); if (sh){ var fill = sh.getAttributeNS(LEI_W, 'fill'); if (fill && fill !== 'auto') o.fundo = '#' + fill; }
  return o;
}
function leiLerPPr(p){
  var o = {}; if (!p) return o;
  var jc = leiV(p, 'jc'); if (jc) o.jc = jc === 'both' ? 'justify' : (jc === 'end' ? 'right' : (jc === 'start' ? 'left' : jc));
  var ind = leiF(p, 'ind'); if (ind){ o.ind = {}; ['left', 'right', 'firstLine', 'hanging', 'start', 'end'].forEach(function(k){ var v = ind.getAttributeNS(LEI_W, k); if (v !== null && v !== '') o.ind[k === 'start' ? 'left' : (k === 'end' ? 'right' : k)] = leiNum(v); }); }
  var sp = leiF(p, 'spacing'); if (sp){ o.esp = {}; ['before', 'after', 'line'].forEach(function(k){ var v = sp.getAttributeNS(LEI_W, k); if (v !== null && v !== '') o.esp[k] = leiNum(v); }); o.esp.regra = sp.getAttributeNS(LEI_W, 'lineRule') || ''; }
  var bd = leiF(p, 'pBdr'); if (bd){ o.bdr = {}; ['top', 'left', 'bottom', 'right'].forEach(function(k){ var b = leiBorda(leiF(bd, k)); if (b) o.bdr[k] = b; }); }
  var sh = leiF(p, 'shd'); if (sh){ var fill = sh.getAttributeNS(LEI_W, 'fill'), val = sh.getAttributeNS(LEI_W, 'val') || ''; if (fill && fill !== 'auto') o.fundo = '#' + fill; else if (/^pct/.test(val)) o.fundo = '#F2F2F2'; }
  var np = leiF(p, 'numPr'); if (np){ o.numId = leiV(np, 'numId'); o.ilvl = leiNum(leiV(np, 'ilvl')); }
  return o;
}
function leiMesclar(a, b){ var o = {}, k; for (k in a) o[k] = a[k]; for (k in b){ if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object') o[k] = leiMesclar(o[k], b[k]); else o[k] = b[k]; } return o; }
function leiLerEstilos(xml){
  var mapa = {}, def = { r: {}, p: {} };
  if (!xml) return { mapa: mapa, def: def };
  var dd = xml.getElementsByTagNameNS(LEI_W, 'docDefaults')[0];
  if (dd){ def.r = leiLerRPr(leiF(leiF(dd, 'rPrDefault'), 'rPr')); def.p = leiLerPPr(leiF(leiF(dd, 'pPrDefault'), 'pPr')); }
  var ests = xml.getElementsByTagNameNS(LEI_W, 'style');
  for (var i = 0; i < ests.length; i++){ var s = ests[i], id = s.getAttributeNS(LEI_W, 'styleId'); mapa[id] = { tipo: s.getAttributeNS(LEI_W, 'type'), base: leiV(s, 'basedOn'), padrao: s.getAttributeNS(LEI_W, 'default') === '1', p: leiLerPPr(leiF(s, 'pPr')), r: leiLerRPr(leiF(s, 'rPr')) }; }
  return { mapa: mapa, def: def };
}
function leiEstilo(est, id){
  var cadeia = [], g = 0; while (id && est.mapa[id] && g++ < 12){ cadeia.unshift(est.mapa[id]); id = est.mapa[id].base; }
  var r = {}, p = {}; cadeia.forEach(function(s){ r = leiMesclar(r, s.r); p = leiMesclar(p, s.p); }); return { r: r, p: p };
}
function leiLerNumeracao(xml){
  var abs = {}, nums = {}; if (!xml) return { abs: abs, nums: nums };
  var a = xml.getElementsByTagNameNS(LEI_W, 'abstractNum');
  for (var i = 0; i < a.length; i++){ var id = a[i].getAttributeNS(LEI_W, 'abstractNumId'), nv = []; var ls = a[i].getElementsByTagNameNS(LEI_W, 'lvl');
    for (var k = 0; k < ls.length; k++){ var l = ls[k]; nv[leiNum(l.getAttributeNS(LEI_W, 'ilvl'))] = { ini: leiV(l, 'start') === null ? 1 : leiNum(leiV(l, 'start')), fmt: leiV(l, 'numFmt') || 'decimal', txt: leiV(l, 'lvlText') || '', p: leiLerPPr(leiF(l, 'pPr')), r: leiLerRPr(leiF(l, 'rPr')) }; }
    abs[id] = nv; }
  var n = xml.getElementsByTagNameNS(LEI_W, 'num');
  for (var j = 0; j < n.length; j++) nums[n[j].getAttributeNS(LEI_W, 'numId')] = leiV(n[j], 'abstractNumId');
  return { abs: abs, nums: nums };
}
function leiFmtNum(n, fmt){
  function rom(x){ var t = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']], s = ''; t.forEach(function(q){ while (x >= q[0]){ s += q[1]; x -= q[0]; } }); return s; }
  function let_(x){ var s = ''; while (x > 0){ x--; s = String.fromCharCode(97 + x % 26) + s; x = Math.floor(x / 26); } return s; }
  if (fmt === 'lowerLetter') return let_(n); if (fmt === 'upperLetter') return let_(n).toUpperCase();
  if (fmt === 'lowerRoman') return rom(n); if (fmt === 'upperRoman') return rom(n).toUpperCase();
  if (fmt === 'decimalZero') return (n < 10 ? '0' : '') + n; return String(n);
}
/* lê o .docx: { blocos, pars, largura, margem, imagens } — pars é a lista plana de parágrafos (a âncora do comentário usa o índice daqui) */
function leiLerDocx(buf){
  var ents; try{ ents = impZipEntradas(buf); }catch(e){ return Promise.reject(new Error('Não consegui abrir este arquivo.')); }
  var achar = function(n){ return ents.filter(function(e){ return e.nome === n; })[0]; };
  var ler = function(n){ var e = achar(n); return e ? impZipEntrada(buf, e, '') : Promise.resolve(null); };
  var txt = function(u){ return u ? new DOMParser().parseFromString(new TextDecoder('utf-8').decode(u), 'application/xml') : null; };
  if (!achar('word/document.xml')) return Promise.reject(new Error('Este arquivo não parece um .docx.'));
  return Promise.all([ler('word/document.xml'), ler('word/styles.xml'), ler('word/numbering.xml'), ler('word/_rels/document.xml.rels')]).then(function(r){
    var doc = txt(r[0]), est = leiLerEstilos(txt(r[1])), num = leiLerNumeracao(txt(r[2])), rels = {}, relX = txt(r[3]);
    if (relX){ var rs = relX.getElementsByTagName('Relationship'); for (var i = 0; i < rs.length; i++) rels[rs[i].getAttribute('Id')] = rs[i].getAttribute('Target'); }
    var body = doc.getElementsByTagNameNS(LEI_W, 'body')[0], pars = [], contadores = {}, imagens = {}, pend = [];
    var padrao = Object.keys(est.mapa).filter(function(k){ return est.mapa[k].tipo === 'paragraph' && est.mapa[k].padrao; })[0] || 'Normal';
    var sect = body.getElementsByTagNameNS(LEI_W, 'sectPr')[0], pgSz = sect && leiF(sect, 'pgSz'), pgMar = sect && leiF(sect, 'pgMar');
    var largura = pgSz ? Math.round(leiNum(pgSz.getAttributeNS(LEI_W, 'w')) * LEI_PX) : 794, margem = pgMar ? [Math.round(leiNum(pgMar.getAttributeNS(LEI_W, 'left')) * LEI_PX), Math.round(leiNum(pgMar.getAttributeNS(LEI_W, 'right')) * LEI_PX), Math.round(leiNum(pgMar.getAttributeNS(LEI_W, 'top')) * LEI_PX)] : [96, 96, 96];
    function imagem(dr){
      var bl = dr.getElementsByTagName('a:blip')[0] || dr.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip')[0]; if (!bl) return null;
      var rid = bl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'), alvo = rels[rid]; if (!alvo || !/\.(png|jpe?g|gif|bmp|webp)$/i.test(alvo)) return null;
      var ext = dr.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
      return { alvo: 'word/' + alvo.replace(/^\//, '').replace(/^word\//, ''), w: ext ? Math.round(leiNum(ext.getAttribute('cx')) / 9525) : 0, h: ext ? Math.round(leiNum(ext.getAttribute('cy')) / 9525) : 0 };
    }
    function lerPar(p){
      var direto = leiLerPPr(leiF(p, 'pPr')), sid = leiV(leiF(p, 'pPr'), 'pStyle') || padrao, es = leiEstilo(est, sid);
      var pp = leiMesclar(est.def.p, es.p), rb = leiMesclar(est.def.r, es.r), numP = pp.numId, rotulo = null, nvl = null;
      var nid = direto.numId !== undefined ? direto.numId : numP, ilvl = direto.numId !== undefined ? direto.ilvl : (pp.ilvl || 0);
      if (nid && nid !== '0' && num.nums[nid] !== undefined && num.abs[num.nums[nid]] && num.abs[num.nums[nid]][ilvl]){
        nvl = num.abs[num.nums[nid]][ilvl]; var c = contadores[nid] = contadores[nid] || [];
        for (var d = ilvl + 1; d < 10; d++) c[d] = undefined;
        c[ilvl] = c[ilvl] === undefined ? nvl.ini : c[ilvl] + 1;
        if (nvl.fmt === 'bullet') rotulo = '•';
        else { rotulo = nvl.txt.replace(/%(\d)/g, function(m, k){ var lv = num.abs[num.nums[nid]][k - 1], v = c[k - 1] === undefined ? (lv ? lv.ini : 1) : c[k - 1]; return leiFmtNum(v, lv ? lv.fmt : 'decimal'); }); }
        /* o recuo da numeração vale se a numeração vem direto no parágrafo; se vem do estilo, o recuo do estilo vence */
        if (direto.numId !== undefined) pp = leiMesclar(pp, { ind: nvl.p.ind || {} }); else pp = leiMesclar({ ind: nvl.p.ind || {} }, pp);
      }
      pp = leiMesclar(pp, direto);
      var runs = [], t = '', ims = [];
      var colher = function(rEl){
        var rpr = leiF(rEl, 'rPr'), rsid = leiV(rpr, 'rStyle'), rr = leiMesclar(leiMesclar(rb, rsid ? leiEstilo(est, rsid).r : {}), leiLerRPr(rpr)), s = '';
        for (var k = 0; k < rEl.children.length; k++){
          var c2 = rEl.children[k];
          if (c2.localName === 't') s += c2.textContent; else if (c2.localName === 'tab') s += '\t'; else if (c2.localName === 'br' || c2.localName === 'cr') s += '\n';
          else if (c2.localName === 'drawing'){ var im = imagem(c2); if (im){ ims.push(im); pend.push(im.alvo); } }
        }
        if (s){ runs.push({ t: s, r: rr, ini: t.length }); t += s; }
      };
      (function varrer(el){ for (var k = 0; k < el.children.length; k++){ var c3 = el.children[k];
        if (c3.localName === 'r') colher(c3); else if (c3.localName === 'hyperlink' || c3.localName === 'smartTag' || c3.localName === 'ins') varrer(c3); } })(p);
      var o = { i: pars.length, txt: t, runs: runs, pp: pp, rotulo: rotulo, rotuloR: nvl ? leiMesclar(rb, nvl.r) : null, imgs: ims, estiloId: sid };
      pars.push(o); return o;
    }
    function caixas(p){   /* texto dentro de caixas de texto (ignora a cópia "Fallback" do Word, que duplicaria) */
      var out = [], tbx = p.getElementsByTagNameNS(LEI_W, 'txbxContent');
      for (var i = 0; i < tbx.length; i++){ var fb = false, a = tbx[i]; while (a && a !== p){ if (a.localName === 'Fallback') fb = true; a = a.parentNode; } if (fb) continue; var ps = tbx[i].children; for (var k = 0; k < ps.length; k++) if (ps[k].localName === 'p') out.push(ps[k]); }
      return out;
    }
    function bloco(el){
      if (el.localName === 'p'){ var base = lerPar(el), cx = caixas(el).map(function(q){ return lerPar(q); }); return { t: 'p', par: base, caixas: cx }; }
      if (el.localName === 'tbl'){
        var linhas = [], trs = []; for (var i = 0; i < el.children.length; i++) if (el.children[i].localName === 'tr') trs.push(el.children[i]);
        trs.forEach(function(tr){ var cels = []; for (var k = 0; k < tr.children.length; k++){ var tc = tr.children[k]; if (tc.localName !== 'tc') continue; var tcp = leiF(tc, 'tcPr'), sh = tcp && leiF(tcp, 'shd'), gs = tcp && leiV(tcp, 'gridSpan'), fill = sh && sh.getAttributeNS(LEI_W, 'fill'), w = tcp && leiF(tcp, 'tcW');
          var filhos = []; for (var m = 0; m < tc.children.length; m++){ if (tc.children[m].localName === 'p' || tc.children[m].localName === 'tbl') filhos.push(bloco(tc.children[m])); }
          cels.push({ blocos: filhos, span: gs ? leiNum(gs) : 1, fundo: fill && fill !== 'auto' ? '#' + fill : '', w: w ? Math.round(leiNum(w.getAttributeNS(LEI_W, 'w')) * LEI_PX) : 0 }); } linhas.push(cels); });
        var tp = leiF(el, 'tblPr'), tb = tp && leiF(tp, 'tblBorders'), temBorda = !!(tb && ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].some(function(k){ return leiBorda(leiF(tb, k)); }));
        var sty = tp && leiV(tp, 'tblStyle'); if (!tb && sty && /grid/i.test(sty)) temBorda = true;
        return { t: 'tbl', linhas: linhas, borda: temBorda };
      }
      return null;
    }
    var blocos = []; for (var q = 0; q < body.children.length; q++){ var b = bloco(body.children[q]); if (b) blocos.push(b); }
    var unicas = pend.filter(function(x, i) { return pend.indexOf(x) === i; });
    return Promise.all(unicas.map(function(n){ var e = achar(n); return e ? impZipEntrada(buf, e, '').then(function(u){ var ext = (n.split('.').pop() || 'png').toLowerCase(); imagens[n] = URL.createObjectURL(new Blob([u], { type: 'image/' + (ext === 'jpg' ? 'jpeg' : ext) })); }).catch(function(){}) : null; })).then(function(){
      return { blocos: blocos, pars: pars, largura: largura, margem: margem, imagens: imagens };
    });
  });
}
/* ---------- desenho ---------- */
function leiEstiloRun(r, escala){
  var s = '';
  if (r.fonte) s += 'font-family:"' + r.fonte + '","Segoe UI",system-ui,sans-serif;';
  if (r.sz) s += 'font-size:' + Math.round(r.sz * 96 / 72 * 10) / 10 + 'px;';
  if (r.b) s += 'font-weight:700;'; if (r.i) s += 'font-style:italic;';
  var td = []; if (r.u) td.push('underline'); if (r.strike) td.push('line-through'); if (td.length) s += 'text-decoration:' + td.join(' ') + ';';
  if (r.cor) s += 'color:' + r.cor + ';'; if (r.caps) s += 'text-transform:uppercase;'; if (r.smallCaps) s += 'font-variant:small-caps;';
  if (r.esp) s += 'letter-spacing:' + Math.round(r.esp * 96 / 72 * 10) / 10 + 'px;';
  if (r.va === 'superscript') s += 'vertical-align:super;font-size:.75em;'; else if (r.va === 'subscript') s += 'vertical-align:sub;font-size:.75em;';
  if (r.hl) s += 'background:' + r.hl + ';'; else if (r.fundo) s += 'background:' + r.fundo + ';';
  return s;
}
/* marcas = [{ p, ini, fim, cls, n, cid }] */
function leiDesenharPar(par, marcas, imagens, esc){
  var el = document.createElement('p'), pp = par.pp, s = '', ind = pp.ind || {}, e = pp.esp || {};
  el.setAttribute('data-p', par.i); el.className = 'lei-p' + (par.txt.trim() || par.imgs.length ? '' : ' lei-vazio');
  if (pp.jc) s += 'text-align:' + pp.jc + ';';
  var esq = (ind.left || 0) * LEI_PX * esc, dir = (ind.right || 0) * LEI_PX * esc, hang = (ind.hanging || 0) * LEI_PX * esc, prim = (ind.firstLine || 0) * LEI_PX * esc;
  s += 'margin-left:' + Math.round(esq) + 'px;margin-right:' + Math.round(dir) + 'px;';
  if (par.rotulo !== null){ s += 'padding-left:' + Math.round(hang) + 'px;text-indent:' + -Math.round(hang) + 'px;'; } else if (hang) s += 'padding-left:' + Math.round(hang) + 'px;text-indent:' + -Math.round(hang) + 'px;'; else if (prim) s += 'text-indent:' + Math.round(prim) + 'px;';
  s += 'margin-top:' + Math.round((e.before || 0) * LEI_PX) + 'px;margin-bottom:' + Math.round((e.after || 0) * LEI_PX) + 'px;';
  if (e.line && e.regra === 'auto') s += 'line-height:' + Math.round(e.line / 240 * 100) / 100 + ';';
  if (pp.fundo) s += 'background:' + pp.fundo + ';';
  if (pp.bdr){ ['top', 'left', 'bottom', 'right'].forEach(function(k){ var b = pp.bdr[k]; if (b){ s += 'border-' + k + ':' + b.larg + 'px ' + b.estilo + ' ' + b.cor + ';padding-' + k + ':' + Math.round(b.esp) + 'px;'; } }); if (pp.bdr.left || pp.bdr.right) s += 'box-sizing:border-box;'; }
  el.style.cssText = s;
  if (par.rotulo !== null){
    var lb = document.createElement('span'); lb.className = 'lei-n'; lb.setAttribute('data-n', par.rotulo); lb.style.cssText = leiEstiloRun(par.rotuloR || {}) + (hang ? 'display:inline-block;min-width:' + Math.round(hang) + 'px;text-indent:0;' : 'margin-right:.4em;'); el.appendChild(lb);
  }
  par.imgs.forEach(function(im){ var u = imagens[im.alvo]; if (!u) return; var i = document.createElement('img'); i.src = u; i.alt = ''; i.className = 'lei-img'; if (im.w) i.style.width = Math.round(im.w * esc) + 'px'; el.appendChild(i); });
  var mp = (marcas || []).filter(function(m){ return m.p === par.i; });
  par.runs.forEach(function(rn){
    var pts = [0, rn.t.length]; mp.forEach(function(m){ [m.ini - rn.ini, m.fim - rn.ini].forEach(function(x){ if (x > 0 && x < rn.t.length) pts.push(x); }); });
    pts.sort(function(a, b){ return a - b; });
    for (var i = 0; i < pts.length - 1; i++){
      var a = pts[i], b = pts[i + 1]; if (a === b) continue;
      var sp = document.createElement('span'); sp.className = 'lei-r'; sp.style.cssText = leiEstiloRun(rn.r); sp.textContent = rn.t.slice(a, b);
      var cob = mp.filter(function(q){ return q.ini <= rn.ini + a && q.fim >= rn.ini + b; });
      if (cob.length){
        var m = cob.filter(function(q){ return q.cls !== 'lei-ok'; })[0] || cob[0];   /* cor do que está em aberto; o resolvido só pinta se for o único */
        sp.className += ' lei-m ' + m.cls; sp.setAttribute('data-cid', m.cid);
        var fins = cob.filter(function(q){ return rn.ini + b === q.fim; }).map(function(q){ return q.n; });
        if (fins.length) sp.setAttribute('data-n', fins.join(' · '));
      }
      el.appendChild(sp);
    }
  });
  if (!par.runs.length && !par.imgs.length) el.appendChild(document.createElement('br'));
  return el;
}
function leiDesenharBloco(b, marcas, imagens, esc){
  if (b.t === 'p'){
    var f = document.createDocumentFragment(); f.appendChild(leiDesenharPar(b.par, marcas, imagens, esc));
    b.caixas.forEach(function(c){ var d = document.createElement('div'); d.className = 'lei-caixa'; d.appendChild(leiDesenharPar(c, marcas, imagens, esc)); f.appendChild(d); });
    return f;
  }
  var t = document.createElement('table'); t.className = 'lei-tb' + (b.borda ? ' lei-tb-b' : '');
  b.linhas.forEach(function(l){ var tr = document.createElement('tr'); l.forEach(function(c){ var td = document.createElement('td'); if (c.span > 1) td.colSpan = c.span; if (c.fundo) td.style.background = c.fundo; if (c.w) td.style.width = Math.round(c.w * esc) + 'px'; c.blocos.forEach(function(x){ td.appendChild(leiDesenharBloco(x, marcas, imagens, esc)); }); tr.appendChild(td); }); t.appendChild(tr); });
  return t;
}
function leiDesenharDoc(doc, marcas, largura){
  var folha = document.createElement('div'), esc = Math.min(1, largura / doc.largura), mg = Math.max(14, Math.round(doc.margem[0] * esc));
  folha.className = 'lei-folha'; folha.style.cssText = 'max-width:' + doc.largura + 'px;padding:' + Math.max(16, Math.round(doc.margem[2] * Math.max(esc, .35))) + 'px ' + Math.max(14, Math.round(doc.margem[1] * esc)) + 'px 40px ' + mg + 'px;';
  doc.blocos.forEach(function(b){ folha.appendChild(leiDesenharBloco(b, marcas, doc.imagens, esc)); });
  return folha;
}
/* ---------- âncora do comentário e reencontro em outra versão ---------- */
function leiNorm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function leiDice(a, b){
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  var m = {}, i, k = 0; for (i = 0; i < a.length - 1; i++){ var g = a.slice(i, i + 2); m[g] = (m[g] || 0) + 1; }
  for (i = 0; i < b.length - 1; i++){ var h = b.slice(i, i + 2); if (m[h]){ m[h]--; k++; } }
  return 2 * k / (a.length + b.length - 2);
}
/* parecença por palavras (conjunto de palavras com 4+ letras) */
function leiPal(a, b){ var sa = {}, sb = {}, na = 0, nb = 0, k = 0; a.split(' ').forEach(function(w){ if (w.length >= 4 && !sa[w]){ sa[w] = 1; na++; } }); b.split(' ').forEach(function(w){ if (w.length >= 4 && !sb[w]){ sb[w] = 1; nb++; } }); Object.keys(sa).forEach(function(w){ if (sb[w]) k++; }); return na + nb ? 2 * k / (na + nb) : 0; }
function leiAncoraDe(doc, pi, ini, fim){
  var par = doc.pars[pi]; if (!par) return null;
  var viz = function(passo){ for (var k = pi + passo; k >= 0 && k < doc.pars.length; k += passo){ var t = doc.pars[k].txt; if (t && t.trim().length > 20) return t.trim().slice(0, 300); } return ''; };
  return { p: pi, pag: doc.tipo === 'pdf' ? pi + 1 : undefined, ini: ini, fim: fim, quote: par.txt.slice(ini, fim), antes: par.txt.slice(Math.max(0, ini - 20), ini), depois: par.txt.slice(fim, fim + 20), paragrafo: par.txt.slice(0, 1500), pAnt: doc.tipo === 'pdf' ? '' : viz(-1), pPos: doc.tipo === 'pdf' ? '' : viz(1) };
}
/* devolve { como: 'igual'|'mesmo'|'moveu'|'alterado'|'perdido', p, ini, fim } */
function leiReancorar(a, doc){
  if (a.pagina) return doc.pars[a.p] ? { como: 'igual', p: a.p, ini: 0, fim: 0, pagina: true } : { como: 'perdido' };
  var par = doc.pars[a.p];
  if (par && par.txt.slice(a.ini, a.fim) === a.quote) return { como: 'igual', p: a.p, ini: a.ini, fim: a.fim };
  if (par){ var k = par.txt.indexOf(a.quote); if (k >= 0) return { como: 'mesmo', p: a.p, ini: k, fim: k + a.quote.length }; }
  var melhor = null;
  doc.pars.forEach(function(q){ var k2 = q.txt.indexOf(a.quote); if (k2 < 0) return; var ok = a.quote.length > 25 || (a.antes === '' || q.txt.slice(Math.max(0, k2 - a.antes.length), k2) === a.antes); if (ok && !melhor) melhor = { como: 'moveu', p: q.i, ini: k2, fim: k2 + a.quote.length }; });
  if (melhor) return melhor;
  /* o parágrafo foi reescrito? só vale se o parecido for MUITO parecido (letras e palavras) e do mesmo tamanho; senão o parágrafo foi retirado e o comentário NÃO pode grudar em outro */
  var bp = null, nota = 0, ref = leiNorm(a.paragrafo || a.quote);
  doc.pars.forEach(function(q){
    if (!q.txt.trim()) return; var qn = leiNorm(q.txt);
    var tam = Math.min(qn.length, ref.length) / Math.max(qn.length, ref.length, 1), s = Math.min(leiDice(qn, ref), leiPal(qn, ref)) * (q.i === a.p ? 1.04 : 1);
    if (tam < .45) s = 0;
    var sq = a.quote && leiNorm(a.quote).length > 40 ? Math.min(leiDice(qn, leiNorm(a.quote)), leiPal(qn, leiNorm(a.quote))) * .85 : 0;
    if (Math.max(s, sq) > nota){ nota = Math.max(s, sq); bp = q; }
  });
  if (bp && nota >= .62) return { como: 'alterado', p: bp.i, ini: 0, fim: bp.txt.length };
  return { como: 'perdido' };
}
/* seleção do navegador → { p, ini, fim } dentro de UM parágrafo */
function leiSelecao(raiz){
  var sel = window.getSelection(); if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  var r = sel.getRangeAt(0); if (!raiz.contains(r.commonAncestorContainer)) return null;
  var elDe = function(n){ n = n.nodeType === 3 ? n.parentNode : n; return n.closest ? n.closest('[data-p]') : null; };
  var pa = elDe(r.startContainer), pb = elDe(r.endContainer); if (!pa) return null;
  var pos = function(par, no, off){ var rg = document.createRange(); rg.selectNodeContents(par); rg.setEnd(no, off); var txt = rg.cloneContents(); var tot = 0; var w = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT, null); var n; while ((n = w.nextNode())) tot += n.nodeValue.length; return tot; };
  var ini = pos(pa, r.startContainer, r.startOffset), fim;
  if (pb === pa) fim = pos(pa, r.endContainer, r.endOffset); else fim = pa.textContent.length;
  /* o rótulo da numeração e os números dos comentários são pseudo-elementos: não entram na contagem */
  if (fim <= ini) return null;
  return { p: Number(pa.getAttribute('data-p')), ini: ini, fim: fim, vario: pb !== pa };
}
var LEI_CSS = '.lei-folha{background:#fff;color:#000;margin:0 auto;box-sizing:border-box;font:16px/1.5 "Segoe UI",system-ui,-apple-system,sans-serif;box-shadow:0 1px 8px #0002;border-radius:4px;overflow-wrap:anywhere}' +
  '.lei-p{margin:0;white-space:pre-wrap;tab-size:4;min-height:1.2em}.lei-p.lei-vazio{min-height:.9em}.lei-n::before{content:attr(data-n)}.lei-r{white-space:pre-wrap}' +
  '.lei-img{display:block;max-width:100%;height:auto;margin:6px auto}.lei-caixa{border:1px solid #bbb;padding:6px 10px;margin:8px auto;max-width:60%;text-align:center}' +
  '.lei-tb{border-collapse:collapse;width:100%;margin:6px 0}.lei-tb td{vertical-align:top;padding:3px 6px}.lei-tb-b td{border:1px solid #888}' +
  '.lei-m{background:#FFEFB0;border-bottom:2px solid #D9A400;cursor:pointer}.lei-m[data-n]::after{content:attr(data-n);font:700 10px/1 system-ui,sans-serif;background:#D9A400;color:#fff;border-radius:8px;padding:2px 5px;margin-left:2px;vertical-align:super}' +
  '.lei-m.lei-alt{background:#FFE3C2;border-bottom:2px dashed #E07B00}.lei-m.lei-alt[data-n]::after{background:#E07B00}.lei-m.lei-ok{background:#DDF3E5;border-bottom:2px solid #1F8A4C}.lei-m.lei-ok[data-n]::after{background:#1F8A4C}.lei-m.lei-foco{outline:3px solid #4453D6}';
function leiInjetarCss(){ if (document.getElementById('leiCss')) return; var st = document.createElement('style'); st.id = 'leiCss'; st.textContent = LEI_CSS; document.head.appendChild(st); }

/* ---------- PDF (pdf.js, o mesmo dos extratos): página fiel + texto selecionável ---------- */
function leiLerPdf(buf){
  return extCarregarPdfJs().then(function(lib){
    return lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise.then(function(pdf){
      var doc = { tipo: 'pdf', lib: lib, pdf: pdf, n: pdf.numPages, pars: [], largura: 0, imagens: {} }, seq = Promise.resolve();
      for (var n = 1; n <= pdf.numPages; n++) (function(n){
        seq = seq.then(function(){ return pdf.getPage(n); }).then(function(pg){ return pg.getTextContent(); }).then(function(tc){
          var txt = tc.items.filter(function(i){ return i.str !== undefined; }).map(function(i){ return i.str; }).join('');
          doc.pars.push({ i: n - 1, txt: txt, vazio: txt.replace(/\s/g, '').length < 15 });
        });
      })(n);
      return seq.then(function(){ return doc; });
    });
  });
}
function leiDesenharPdf(el, cs){
  var key = leiChave(), p = leiPet(), pode = p && leiPodeComentar(p);
  if (!leiS.pdfNo || leiS.pdfKey !== key){
    var raiz = document.createElement('div'); raiz.className = 'lei-pdf'; leiS.pdfNo = raiz; leiS.pdfKey = key;
    var cw = Math.max(260, Math.min(900, el.clientWidth - 24));
    leiS.doc.pdf.getPage(1).then(function(pg1){
      var esc = cw / pg1.getViewport({ scale: 1 }).width, h1 = pg1.getViewport({ scale: esc }).height;
      for (var n = 1; n <= leiS.doc.n; n++){
        var w = document.createElement('div'); w.className = 'lei-pg'; w.setAttribute('data-pg', n); w.style.width = cw + 'px'; w.setAttribute('data-esc', esc);
        w.innerHTML = '<div class="lei-pgh"><span>Página ' + n + ' de ' + leiS.doc.n + (leiS.doc.pars[n - 1].vazio ? ' · sem texto selecionável (escaneada)' : '') + '</span><span class="lei-pgx"></span></div><div class="lei-pgc" style="height:' + Math.round(h1) + 'px"></div>';
        raiz.appendChild(w);
      }
      leiPdfDecorar(); leiPdfRender(el);
    });
  }
  if (!el.contains(leiS.pdfNo)) el.appendChild(leiS.pdfNo);
  leiS.marcasPdf = cs.marcados; leiS.podePdf = !!pode; leiPdfDecorar();
  if (!el.getAttribute('data-rol')){ el.setAttribute('data-rol', '1'); }
  el.onscroll = function(){ if (!leiS.rolando){ leiS.rolando = true; requestAnimationFrame(function(){ leiS.rolando = false; leiPdfRender(el); }); } };
  setTimeout(function(){ leiPdfRender(el); }, 60);
}
/* botão "Comentar a página" e selos dos comentários de página; refaz as marcas do texto */
function leiPdfDecorar(){
  if (!leiS.pdfNo) return;
  Array.prototype.forEach.call(leiS.pdfNo.querySelectorAll('.lei-pg'), function(w){
    var n = Number(w.getAttribute('data-pg')), x = w.querySelector('.lei-pgx'), h = '';
    (leiS.marcasPdf || []).forEach(function(o){ if (o.pos && o.pos.pagina && o.pos.p === n - 1) h += '<button type="button" class="lei-pgb" data-cid="' + o.c.id + '">' + o.n + '</button>'; });
    if (leiS.podePdf) h += '<button type="button" class="lei-pgbt" data-lei="pagina" data-pg="' + n + '">＋ Comentar a página</button>';
    x.innerHTML = h; leiMarcarPdf(w);
  });
}
function leiPdfRender(el){
  if (!leiS.pdfNo) return;
  var r = el.getBoundingClientRect();
  Array.prototype.forEach.call(leiS.pdfNo.querySelectorAll('.lei-pg'), function(w){
    if (w.getAttribute('data-ok')) return;
    var b = w.getBoundingClientRect(); if (b.bottom < r.top - 900 || b.top > r.bottom + 900) return;
    w.setAttribute('data-ok', '1'); leiPdfPagina(w);
  });
}
function leiPdfPagina(w){
  var doc = leiS.doc, n = Number(w.getAttribute('data-pg')), box = w.querySelector('.lei-pgc'), esc = Number(w.getAttribute('data-esc'));
  doc.pdf.getPage(n).then(function(pg){
    var vp = pg.getViewport({ scale: esc }), dpr = Math.min(2, window.devicePixelRatio || 1), cv = document.createElement('canvas');
    cv.width = Math.round(vp.width * dpr); cv.height = Math.round(vp.height * dpr); cv.style.width = Math.round(vp.width) + 'px'; cv.style.height = Math.round(vp.height) + 'px';
    box.style.height = Math.round(vp.height) + 'px'; box.appendChild(cv);
    var tl = document.createElement('div'); tl.className = 'lei-tl'; tl.style.width = Math.round(vp.width) + 'px'; tl.style.height = Math.round(vp.height) + 'px'; tl.style.setProperty('--scale-factor', vp.scale); box.appendChild(tl);
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return pg.render({ canvasContext: ctx, viewport: vp }).promise.then(function(){ return pg.getTextContent(); }).then(function(tc){
      var divs = [], strs = [];
      return doc.lib.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp, textDivs: divs, textContentItemsStr: strs }).promise.then(function(){ w._divs = divs; w._strs = strs; w.setAttribute('data-tl', '1'); leiMarcarPdf(w); });
    });
  }).catch(function(e){ w.removeAttribute('data-ok'); console.error('página do PDF', e); });
}
function leiMarcarPdf(w){
  var divs = w._divs, strs = w._strs; if (!divs) return;
  divs.forEach(function(d, i){ d.classList.remove('lei-pm', 'lei-ok', 'lei-alt'); d.removeAttribute('data-cid'); d.removeAttribute('data-n'); if (d.getAttribute('data-sp')){ d.textContent = strs[i]; d.removeAttribute('data-sp'); } });
  var n = Number(w.getAttribute('data-pg')), ini = [], t = 0; strs.forEach(function(s){ ini.push(t); t += s.length; });
  (leiS.marcasPdf || []).forEach(function(o){
    if (!o.pos || o.pos.pagina || o.pos.p !== n - 1) return;
    var primeiro = true, cls = 'lei-pm' + (o.estado === 'resolvido' ? ' lei-ok' : (o.como === 'alterado' ? ' lei-alt' : ''));
    divs.forEach(function(d, i){
      var a = ini[i], b = a + strs[i].length; if (b <= o.pos.ini || a >= o.pos.fim || !strs[i]) return;
      var jaM = d.classList.contains('lei-pm') ? d : (d.getAttribute('data-sp') ? d.querySelector('mark.lei-pm') : null);
      if (jaM){   /* a linha já tem outro comentário: soma o número dele no mesmo marcador (os dois aparecem) */
        var nn = (jaM.getAttribute('data-n') || '').split(' · ').filter(Boolean); if (nn.indexOf(String(o.n)) < 0){ nn.push(String(o.n)); jaM.setAttribute('data-n', nn.join(' · ')); }
        if (o.estado !== 'resolvido'){ jaM.classList.remove('lei-ok'); }
        return;
      }
      var x = Math.max(o.pos.ini - a, 0), y = Math.min(o.pos.fim - a, strs[i].length), alvo = d;
      if (x > 0 || y < strs[i].length){   /* marca só o pedaço do trecho (o texto da linha continua igual) */
        d.textContent = ''; d.setAttribute('data-sp', '1');
        if (x > 0) d.appendChild(document.createTextNode(strs[i].slice(0, x)));
        alvo = document.createElement('mark'); alvo.textContent = strs[i].slice(x, y); d.appendChild(alvo);
        if (y < strs[i].length) d.appendChild(document.createTextNode(strs[i].slice(y)));
      }
      alvo.className = cls; alvo.setAttribute('data-cid', o.c.id); if (primeiro){ alvo.setAttribute('data-n', o.n); primeiro = false; }
    });
  });
}
/* seleção do navegador numa página do PDF → { p: índice da página, ini, fim } nos textos da camada de texto */
function leiSelecaoPdf(raiz){
  var sel = window.getSelection(); if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  var r = sel.getRangeAt(0); if (!raiz.contains(r.commonAncestorContainer)) return null;
  var pgDe = function(nd){ nd = nd.nodeType === 3 ? nd.parentNode : nd; return nd.closest ? nd.closest('.lei-pg') : null; };
  var wa = pgDe(r.startContainer), wb = pgDe(r.endContainer); if (!wa || !wa._divs) return null;
  var strs = wa._strs, divs = wa._divs, ini = [], t = 0; strs.forEach(function(s){ ini.push(t); t += s.length; });
  var pos = function(no, off){
    var el = no.nodeType === 3 ? no.parentNode : no, i = divs.indexOf(el);
    while (i < 0 && el && el !== wa){ el = el.parentNode; i = divs.indexOf(el); }
    if (i < 0) return null;
    if (el === no) return ini[i] + (off > 0 ? strs[i].length : 0);
    var rg = document.createRange(); rg.selectNodeContents(el); rg.setEnd(no, off);
    return ini[i] + rg.toString().length;
  };
  var a = pos(r.startContainer, r.startOffset), b = wb === wa ? pos(r.endContainer, r.endOffset) : t;
  if (a === null || b === null || b <= a) return null;
  return { p: Number(wa.getAttribute('data-pg')) - 1, ini: a, fim: b, vario: wb !== wa };
}

/* ---------- tela do leitor ---------- */
var leiS = { petId: null, ver: null, docs: {}, doc: null, sel: null, compor: null, pet: null, foco: null };
var LEI_CSS3 = '.lei-pdf{margin:0 auto;max-width:900px}.lei-pg{margin:0 auto 14px;background:#fff;border-radius:4px;box-shadow:0 1px 8px #0002;overflow:hidden}.lei-pgh{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 10px;background:#F4F6FC;font:600 12px system-ui,sans-serif;color:#6C7593}.lei-pgx{display:flex;gap:6px;align-items:center}' +
  '.lei-pgbt{border:1px solid #DEE3F2;background:#fff;color:#12172A;border-radius:8px;padding:3px 9px;font:700 11px system-ui,sans-serif;cursor:pointer}.lei-pgb{background:#D9A400;color:#fff;border:0;border-radius:9px;padding:0 7px;font:700 11px/18px system-ui,sans-serif;cursor:pointer}' +
  '.lei-pgc{position:relative;line-height:0}.lei-pgc canvas{display:block}.lei-tl{position:absolute;left:0;top:0;overflow:hidden;line-height:1}.lei-tl span,.lei-tl br{position:absolute;white-space:pre;color:transparent;cursor:text;transform-origin:0 0}.lei-tl span::selection{background:#4453D655}' +
  '.lei-tl mark{background:none;color:transparent;position:relative}.lei-tl .lei-pm{background:rgba(255,215,64,.4);border-bottom:2px solid #D9A400;cursor:pointer}.lei-tl .lei-pm.lei-alt{background:rgba(255,160,64,.4);border-bottom:2px dashed #E07B00}.lei-tl .lei-pm.lei-ok{background:rgba(31,138,76,.25);border-bottom:2px solid #1F8A4C}.lei-tl .lei-pm[data-n]::before{content:attr(data-n);position:absolute;left:-2px;top:-12px;font:700 10px/1 system-ui,sans-serif;background:#D9A400;color:#fff;border-radius:8px;padding:2px 5px}';
var LEI_CSS2 = '#overlayPetLeitor .modal{max-width:1260px;width:97vw;height:94vh;display:flex;flex-direction:column}#overlayPetLeitor .modal-body{flex:1 1 auto;min-height:0;max-height:none!important;overflow:hidden;display:flex;flex-direction:column;gap:8px;padding:8px 14px 12px}' +
  '.lei-topo{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;justify-content:space-between;margin:0;font-size:var(--t2)}.lei-topo>span:first-child{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}.lei-topo label{display:flex;align-items:center;gap:6px}.lei-topo select{max-width:100%;border:1px solid var(--border);border-radius:9px;padding:6px 8px;font:inherit;background:var(--surface);color:var(--ink)}.lei-aviso{color:var(--ink-soft);font-size:var(--t1)}' +
  '.lei-grid{flex:1 1 0;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px}.lei-leitura{position:relative;overflow:auto;background:#E9ECF8;border-radius:12px;padding:12px;min-height:0}.lei-lado{overflow:auto;min-height:0;padding-right:2px}' +
  '.lei-bolha{position:absolute;z-index:5;background:#12172A;color:#fff;border:0;border-radius:10px;padding:8px 14px;font:700 13px system-ui,sans-serif;box-shadow:0 4px 14px #0005;cursor:pointer;white-space:nowrap}' +
  '.lei-rod{display:flex;flex-wrap:wrap;gap:8px;margin:0}.lei-rod .pt-bt{margin:0;flex:1;min-width:150px;padding:10px}' +
  '.lei-card{border:1px solid var(--border);border-left:4px solid #D9A400;border-radius:10px;padding:8px 10px;margin:0 0 8px;background:var(--surface);font-size:var(--t2);cursor:pointer}.lei-card.lei-c-alt{border-left-color:#E07B00}.lei-card.lei-c-ok{border-left-color:#1F8A4C}.lei-card.lei-c-perd{border-left-color:#B42323}.lei-card.lei-foco{box-shadow:0 0 0 3px #4453D655}' +
  '.lei-q{display:block;color:#8a6a00;font-size:var(--t1);font-style:italic;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lei-t{white-space:pre-wrap;line-height:1.4}.lei-mt{color:var(--ink-soft);font-size:var(--t1);margin-top:4px}.lei-nb{display:inline-block;background:#D9A400;color:#fff;border-radius:9px;padding:0 6px;font:700 11px/16px system-ui,sans-serif;margin-right:4px}' +
  '.lei-tag{display:inline-block;border-radius:99px;padding:1px 8px;font-size:10.5px;font-weight:800;margin-left:4px}.lei-g-ab{background:#FBEFD2;color:#8A5A0B}.lei-g-pr{background:#DCE6FF;color:#2F3E9E}.lei-g-ok{background:#DDF3E5;color:#16683A}.lei-g-alt{background:#FFE3C2;color:#9A4F00}.lei-g-pe{background:#FDE3E3;color:#B42323}' +
  '.lei-bts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.lei-bts button{border:1px solid var(--border);background:var(--surface);color:var(--ink);border-radius:9px;padding:5px 10px;font:700 12px system-ui,sans-serif;cursor:pointer}' +
  '.lei-compor{border:2px solid #4453D6;border-radius:12px;padding:10px;margin-bottom:10px;background:var(--surface)}.lei-compor textarea{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:9px;padding:8px;font:inherit;font-size:var(--t3);margin:6px 0;background:var(--bg);color:var(--ink)}' +
  '.lei-ref{font-size:var(--t1);color:#2F3E9E;font-weight:700;margin-bottom:3px}.lei-msg{padding:30px 12px;text-align:center;color:var(--ink-soft);font-size:var(--t3)}.lei-dica{color:var(--ink-soft);font-size:var(--t1);margin:0 0 8px}' +
  '@media(max-width:860px){.lei-grid{grid-template-columns:1fr;grid-template-rows:minmax(0,2fr) minmax(0,1fr)}.lei-leitura{padding:6px}#overlayPetLeitor .modal{width:100vw;height:96vh}}';
function leiChave(){ return leiS.petId + ':' + leiS.ver; }
function leiPet(){ return ptS.itens.filter(function(p){ return p.id === leiS.petId; })[0] || null; }
function leiAbrir(petId){
  leiInjetarCss(); if (!document.getElementById('leiCss2')){ var st = document.createElement('style'); st.id = 'leiCss2'; st.textContent = LEI_CSS2 + LEI_CSS3; document.head.appendChild(st); }
  var p = ptS.itens.filter(function(x){ return x.id === petId; })[0]; if (!p) return;
  leiS.petId = petId; leiS.ver = p.versoes[p.versoes.length - 1].n; leiS.sel = null; leiS.compor = null;
  var ov = sgMontar('overlayPetLeitor', 'Ler e comentar o texto');
  if (!ov.getAttribute('data-leiok')){
    ov.setAttribute('data-leiok', '1');
    ov.addEventListener('click', function(e){ leiClique(e); });
    ov.addEventListener('change', function(e){ if (e.target && e.target.id === 'leiVer'){ leiS.ver = Number(e.target.value); leiS.sel = null; leiS.compor = null; leiCarregar(); } });
    ov.addEventListener('mousedown', function(e){ if (e.target.closest && e.target.closest('.lei-bolha')) e.preventDefault(); });
    var t; document.addEventListener('selectionchange', function(){ clearTimeout(t); t = setTimeout(leiAoSelecionar, 180); });
    window.addEventListener('resize', function(){ if (ov.classList.contains('show')) leiDesenharTudo(); });
  }
  ov.classList.add('show');
  qs('overlayPetLeitorC').innerHTML = '<div class="lei-msg">Abrindo o texto…</div>';
  leiCarregar();
}
function leiCarregar(){
  var p = leiPet(), v = p && p.versoes.filter(function(x){ return x.n === leiS.ver; })[0]; if (!v) return;
  var k = leiChave();
  if (leiS.docs[k]){ leiS.doc = leiS.docs[k]; return leiDesenharTudo(); }
  var ler = v.tipo === 'pdf' ? leiLerPdf : leiLerDocx;
  leiS.doc = null; qs('overlayPetLeitorC').innerHTML = '<div class="lei-msg">Abrindo o texto…</div>';
  fetch('/api/peticoes/' + p.id + '/arquivo?v=' + v.n, { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ if (!r.ok) throw new Error('Não consegui baixar o arquivo.'); return r.arrayBuffer(); })
    .then(ler).then(function(d){ leiS.docs[k] = d; leiS.doc = d; leiDesenharTudo(); })
    .catch(function(e){ leiDesenharTudo('Não consegui ler este arquivo (' + e.message + '). Baixe o original.'); });
}
/* comentários com posição nesta versão (ordenados pela posição) + os gerais */
function leiComentarios(p){
  var doc = leiS.doc, lista = [];
  p.comentarios.forEach(function(c){
    if (c.v > leiS.ver) return;
    var o = { c: c, estado: c.estado || 'aberto', pos: null, como: '' };
    if (c.ancora && doc){ var r = leiReancorar(c.ancora, doc); o.como = r.como; if (r.como !== 'perdido') o.pos = r; }
    lista.push(o);
  });
  var com = lista.filter(function(o){ return o.pos; }).sort(function(a, b){ return a.pos.p - b.pos.p || a.pos.ini - b.pos.ini; });
  com.forEach(function(o, i){ o.n = i + 1; });
  return { todos: lista, marcados: com, soltos: lista.filter(function(o){ return !o.pos; }) };
}
function leiPodeComentar(p){ return p.estado === 'a_corrigir' && p.souRevisor && leiS.ver === p.versoes[p.versoes.length - 1].n && !!leiS.doc; }
function leiDesenharTudo(msg){
  var p = leiPet(), c = qs('overlayPetLeitorC'); if (!p || !c) return;
  var h = '<div class="lei-topo"><span><label>Versão <select id="leiVer">' + p.versoes.slice().reverse().map(function(v){ return '<option value="' + v.n + '"' + (v.n === leiS.ver ? ' selected' : '') + '>v' + v.n + ' · ' + escapeHtml(v.nome) + '</option>'; }).join('') + '</select></label> <a class="pt-baixar" href="/api/peticoes/' + p.id + '/arquivo?v=' + leiS.ver + '" download>Baixar o original</a></span>' +
    '<span class="lei-aviso">' + (leiS.doc && leiS.doc.tipo === 'pdf' ? 'Página do PDF como foi enviada; selecione o texto para comentar.' : 'Leitura simplificada: o arquivo original é a versão oficial.') + '</span></div>';
  if (msg){ c.innerHTML = h + '<div class="lei-msg">' + escapeHtml(msg) + '</div>'; return; }
  var cs = leiComentarios(p), podeC = leiPodeComentar(p), souAutor = p.souAutor && !p.souRevisor;
  h += '<div class="lei-grid"><div class="lei-leitura" id="leiLeitura"></div><div class="lei-lado" id="leiLado"></div></div>';
  var abertos = p.comentarios.filter(function(x){ return (x.estado || 'aberto') !== 'resolvido'; }).length;
  if (p.souRevisor && p.estado === 'a_corrigir') h += '<div class="lei-rod"><button type="button" class="pt-bt pt-ouro" data-lei="devolver">Devolver para ajustes' + (p.comentarios.filter(function(x){ return x.papel === 'revisor' && x.v === p.versoes[p.versoes.length - 1].n; }).length ? '' : '') + '</button><button type="button" class="pt-bt" data-lei="aprovar">Aprovar' + (abertos ? ' (' + abertos + ' em aberto)' : '') + '</button></div>';
  var rolagem = qs('leiLeitura') ? qs('leiLeitura').scrollTop : 0, rolLado = qs('leiLado') ? qs('leiLado').scrollTop : 0;
  c.innerHTML = h;
  leiDesenharLeitura(cs); leiDesenharLado(p, cs, podeC);
  if (rolagem && qs('leiLeitura')) qs('leiLeitura').scrollTop = rolagem;
  if (rolLado && qs('leiLado')) qs('leiLado').scrollTop = rolLado;   /* resolver um comentário não manda a lista de volta ao primeiro */
}
function leiDesenharLeitura(cs){
  var el = qs('leiLeitura'); if (!el || !leiS.doc) return;
  if (leiS.doc.tipo === 'pdf') return leiDesenharPdf(el, cs);
  var marcas = cs.marcados.map(function(o){ return { p: o.pos.p, ini: o.pos.ini, fim: o.pos.fim, cid: o.c.id, n: o.n, cls: o.estado === 'resolvido' ? 'lei-ok' : (o.como === 'alterado' ? 'lei-alt' : '') }; });
  var topo = el.scrollTop; el.innerHTML = ''; el.appendChild(leiDesenharDoc(leiS.doc, marcas, Math.max(280, el.clientWidth - 24))); el.scrollTop = topo;
}
function leiTagsCard(o){
  var t = o.estado === 'resolvido' ? '<span class="lei-tag lei-g-ok">resolvido</span>' : (o.estado === 'proposto' ? '<span class="lei-tag lei-g-pr">proposto como resolvido</span>' : '<span class="lei-tag lei-g-ab">aberto</span>');
  if (o.c.ancora && o.como === 'alterado') t += '<span class="lei-tag lei-g-alt">trecho mudou</span>';
  if (o.c.ancora && o.como === 'perdido') t += '<span class="lei-tag lei-g-pe">' + (o.c.v < leiS.ver ? 'trecho removido ou reescrito na v' + leiS.ver : 'trecho não encontrado') + '</span>';
  if (o.c.ancora && (o.como === 'igual' || o.como === 'mesmo' || o.como === 'moveu') && o.c.v < leiS.ver) t += '<span class="lei-tag lei-g-ok">no mesmo lugar</span>';
  return t;
}
function leiCardHtml(p, o){
  var c = o.c, bts = '';
  if (p.estado === 'a_corrigir' || p.estado === 'devolvida'){
    if (p.souAutor && !p.souRevisor && o.estado === 'aberto') bts += '<button type="button" data-lei="propor" data-cid="' + c.id + '">Já corrigi</button>';
    if (p.souRevisor && o.estado !== 'resolvido') bts += '<button type="button" data-lei="resolver" data-cid="' + c.id + '">' + (o.estado === 'proposto' ? 'Confirmar resolvido' : 'Marcar resolvido') + '</button>';
    if (p.souRevisor && o.estado !== 'aberto') bts += '<button type="button" data-lei="reabrir" data-cid="' + c.id + '">Reabrir</button>';
    if (leiPodeComentar(p) && c.ancora && o.pos && !o.pos.pagina) bts += '<button type="button" data-lei="novo" data-cid="' + c.id + '">Novo comentário neste trecho</button>';   /* o trecho foi corrigido mas ainda não está bom */
  }
  return '<div class="lei-card' + (o.estado === 'resolvido' ? ' lei-c-ok' : (o.como === 'alterado' ? ' lei-c-alt' : (o.como === 'perdido' ? ' lei-c-perd' : ''))) + '" data-cardid="' + c.id + '">' +
    (c.ancora ? '<span class="lei-q">' + (o.n ? '<span class="lei-nb">' + o.n + '</span>' : '') + '“' + escapeHtml(c.ancora.quote) + '”</span>' : '') +
    (c.ref ? '<div class="lei-ref">↳ novo comentário sobre o ' + (leiS.numDe && leiS.numDe[c.ref] ? 'nº ' + leiS.numDe[c.ref] : 'comentário anterior') + '</div>' : '') +
    (c.ancora && o.como === 'perdido' && c.v < leiS.ver ? '<div class="lei-dica" style="color:#B42323">Este trecho não aparece mais na v' + leiS.ver + ' (foi removido ou reescrito). Se o pedido era para tirar, já está atendido.</div>' : '') +
    '<div class="lei-t">' + escapeHtml(c.texto) + '</div><div class="lei-mt">' + escapeHtml(c.por.nome) + ' · ' + ptDataHora(c.em) + ' · v' + c.v + leiTagsCard(o) + '</div>' + (bts ? '<div class="lei-bts">' + bts + '</div>' : '') + '</div>';
}
/* botão único para resolver tudo: o revisor confirma todos; quem fez a Inicial diz que corrigiu todos os abertos */
function leiTodosHtml(p){
  if (p.estado !== 'a_corrigir' && p.estado !== 'devolvida') return '';
  var pend = p.comentarios.filter(function(x){ return (x.estado || 'aberto') !== 'resolvido'; }).length, ab = p.comentarios.filter(function(x){ return (x.estado || 'aberto') === 'aberto'; }).length;
  if (p.souRevisor && pend) return '<div class="lei-bts" style="margin:0 0 8px"><button type="button" data-lei="todos" data-pta-todos="resolver_todos">Marcar todos como resolvidos (' + pend + ')</button></div>';
  if (p.souAutor && !p.souRevisor && ab) return '<div class="lei-bts" style="margin:0 0 8px"><button type="button" data-lei="todos" data-pta-todos="propor_todos">Já corrigi todos (' + ab + ')</button></div>';
  return '';
}
function leiDesenharLado(p, cs, podeC){
  var el = qs('leiLado'); if (!el) return;
  var h = '';
  if (leiS.compor){
    h += '<div class="lei-compor"><span class="lei-q" style="white-space:normal">“' + escapeHtml(leiS.compor.quote.slice(0, 220)) + '”</span><textarea id="leiTxt" rows="3" maxlength="2000" placeholder="Escreva o comentário sobre este trecho…"></textarea><div class="lei-bts"><button type="button" class="pt-escuro" style="color:#fff;background:#12172A" data-lei="salvar">Salvar comentário</button><button type="button" data-lei="cancelar">Cancelar</button></div></div>';
  } else if (podeC) h += '<p class="lei-dica">Selecione um trecho do texto e toque em “Comentar”.</p>';
  else if (p.estado === 'a_corrigir' && p.souRevisor) h += '<p class="lei-dica">Esta é uma versão anterior: só a versão mais recente recebe comentários novos.</p>';
  h += '<div class="pt-t" style="margin:6px 0">Comentários (' + cs.todos.length + ')</div>' + leiTodosHtml(p);
  if (!cs.todos.length) h += '<div class="pt-vazio">Nenhum comentário ainda.</div>';
  leiS.numDe = {}; cs.marcados.forEach(function(o){ leiS.numDe[o.c.id] = o.n; });
  cs.marcados.concat(cs.soltos).forEach(function(o){ h += leiCardHtml(p, o); });
  el.innerHTML = h;
  if (leiS.compor){ var t = qs('leiTxt'); if (t) t.focus(); }
}
function leiAoSelecionar(){
  var ov = qs('overlayPetLeitor'), raiz = qs('leiLeitura'); if (!ov || !ov.classList.contains('show') || !raiz || leiS.compor) return;
  var b = raiz.querySelector('.lei-bolha'); if (b) b.remove(); leiS.sel = null;
  var p = leiPet(); if (!p || !leiPodeComentar(p)) return;
  var s = leiS.doc.tipo === 'pdf' ? leiSelecaoPdf(raiz) : leiSelecao(raiz); if (!s) return;
  var a = leiAncoraDe(leiS.doc, s.p, s.ini, s.fim); if (!a || !a.quote.trim()) return;
  leiS.sel = a;
  var rg = window.getSelection().getRangeAt(0), rb = rg.getBoundingClientRect(), rr = raiz.getBoundingClientRect();
  var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'lei-bolha'; bt.setAttribute('data-lei', 'comentar'); bt.textContent = '＋ Comentar';
  bt.style.left = Math.max(6, Math.min(raiz.clientWidth - 120, rb.left - rr.left + raiz.scrollLeft)) + 'px'; bt.style.top = Math.max(4, rb.top - rr.top + raiz.scrollTop - 44) + 'px';
  raiz.appendChild(bt);
}
function leiIrPara(sel){ var el = qs('overlayPetLeitorC').querySelector(sel); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return el; }
function leiPiscar(el){ if (!el) return; el.classList.add('lei-foco'); setTimeout(function(){ el.classList.remove('lei-foco'); }, 1600); }
function leiAtualizarDepois(){ ptS.sig = ''; return ptRelerCasos(true).then(ptCarregar).then(function(){ leiDesenharTudo(); }); }
function leiClique(e){
  var a = e.target.closest ? e.target.closest('[data-lei]') : null, p = leiPet();
  if (!a){
    var m = e.target.closest ? e.target.closest('.lei-m, .lei-pm, .lei-pgb') : null;
    if (m){ var cd = m.getAttribute('data-cid'); var c = leiIrPara('[data-cardid="' + cd + '"]'); leiPiscar(c); return; }
    var cardEl = e.target.closest ? e.target.closest('.lei-card') : null;
    if (cardEl){ var mk = qs('overlayPetLeitorC').querySelector('.lei-m[data-cid="' + cardEl.getAttribute('data-cardid') + '"], .lei-pm[data-cid="' + cardEl.getAttribute('data-cardid') + '"], .lei-pgb[data-cid="' + cardEl.getAttribute('data-cardid') + '"]'); if (mk){ mk.scrollIntoView({ block: 'center', behavior: 'smooth' }); leiPiscar(mk); } }
    return;
  }
  if (!p) return; var k = a.getAttribute('data-lei'), cid = a.getAttribute('data-cid');
  var rodar = function(url, corpo, ok){ return esJson(url, 'POST', corpo).then(function(){ if (ok) toast(ok); return leiAtualizarDepois(); }).catch(function(er){ toast(er.message); }); };
  if (k === 'pagina'){ var pg = Number(a.getAttribute('data-pg')); if (!leiPodeComentar(p)) return; leiS.compor = { p: pg - 1, pag: pg, ini: 0, fim: 1, quote: 'Página ' + pg, antes: '', depois: '', paragrafo: '', pagina: true }; leiDesenharLado(p, leiComentarios(p), true); var l2 = qs('leiLado'); if (l2 && l2.scrollIntoView) l2.scrollIntoView({ block: 'nearest' }); return; }
  if (k === 'comentar'){ leiS.compor = leiS.sel; leiS.sel = null; var bo = qs('leiLeitura') && qs('leiLeitura').querySelector('.lei-bolha'); if (bo) bo.remove(); try{ window.getSelection().removeAllRanges(); }catch(x){} leiDesenharLado(p, leiComentarios(p), true); var lado = qs('leiLado'); if (lado && lado.scrollIntoView) lado.scrollIntoView({ block: 'nearest' }); return; }
  if (k === 'novo'){   /* novo comentário sobre o trecho de um comentário que já existe (na versão atual) */
    if (!leiPodeComentar(p)) return; var oc = leiComentarios(p).todos.filter(function(x){ return x.c.id === cid; })[0]; if (!oc || !oc.pos) return;
    var an2 = leiAncoraDe(leiS.doc, oc.pos.p, oc.pos.ini, oc.pos.fim); if (!an2 || !an2.quote.trim()) return;
    leiS.compor = an2; leiS.composRef = cid; leiDesenharLado(p, leiComentarios(p), true); var l3 = qs('leiLado'); if (l3){ l3.scrollTop = 0; } return;
  }
  if (k === 'cancelar'){ leiS.compor = null; leiS.composRef = null; leiDesenharTudo(); return; }
  if (k === 'salvar'){
    var t = (qs('leiTxt') || {}).value || ''; if (!t.trim()){ toast('Escreva o comentário.'); return; }
    var an = leiS.compor, rf = leiS.composRef || ''; leiS.compor = null; leiS.composRef = null; return rodar('/api/peticoes/' + p.id + '/comentar', { texto: t, ancora: an, ref: rf || undefined }, 'Comentário salvo.');
  }
  if (k === 'propor' || k === 'resolver' || k === 'reabrir') return rodar('/api/peticoes/' + p.id + '/resolver', { comentario: cid, acao: k });
  if (k === 'todos'){ var at = a.getAttribute('data-pta-todos'), n = p.comentarios.filter(function(x){ return at === 'resolver_todos' ? (x.estado || 'aberto') !== 'resolvido' : (x.estado || 'aberto') === 'aberto'; }).length; if (!n) return; if (at === 'resolver_todos' && !confirm('Marcar ' + n + (n === 1 ? ' comentário' : ' comentários') + ' como resolvido' + (n === 1 ? '' : 's') + '?')) return; return rodar('/api/peticoes/' + p.id + '/resolver', { acao: at }, n + (n === 1 ? ' comentário' : ' comentários') + (at === 'resolver_todos' ? ' resolvido' + (n === 1 ? '' : 's') + '.' : ' marcado' + (n === 1 ? '' : 's') + ' como corrigido' + (n === 1 ? '' : 's') + '.')); }
  if (k === 'devolver'){
    var ab = p.comentarios.filter(function(x){ return x.papel === 'revisor' && x.v === p.versoes[p.versoes.length - 1].n; }).length;
    if (!ab){ toast('Escreva ao menos um comentário antes de devolver.'); return; }
    return esJson('/api/peticoes/' + p.id + '/devolver', 'POST', {}).then(function(){ toast('Devolvida para ajustes.'); qs('overlayPetLeitor').classList.remove('show'); return ptRecarregarFolha('Devolvida para ajustes. A Inicial voltou para quem a fez.'); }).catch(function(er){ toast(er.message); });
  }
  if (k === 'aprovar'){
    var abertos = p.comentarios.filter(function(x){ return (x.estado || 'aberto') !== 'resolvido'; }).length;
    if (!confirm(abertos ? 'Há ' + abertos + (abertos === 1 ? ' comentário' : ' comentários') + ' ainda não resolvido(s). Aprovar mesmo assim? A Inicial vai para "Aguardando protocolo".' : 'Aprovar a petição? A Inicial vai para "Aguardando protocolo".')) return;
    return esJson('/api/peticoes/' + p.id + '/aprovar', 'POST', {}).then(function(){ toast('Aprovada.'); qs('overlayPetLeitor').classList.remove('show'); return ptRecarregarFolha('Aprovada. A Inicial está em "Aguardando protocolo".'); }).catch(function(er){ toast(er.message); });
  }
}
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { leiLerPdf: leiLerPdf, leiLerDocx: leiLerDocx, leiReancorar: leiReancorar, leiAbrir: leiAbrir, leiS: leiS }); })();
