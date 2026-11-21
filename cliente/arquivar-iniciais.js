/* Arquivar só a inicial, em lote, a partir das colunas do quadro das Iniciais, e sub-abas na tela Arquivados.
   Arquivar a inicial NÃO arquiva o processo (que continua em Processos); o que ainda há a receber continua na Central de atenção e nas finanças.
   Colunas com o botão "Arquivar antigas…": Protocolado e as de "desfecho/quitação" (os nomes das colunas são personalizáveis). */
var aiS = { col: '', dias: 30, marcadas: {}, colunasDoLote: [] };

function aiColunaAntiga(k){ return k === 'protocolado' || /desfecho|quita/i.test(String(STATUS_LABEL[k] || '')); }
function aiDiasEm(c){
  var d = String(c.statusDesde || c.criadoEm || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return Math.max(0, Math.round((Date.parse(todayISO()) - Date.parse(d)) / 864e5));
}
/* iniciais de uma coluna (as que aparecem no quadro) com pelo menos "dias" na coluna; dias = 0 traz todas, inclusive as sem data */
function aiCandidatas(cols, dias){
  var pm = pendentesPorDoc();
  return casos.filter(function(c){
    if (c.arquivado || c.concluido || c.doProcesso) return false;
    var st = statusDe(c); if (cols.indexOf(st) < 0) return false;
    if (!dias) return true;
    var n = aiDiasEm(c); return n !== null && n >= dias;
  }).map(function(c){ var p = pm['caso|' + c.id] || { receber: 0 }; return { c: c, dias: aiDiasEm(c), receber: r2(p.receber) }; })
    .sort(function(a, b){ return (b.dias === null ? -1 : b.dias) - (a.dias === null ? -1 : a.dias); });
}
function aiAbrir(k){
  aiS.col = k || 'protocolado';
  aiS.colunasDoLote = STATUS_ORDEM.filter(aiColunaAntiga);
  aiS.dias = 30; aiS.marcadas = {};
  var ov = sgMontar('overlayArqIni', 'Arquivar iniciais'); ov.querySelector('h2').textContent = 'Arquivar iniciais';
  if (!ov.getAttribute('data-ai')){ ov.setAttribute('data-ai', '1'); ov.addEventListener('click', aiClique); }
  aiMarcarTodas(true); aiDesenhar(); ov.classList.add('show');
}
function aiLista(){ return aiCandidatas(aiS.col === '*' ? aiS.colunasDoLote : [aiS.col], aiS.dias); }
function aiMarcarTodas(on){ aiS.marcadas = {}; if (on) aiLista().forEach(function(x){ aiS.marcadas[x.c.id] = true; }); }
function aiDesenhar(){
  var lista = aiLista(), sel = lista.filter(function(x){ return aiS.marcadas[x.c.id]; }).length;
  var rot = aiS.col === '*' ? 'das colunas de acompanhamento' : 'na coluna “' + (STATUS_LABEL[aiS.col] || '') + '”';
  var chipsDias = [[7, '7 dias'], [15, '15 dias'], [30, '30 dias'], [60, '60 dias'], [0, 'Todas']].map(function(d){ return '<button type="button" class="pbdg-c' + (aiS.dias === d[0] ? ' on' : '') + '" data-ai="dias" data-v="' + d[0] + '">' + d[1] + '</button>'; }).join('');
  var chipsCol = aiS.colunasDoLote.length > 1 ? '<div class="field"><label class="field-label">Coluna</label><div class="pbdg-ch">' + aiS.colunasDoLote.map(function(k){ return '<button type="button" class="pbdg-c' + (aiS.col === k ? ' on' : '') + '" data-ai="col" data-v="' + escapeHtml(k) + '">' + escapeHtml(STATUS_LABEL[k]) + '</button>'; }).join('') + '<button type="button" class="pbdg-c' + (aiS.col === '*' ? ' on' : '') + '" data-ai="col" data-v="*">Todas essas</button></div></div>' : '';
  var h = chipsCol + '<div class="field"><label class="field-label">Na coluna há mais de</label><div class="pbdg-ch">' + chipsDias + '</div></div>' +
    '<div class="ai-topo"><span><b>' + lista.length + (lista.length === 1 ? ' inicial</b> encontrada' : ' iniciais</b> encontradas') + '</span>' + (lista.length ? '<button type="button" class="btn-text" data-ai="todas">' + (sel === lista.length ? 'Desmarcar todas' : 'Marcar todas') + '</button>' : '') + '</div>' +
    (lista.length ? '<div class="ai-lista">' + lista.map(function(x){
      var c = x.c, sub = [c.nomeAcao || '', (STATUS_LABEL[statusDe(c)] || '') + (x.dias !== null ? ' há ' + x.dias + (x.dias === 1 ? ' dia' : ' dias') : ' (sem data)')].filter(Boolean).join(' · ');
      return '<label class="ai-li"><input type="checkbox" data-ai="uma" data-id="' + escapeHtml(c.id) + '"' + (aiS.marcadas[c.id] ? ' checked' : '') + '><span><b>' + escapeHtml(c.cliente || 'Sem nome') + '</b><small>' + escapeHtml(sub) + '</small></span><span class="ai-ch ' + (x.receber > 0.004 ? 'pend' : 'ok') + '">' + (x.receber > 0.004 ? fmtMoeda(x.receber) + ' a receber' : 'quitada') + '</span></label>';
    }).join('') + '</div>' : '<div class="saldo-data" style="margin:10px 0">Nenhuma inicial ' + rot + ' com esse tempo. Escolha “Todas” para ver todas.</div>') +
    '<div class="ai-nota">Só a <b>inicial</b> é arquivada: o processo continua em Processos. O que ainda tiver a receber continua na Central de atenção e nas finanças. Dá para desarquivar em Arquivados › Iniciais.</div>' +
    '<div class="form-error" id="ai_erro"></div><div class="f-rod-in"><button type="button" class="btn btn-ghost" data-ai="cancelar">Cancelar</button><button type="button" class="btn btn-primary" data-ai="arquivar"' + (sel ? '' : ' disabled') + '>' + (sel ? 'Arquivar ' + sel + (sel === 1 ? ' inicial' : ' iniciais') : 'Nada marcado') + '</button></div>';
  qs('overlayArqIniC').innerHTML = h;
}
function aiClique(ev){
  var b = ev.target.closest ? ev.target.closest('[data-ai]') : null; if (!b) return;
  var a = b.getAttribute('data-ai'), ov = qs('overlayArqIni');
  if (a === 'dias'){ aiS.dias = parseInt(b.getAttribute('data-v'), 10) || 0; aiMarcarTodas(true); aiDesenhar(); }
  else if (a === 'col'){ aiS.col = b.getAttribute('data-v'); aiMarcarTodas(true); aiDesenhar(); }
  else if (a === 'todas'){ var todas = aiLista().every(function(x){ return aiS.marcadas[x.c.id]; }); aiMarcarTodas(!todas); aiDesenhar(); }
  else if (a === 'uma'){ var id = b.getAttribute('data-id'); if (b.checked) aiS.marcadas[id] = true; else delete aiS.marcadas[id]; aiDesenhar(); }
  else if (a === 'cancelar') ov.classList.remove('show');
  else if (a === 'arquivar') aiArquivar();
}
function aiArquivar(){
  var ids = aiLista().filter(function(x){ return aiS.marcadas[x.c.id]; }).map(function(x){ return x.c.id; });
  if (!ids.length) return;
  var agora = new Date().toISOString(), docs = ids.map(function(id){ return casos.filter(function(c){ return c.id === id; })[0]; }).filter(Boolean);
  var bt = qs('overlayArqIni').querySelector('[data-ai="arquivar"]'); if (bt) bt.disabled = true;
  Promise.all(docs.map(function(c){ return persistPatchDoc('caso', c, { arquivado: true, arquivadoEm: agora }); })).then(function(){
    qs('overlayArqIni').classList.remove('show');
    toast(ids.length + (ids.length === 1 ? ' inicial arquivada.' : ' iniciais arquivadas.') + ' Os processos continuam em Processos.', 'Desfazer', function(){
      ids.forEach(function(id){ var c = casos.filter(function(x){ return x.id === id; })[0]; if (c) persistPatchDoc('caso', c, { arquivado: false, arquivadoEm: null }); });
    });
  }).catch(function(e){ var er = qs('ai_erro'); if (er) er.textContent = 'Não consegui arquivar: ' + e.message; if (bt) bt.disabled = false; });
}

/* ---------- Arquivados: sub-abas no lugar do filtro "Tipo" ---------- */
function arqSubRender(){
  var box = qs('arqSub'); if (!box) return;
  var n = { caso: casos.filter(function(c){ return c.arquivado; }).length, acordo: acordos.filter(function(c){ return c.arquivado; }).length, alvara: alvaras.filter(function(c){ return c.arquivado; }).length, processo: 0 };
  try{ n.processo = prDocs.filter(function(d){ return d.arquivado; }).length; }catch(e){}
  var abas = [['todos', 'Todos', n.caso + n.acordo + n.alvara + n.processo], ['caso', 'Iniciais', n.caso], ['acordo', 'Acordos', n.acordo], ['alvara', 'Alvarás', n.alvara], ['processo', 'Processos', n.processo]];
  box.innerHTML = mdBarraHtml(abas, arqFiltro.tipo, function(v){ return 'data-arqsub="' + v + '"'; });
  try{ mdRolarAtivas(); }catch(e){}
}

document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-arq-antigas]') : null;
  if (b){ ev.stopPropagation(); aiAbrir(b.getAttribute('data-arq-antigas')); return; }
  var s = ev.target.closest ? ev.target.closest('[data-arqsub]') : null;
  if (s){ arqFiltro.tipo = s.getAttribute('data-arqsub'); var sel = qs('filtroArqTipo'); if (sel) sel.value = arqFiltro.tipo; renderArquivados(); return; }
  var p = ev.target.closest ? ev.target.closest('[data-arq-proc]') : null;
  if (p){ ev.stopPropagation(); setActiveTab('processos'); setTimeout(function(){ try{ prAbrir(prNum(p.getAttribute('data-arq-proc'))); }catch(e){} }, 150); }
}, true);   // captura: os cartões e fichas interrompem o clique antes do document

