/* ============================================================
   TAREFAS QUE SE REPETEM (prefixo rp)
   Só tarefas repetem (prazo e audiência têm data legal). A tarefa guarda `repete`:
     { tipo: 'util' | 'semana' | 'mes' | 'outro', dias: [0-6] (semana), diaMes: 1-31 | 'ultimo' (mês), intervalo: N, unidade: 'dia' | 'semana' | 'mes' (outro),
       fim: { tipo: 'nunca' | 'data' | 'vezes', data, vezes }, proxUtil: true, ancora: 'AAAA-MM-DD' (data agendada, sem o ajuste de dia sem expediente),
       n: nº desta ocorrência, serie: id, modelo: { titulo, cliente, processo, obs, avisos, resp, compartilhada } (o que as próximas copiam) }
   Há sempre UMA ocorrência aberta. Ao concluir, o app cria a próxima, presa ao calendário (a segunda continua sendo segunda, mesmo concluindo na quarta)
   e sem acumular atrasadas: se ficou semanas sem concluir, a próxima é a futura mais próxima. Com `proxUtil`, data que cai em dia sem expediente vai para o próximo dia útil.
   ============================================================ */
var RP_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function rpPad(n){ return (n < 10 ? '0' : '') + n; }
function rpAddMeses(iso, n){
  var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, d = Number(iso.slice(8, 10));
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var ult = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return y + '-' + rpPad(m + 1) + '-' + rpPad(Math.min(d, ult));
}
function rpUltimoUtil(ano, mes0){ var d = new Date(Date.UTC(ano, mes0 + 1, 0)).toISOString().slice(0, 10), g = 0; while (pbNaoUtil(d) && g++ < 40) d = pbSoma(d, -1); return d; }
function rpAjustar(iso, rep){ if (rep && rep.proxUtil === false) return iso; var d = iso, g = 0; while (pbNaoUtil(d) && g++ < 60) d = pbSoma(d, 1); return d; }
/* primeira data agendada depois de max(âncora, ref); devolve { agendada, data } (data = já ajustada ao dia sem expediente) ou null (acabou) */
function rpProxima(rep, ancora, ref){
  if (!rep || !pzIso(ancora)) return null;
  var base = ref && ref > ancora ? ref : ancora, ag = '', g = 0;
  if (rep.tipo === 'util'){ ag = base; do { ag = pbSoma(ag, 1); } while (pbNaoUtil(ag) && g++ < 60); }
  else if (rep.tipo === 'semana'){ var dias = (Array.isArray(rep.dias) && rep.dias.length) ? rep.dias : [pbDow(ancora)]; ag = base; for (g = 0; g < 14; g++){ ag = pbSoma(ag, 1); if (dias.indexOf(pbDow(ag)) >= 0) break; } }
  else if (rep.tipo === 'mes'){
    var dmes = rep.diaMes === 'ultimo' ? 'ultimo' : Math.max(1, Math.min(31, Number(rep.diaMes) || Number(ancora.slice(8, 10))));
    for (var k = 0; k < 30; k++){
      var ref0 = rpAddMeses(ancora.slice(0, 7) + '-01', k), y = Number(ref0.slice(0, 4)), m0 = Number(ref0.slice(5, 7)) - 1;
      var cand = dmes === 'ultimo' ? rpUltimoUtil(y, m0) : y + '-' + rpPad(m0 + 1) + '-' + rpPad(Math.min(dmes, new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()));
      if (cand > base){ ag = cand; break; }
    }
  } else {
    var n = Math.max(1, Math.round(Number(rep.intervalo) || 1)), un = rep.unidade === 'mes' ? 'mes' : (rep.unidade === 'semana' ? 'semana' : 'dia'); ag = ancora;
    for (g = 0; g < 4000 && ag <= base; g++) ag = un === 'mes' ? rpAddMeses(ancora, n * (g + 1)) : pbSoma(ag, un === 'semana' ? 7 * n : n);
  }
  if (!ag) return null;
  var fim = rep.fim || {};
  if (fim.tipo === 'data' && pzIso(fim.data) && ag > fim.data) return null;
  if (fim.tipo === 'vezes' && Number(rep.n || 1) >= Number(fim.vezes || 0)) return null;
  return { agendada: ag, data: rep.tipo === 'util' || (rep.tipo === 'mes' && rep.diaMes === 'ultimo') ? ag : rpAjustar(ag, rep) };
}
function rpListar(rep, ancora, k){
  var out = [], r = Object.assign({}, rep), a = ancora;
  for (var i = 0; i < k; i++){ var p = rpProxima(r, a, a); if (!p) break; out.push(p.data); a = p.agendada; r.n = Number(r.n || 1) + 1; }
  return out;
}
function rpTexto(r){
  if (!r) return '';
  var t = '';
  if (r.tipo === 'util') t = 'todo dia útil';
  else if (r.tipo === 'semana'){ var ds = (r.dias && r.dias.length ? r.dias : []).slice().sort(function(a, b){ return a - b; }).map(function(d){ return RP_DIAS[d] + (d === 0 || d === 6 ? '' : '-feira'); }); t = 'toda ' + (ds.length ? ds.join(', ') : 'semana'); }
  else if (r.tipo === 'mes') t = r.diaMes === 'ultimo' ? 'todo mês, no último dia útil' : 'todo mês, no dia ' + r.diaMes;
  else { var n = Number(r.intervalo) || 1, u = { dia: ['dia', 'dias'], semana: ['semana', 'semanas'], mes: ['mês', 'meses'] }[r.unidade] || ['dia', 'dias']; t = 'a cada ' + (n === 1 ? u[0] : n + ' ' + u[1]); }
  var f = r.fim || {}; if (f.tipo === 'data' && f.data) t += ' · até ' + fmtData(f.data); else if (f.tipo === 'vezes' && f.vezes) t += ' · ' + f.vezes + ' vezes (' + (r.n || 1) + 'ª)';
  return t;
}
function rpModelo(d){ return { titulo: d.titulo || '', cliente: d.cliente || '', processo: d.processo || '', obs: d.obs || '', avisos: Array.isArray(d.avisos) ? d.avisos.slice() : AG_PADRAO.slice(), resp: Array.isArray(d.resp) ? d.resp.slice() : [], compartilhada: d.compartilhada === true }; }
/* ---------- ao concluir: cria a próxima ---------- */
function rpCriarProxima(i, depois){
  var rep = i.doc.repete; if (!rep) return Promise.resolve(null);
  var nx = rpProxima(rep, rep.ancora || i.data, agHoje());
  if (!nx) return Promise.resolve(null);
  var mod = rep.modelo || rpModelo(i.doc), novoRep = Object.assign({}, rep, { ancora: nx.agendada, n: Number(rep.n || 1) + 1 });
  var doc = Object.assign({}, i.doc, mod, { data: nx.data, concluido: false, cancelado: false, situacao: 'afazer', concluidoEm: '', concluidoPor: '', protocoladoEm: '', protocoloObs: '', prontaEm: '', prontaPor: '', repete: novoRep, criadaAuto: true, criadoEm: new Date().toISOString() });
  delete doc.id;
  return pbApi('/api/db/agenda', 'POST', doc).then(function(j){ doc.id = j.id; agDocs.push(doc); return { doc: doc, nx: nx }; });
}
function rpDesfazerConclusao(i, novo){
  var p = novo ? pbApi('/api/db/agenda/' + encodeURIComponent(novo.id), 'DELETE').then(function(){ agDocs = agDocs.filter(function(x){ return x.id !== novo.id; }); }) : Promise.resolve();
  return p.then(function(){
    var doc = Object.assign({}, i.doc, { concluido: false, cancelado: false, situacao: 'afazer', concluidoEm: '', concluidoPor: '' }); delete doc.id;
    return pbApi('/api/db/agenda/' + encodeURIComponent(i.id), 'PUT', doc).then(function(){ Object.assign(i.doc, doc); agDepois(); toast('A tarefa voltou a aberta.'); });
  }).catch(function(e){ toast('Não consegui desfazer: ' + ((e && e.message) || '')); });
}
/* reabrir uma ocorrência já concluída: some a próxima que o app criou sozinho (se ninguém mexeu nela) */
function rpRemoverProximaAuto(i){
  var rep = i.doc && i.doc.repete; if (!rep || !rep.serie) return Promise.resolve();
  var l = agDocs.filter(function(d){ return d.id !== i.id && d.repete && d.repete.serie === rep.serie && !d.concluido && d.criadaAuto && (d.situacao || 'afazer') === 'afazer'; });
  return Promise.all(l.map(function(d){ return pbApi('/api/db/agenda/' + encodeURIComponent(d.id), 'DELETE').then(function(){ agDocs = agDocs.filter(function(x){ return x.id !== d.id; }); }); }));
}
/* ---------- editor da tarefa (seção "Repetir") ---------- */
function rpEdHtml(i, ancora){
  var r = (i && i.doc && i.doc.repete) || null, tipo = r ? r.tipo : 'nao', dias = r && r.dias && r.dias.length ? r.dias : [], f = (r && r.fim) || { tipo: 'nunca' };
  var d0 = ancora || agHoje(), chip = function(d){ return '<label class="pb-tg" style="cursor:pointer;margin:2px 4px 2px 0"><input type="checkbox" data-rp="dia" value="' + d + '"' + (dias.indexOf(d) >= 0 ? ' checked' : '') + ' style="margin-right:3px">' + RP_DIAS[d].slice(0, 3) + '</label>'; };
  return '<div class="field" id="age_rep_box" style="display:none;border:1px solid var(--border);border-radius:14px;padding:10px 12px;background:var(--surface-2,#fbfaf6)"><label class="field-label" for="age_rep">↻ Repetir</label>' +
    '<select id="age_rep" class="filter-select" style="width:100%"><option value="nao"' + (tipo === 'nao' ? ' selected' : '') + '>Não repete</option><option value="util"' + (tipo === 'util' ? ' selected' : '') + '>Todo dia útil</option><option value="semana"' + (tipo === 'semana' ? ' selected' : '') + '>Toda semana</option><option value="mes"' + (tipo === 'mes' ? ' selected' : '') + '>Todo mês</option><option value="outro"' + (tipo === 'outro' ? ' selected' : '') + '>Outro (a cada N dias, semanas ou meses)</option></select>' +
    '<div id="age_rep_det" style="display:none">' +
    '<div id="age_rep_sem" style="display:none;margin-top:6px"><div class="saldo-data" style="margin:0 0 3px">Nos dias:</div>' + [1, 2, 3, 4, 5, 6, 0].map(chip).join('') + '</div>' +
    '<div id="age_rep_mes" style="display:none;margin-top:6px"><label class="field-label" for="age_rep_dm">Em qual dia do mês</label><select id="age_rep_dm" class="filter-select" style="width:100%"><option value="data"' + (!r || r.diaMes !== 'ultimo' ? ' selected' : '') + '>No dia da data escolhida</option><option value="ultimo"' + (r && r.diaMes === 'ultimo' ? ' selected' : '') + '>No último dia útil do mês</option></select></div>' +
    '<div id="age_rep_out" style="display:none;margin-top:6px"><label class="field-label">A cada</label><div style="display:flex;gap:8px"><input type="number" id="age_rep_n" min="1" max="365" value="' + escapeHtml(String(r && r.intervalo || 1)) + '" style="width:90px"><select id="age_rep_un" class="filter-select" style="flex:1"><option value="dia"' + (!r || r.unidade === 'dia' || !r.unidade ? ' selected' : '') + '>dias</option><option value="semana"' + (r && r.unidade === 'semana' ? ' selected' : '') + '>semanas</option><option value="mes"' + (r && r.unidade === 'mes' ? ' selected' : '') + '>meses</option></select></div></div>' +
    '<div style="margin-top:6px"><label class="field-label" for="age_rep_fim">Termina</label><select id="age_rep_fim" class="filter-select" style="width:100%"><option value="nunca"' + (f.tipo === 'nunca' || !f.tipo ? ' selected' : '') + '>Nunca</option><option value="data"' + (f.tipo === 'data' ? ' selected' : '') + '>Em uma data</option><option value="vezes"' + (f.tipo === 'vezes' ? ' selected' : '') + '>Depois de N vezes</option></select><input type="date" id="age_rep_fd" value="' + escapeHtml(f.data || '') + '" style="display:none;margin-top:6px"><input type="number" id="age_rep_fv" min="1" max="500" value="' + escapeHtml(String(f.vezes || 5)) + '" style="display:none;margin-top:6px;width:120px"></div>' +
    '<label class="ad-it" style="border:0;padding:6px 0 0"><input type="checkbox" id="age_rep_pu"' + (!r || r.proxUtil !== false ? ' checked' : '') + '><span class="ad-t">Se cair em dia sem expediente, ir para o próximo dia útil</span></label>' +
    (r ? '<div id="age_rep_esc" style="margin-top:6px"><div class="saldo-data" style="margin:0 0 3px">Ao salvar, valer para:</div><label class="ad-it" style="border:0;padding:2px 0"><input type="radio" name="age_rep_esc" value="prox" checked><span class="ad-t">Esta e as próximas</span></label><label class="ad-it" style="border:0;padding:2px 0"><input type="radio" name="age_rep_esc" value="esta"><span class="ad-t">Só esta</span></label></div>' : '') +
    '<div class="saldo-data" id="age_rep_prox" style="margin-top:6px"></div></div></div>';
}
function rpEdLer(){
  var s = qs('age_rep'); if (!s || s.value === 'nao') return null;
  var tipo = s.value, dias = Array.prototype.slice.call(document.querySelectorAll('#age_rep_box [data-rp="dia"]:checked')).map(function(c){ return Number(c.value); }), fim = qs('age_rep_fim').value;
  var data = qs('age_data') ? qs('age_data').value : '';
  return { tipo: tipo, dias: tipo === 'semana' ? (dias.length ? dias : (pzIso(data) ? [pbDow(data)] : [1])) : [], diaMes: tipo === 'mes' ? (qs('age_rep_dm').value === 'ultimo' ? 'ultimo' : (pzIso(data) ? Number(data.slice(8, 10)) : 1)) : '', intervalo: tipo === 'outro' ? Math.max(1, Math.round(Number(qs('age_rep_n').value) || 1)) : 1, unidade: tipo === 'outro' ? qs('age_rep_un').value : '',
    fim: fim === 'data' ? { tipo: 'data', data: qs('age_rep_fd').value } : (fim === 'vezes' ? { tipo: 'vezes', vezes: Math.max(1, Math.round(Number(qs('age_rep_fv').value) || 1)) } : { tipo: 'nunca' }), proxUtil: qs('age_rep_pu').checked };
}
function rpEdAtualizar(){
  var box = qs('age_rep_box'); if (!box) return;
  var mostrar = agEditTipo === 'tarefa'; box.style.display = mostrar ? '' : 'none';
  var tipo = qs('age_rep').value, det = qs('age_rep_det'); det.style.display = tipo === 'nao' ? 'none' : '';
  qs('age_rep_sem').style.display = tipo === 'semana' ? '' : 'none'; qs('age_rep_mes').style.display = tipo === 'mes' ? '' : 'none'; qs('age_rep_out').style.display = tipo === 'outro' ? '' : 'none';
  var fim = qs('age_rep_fim').value; qs('age_rep_fd').style.display = fim === 'data' ? '' : 'none'; qs('age_rep_fv').style.display = fim === 'vezes' ? '' : 'none';
  var sem = tipo === 'semana' && !document.querySelector('#age_rep_box [data-rp="dia"]:checked'); if (sem){ var d = qs('age_data').value; if (pzIso(d)){ var c = document.querySelector('#age_rep_box [data-rp="dia"][value="' + pbDow(d) + '"]'); if (c) c.checked = true; } }
  var r = rpEdLer(), p = qs('age_rep_prox'), d0 = qs('age_data').value;
  if (!r || !pzIso(d0)){ p.textContent = ''; return; }
  var l = rpListar(Object.assign({}, r, { n: 1 }), d0, 4);
  p.innerHTML = l.length ? 'Próximas: <b>' + l.map(function(x){ return escapeHtml(agAbrevDia(x)); }).join('</b> · <b>') + '</b>' : 'Não há próximas datas (o fim já foi atingido).';
}
function rpEdIniciar(){
  var box = qs('age_rep_box'); if (!box || box.getAttribute('data-ok')) { rpEdAtualizar(); return; }
  box.setAttribute('data-ok', '1');
  box.addEventListener('change', rpEdAtualizar); box.addEventListener('input', rpEdAtualizar);
  if (qs('age_data')) qs('age_data').addEventListener('change', rpEdAtualizar);
  rpEdAtualizar();
}
/* monta o `repete` que vai no documento ao salvar: i = item existente (ou null), doc = o que está sendo salvo */
function rpMontarRepete(i, doc){
  var cfg = rpEdLer(), antigo = i && i.doc && i.doc.repete; if (!cfg) return null;
  var esc = document.querySelector('input[name="age_rep_esc"]:checked'), soEsta = !!antigo && esc && esc.value === 'esta';
  var mesmaCfg = antigo && JSON.stringify([antigo.tipo, antigo.dias, antigo.diaMes, antigo.intervalo, antigo.unidade, antigo.fim, antigo.proxUtil]) === JSON.stringify([cfg.tipo, cfg.dias, cfg.diaMes, cfg.intervalo, cfg.unidade, cfg.fim, cfg.proxUtil]);
  if (antigo && soEsta) return antigo;   /* só esta: a série (e o que as próximas copiam) fica como estava */
  var rep = Object.assign({}, cfg, { n: antigo ? Number(antigo.n || 1) : 1, serie: antigo && antigo.serie ? antigo.serie : 'rp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ancora: antigo && mesmaCfg && antigo.ancora ? antigo.ancora : doc.data });
  rep.modelo = rpModelo(doc);
  return rep;
}
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { rpProxima: rpProxima, rpListar: rpListar, rpTexto: rpTexto }); })();