(function(){
  var cab = qs('headArquivados');
  if (cab && !qs('arqSub')){ var d = document.createElement('div'); d.id = 'arqSub'; d.style.margin = '4px 0 10px'; var f = cab.querySelector('.filters'); if (f) f.insertAdjacentElement('beforebegin', d); else cab.appendChild(d); }
  var sel = qs('filtroArqTipo'); if (sel) sel.style.display = 'none';   // o filtro "Tipo" virou a barra de sub-abas
  var _ra = renderArquivados; renderArquivados = function(){ _ra.apply(this, arguments); arqSubRender(); };
  var st = document.createElement('style');
  st.textContent = '.ai-topo{display:flex;justify-content:space-between;align-items:center;margin:12px 0 2px;font-size:12.5px;color:var(--ink-soft)}' +
    '.ai-lista{border-top:1px solid var(--border);margin-top:6px}.ai-li{display:grid;grid-template-columns:24px 1fr auto;gap:10px;align-items:start;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer}' +
    '.ai-li input{width:20px;height:20px;margin-top:2px;accent-color:var(--ink,#0f1011)}.ai-li small{display:block;color:var(--ink-soft);font-size:11.5px;margin-top:1px}' +
    '.ai-ch{border-radius:99px;padding:2px 9px;font-size:11px;font-weight:700;white-space:nowrap;align-self:start}.ai-ch.pend{background:#fdf1d8;color:#8a5a00}.ai-ch.ok{background:#e6f3ec;color:#17714a}' +
    '.ai-nota{background:var(--surface-2,#f2f3f6);border-radius:12px;padding:9px 11px;font-size:12px;line-height:1.45;margin-top:12px}[data-arq-antigas]{flex:none;min-height:36px}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { aiAbrir: aiAbrir, aiCandidatas: function(cols, dias){ return aiCandidatas(cols, dias).map(function(x){ return { id: x.c.id, dias: x.dias, receber: x.receber }; }); } });
})();
