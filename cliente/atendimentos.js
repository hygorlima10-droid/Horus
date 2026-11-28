/* ============================================================
   ATENDIMENTOS (prefixo at): gravar a reunião com o cliente, guardar o áudio, transcrever e gerar a "Ficha de atendimento".
   Servidor: src/atendimentos.js (áudio em trechos no R2, Whisper do Workers AI) e src/resumo-atendimento.js (resumo; reserva: Claude).
   Quem usa: proprietário e advogado. Aparece na ficha do cliente (bloco "Atendimentos"), na ficha da Inicial ("Atendimento de origem"), na Linha do tempo e em Configurações › Transcrição.
   Gravação: o navegador grava em TRECHOS de 3 minutos (cada um é um arquivo completo); cada trecho sobe assim que fecha e fica também guardado no aparelho (IndexedDB) até o
   servidor confirmar, então uma queda de internet, do app ou da bateria não perde a reunião. O iPhone só grava com a tela ligada (o app pede para a tela não apagar).
   O app NÃO escreve a petição: a transcrição e a ficha são apoio de consulta, com o horário de cada trecho e destaque de números, datas e nomes.
   ============================================================ */
var AT_SEG_MS = 180000;   /* duração de cada trecho gravado */
var AT_MAX_UP = 24 * 1024 * 1024;   /* o servidor aceita até 25 MB por trecho */
var AT_SECOES = [['quem', 'Quem'], ['fatos', 'Fatos, em ordem'], ['pedidos', 'O que o cliente quer'], ['valoresDatas', 'Valores e datas citados'], ['documentos', 'Documentos'], ['pendencias', 'Pendências e dúvidas'], ['prazos', 'Prazos a verificar']];
var atCache = {};   /* lista por cliente: { itens, em } */
var atS = { view: '', id: '', det: null, aba: 'texto', busca: '', form: null, rec: null, msg: '', processando: '', confirma: '', erro: '', provedores: [] };

function atPode(){ try{ var p = ppPapel(); return p === 'proprietario' || p === 'advogado'; }catch(e){ return false; } }
function atTempo(s){ s = Math.max(0, Math.round(Number(s) || 0)); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); }
function atDurTxt(s){ s = Math.round(Number(s) || 0); if (s < 60) return s + ' s'; var m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min'; }
function atTam(b){ b = Number(b) || 0; return b >= 1073741824 ? (b / 1073741824).toFixed(1).replace('.', ',') + ' GB' : (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'); }
function atApi(path, metodo, corpo){
  var op = { method: metodo || 'GET', headers: {}, credentials: 'same-origin' };
  if (corpo !== undefined){ op.headers['content-type'] = 'application/json'; op.body = JSON.stringify(corpo); }
  return fetch('/api/atendimentos' + path, op).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok){ var e = new Error((j.error && j.error.message) || j.erro || 'Não deu certo.'); e.status = r.status; e.dados = j; throw e; } return j; }); });
}

/* ---------- guarda local dos trechos até o servidor confirmar ---------- */
function atBd(){
  return new Promise(function(ok, no){
    try{ var q = indexedDB.open('horus-atendimentos', 1); q.onupgradeneeded = function(){ q.result.createObjectStore('trechos'); }; q.onsuccess = function(){ ok(q.result); }; q.onerror = function(){ no(q.error); }; }catch(e){ no(e); }
  });
}
function atBdOp(modo, fn){ return atBd().then(function(db){ return new Promise(function(ok, no){ var tx = db.transaction('trechos', modo), st = tx.objectStore('trechos'), r = fn(st); tx.oncomplete = function(){ ok(r && r.result); db.close(); }; tx.onerror = function(){ no(tx.error); db.close(); }; }); }); }
function atGuardar(id, n, blob, dur){ return atBdOp('readwrite', function(st){ return st.put({ id: id, n: n, blob: blob, dur: dur, mime: blob.type }, id + ':' + n); }).catch(function(){}); }
function atApagarLocal(id, n){ return atBdOp('readwrite', function(st){ return st.delete(id + ':' + n); }).catch(function(){}); }
function atPendentesLocais(){ return atBdOp('readonly', function(st){ return st.getAll(); }).then(function(l){ return l || []; }).catch(function(){ return []; }); }

/* ---------- envio de um trecho (com novas tentativas) ---------- */
function atEnviarTrecho(id, n, blob, dur){
  var tent = 0;
  function uma(){
    return fetch('/api/atendimentos/' + encodeURIComponent(id) + '/trecho/' + n + '?dur=' + Math.round(dur || 0), { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': (blob.type || 'audio/mp4').split(';')[0] === 'video/webm' ? 'audio/webm' : (blob.type || 'audio/mp4') }, body: blob }).then(function(r){
      if (r.ok) return r.json();
      return r.json().catch(function(){ return {}; }).then(function(j){ var e = new Error((j.error && j.error.message) || 'Não consegui enviar o trecho.'); e.status = r.status; throw e; });
    }).catch(function(e){
      if (e.status && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) throw e;   /* erro definitivo (tamanho, tipo, limite): não adianta repetir */
      if (++tent >= 4) throw e;
      return new Promise(function(ok){ setTimeout(ok, 1500 * tent * tent); }).then(uma);
    });
  }
  return uma();
}

/* ---------- gravação ---------- */
function atMime(){
  if (typeof MediaRecorder === 'undefined') return '';
  var c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (var i = 0; i < c.length; i++){ try{ if (MediaRecorder.isTypeSupported(c[i])) return c[i]; }catch(e){} }
  return '';
}
function atGravacaoSuportada(){ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined'); }
function atRecIniciar(atId){
  var R = { id: atId, stream: null, rec: null, mime: atMime(), n: 0, decorrido: 0, segIni: 0, tick: null, segTimer: null, pausado: false, parou: false, fila: Promise.resolve(), enviados: 0, falhas: 0, wake: null, interrompido: false, nivel: null };
  atS.rec = R;
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function(stream){
    R.stream = stream;
    stream.getAudioTracks().forEach(function(t){ t.addEventListener('ended', function(){ if (!R.parou){ R.interrompido = true; atRecParar(); } }); });
    try{ if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function(w){ R.wake = w; }).catch(function(){}); }catch(e){}
    atRecSegmento(R);
    R.tick = setInterval(function(){ if (!R.pausado && !R.parou) atRecDesenhar(); }, 1000);
    return R;
  });
}
function atRecDuracao(R){ return R.decorrido + (R.pausado || R.parou || !R.segIni ? 0 : (Date.now() - R.segIni) / 1000); }
function atRecSegmento(R){
  var chunks = [], opc = { audioBitsPerSecond: 32000 }; if (R.mime) opc.mimeType = R.mime;
  var rec; try{ rec = new MediaRecorder(R.stream, opc); }catch(e){ rec = new MediaRecorder(R.stream); }
  R.rec = rec; R.segIni = Date.now();
  rec.ondataavailable = function(e){ if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = function(){
    clearTimeout(R.segTimer);
    var dur = (Date.now() - R.segIni) / 1000; R.decorrido += dur;
    var tipo = (rec.mimeType || R.mime || 'audio/webm'); var blob = new Blob(chunks, { type: tipo });
    var n = R.n++;
    if (blob.size) atRecEnfileirar(R, n, blob, dur);
    if (!R.parou && !R.pausado) atRecSegmento(R); else R.segIni = 0;
    if (R.parou) atRecFinalizar(R);
  };
  rec.start();
  R.segTimer = setTimeout(function(){ try{ if (rec.state !== 'inactive') rec.stop(); }catch(e){} }, AT_SEG_MS);
}
function atRecEnfileirar(R, n, blob, dur){
  atGuardar(R.id, n, blob, dur);
  R.fila = R.fila.then(function(){
    return atEnviarTrecho(R.id, n, blob, dur).then(function(){ R.enviados++; atApagarLocal(R.id, n); atRecDesenhar(); }).catch(function(e){ R.falhas++; R.erroEnvio = e.message; atRecDesenhar(); });
  });
}
function atRecPausar(){ var R = atS.rec; if (!R || R.pausado || R.parou) return; R.pausado = true; try{ if (R.rec && R.rec.state !== 'inactive') R.rec.stop(); }catch(e){} atRecDesenhar(); }
function atRecRetomar(){ var R = atS.rec; if (!R || !R.pausado || R.parou) return; R.pausado = false; atRecSegmento(R); atRecDesenhar(); }
function atRecParar(){
  var R = atS.rec; if (!R || R.parou) return; R.parou = true;
  try{ if (R.rec && R.rec.state !== 'inactive') R.rec.stop(); else atRecFinalizar(R); }catch(e){ atRecFinalizar(R); }
}
function atRecFinalizar(R){
  if (R.finalizado) return; R.finalizado = true;
  clearInterval(R.tick); clearTimeout(R.segTimer);
  try{ R.stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} try{ if (R.wake) R.wake.release(); }catch(e){}
  atS.view = 'enviando'; atS.msg = 'Guardando o áudio…'; atDesenhar();
  R.fila.then(function(){
    if (R.falhas){ atS.erro = 'Alguns trechos não subiram (' + (R.erroEnvio || 'sem conexão') + '). Eles continuam guardados neste aparelho: toque em "Enviar trechos pendentes".'; atS.view = 'detalhe'; return atAbrir(R.id, true); }
    atS.rec = null; return atProcessar(R.id);
  });
}

/* transcrição (um trecho por chamada) e depois a ficha */
function atProcessar(id){
  atS.id = id; atS.view = 'processando'; atS.erro = ''; atS.processando = 'Transcrevendo…'; atDesenhar();
  function passo(total){
    return atApi('/' + encodeURIComponent(id) + '/transcrever', 'POST', {}).then(function(r){
      if (r.feito === null || r.feito === undefined) return;
      var falta = r.faltam || 0, feitos = total - falta; atS.processando = 'Transcrevendo… ' + feitos + ' de ' + total; atDesenhar();
      return falta > 0 ? passo(total) : undefined;
    });
  }
  return atApi('/' + encodeURIComponent(id)).then(function(d){
    var pend = (d.trechos || []).filter(function(t){ return t.temAudio; }).length - (d.nTranscritos || 0);
    return pend > 0 ? passo(pend) : undefined;
  }).then(function(){
    atS.processando = 'Montando a ficha de atendimento…'; atDesenhar();
    return atApi('/' + encodeURIComponent(id) + '/resumir', 'POST', {}).catch(function(e){ atS.erro = 'A transcrição ficou pronta, mas a ficha não saiu agora: ' + e.message; });
  }).catch(function(e){ atS.erro = e.message + ' O áudio está guardado: abra o atendimento e toque em "Transcrever de novo".'; }).then(function(){ atS.processando = ''; atLimpaCache(); return atAbrir(id, true); });
}
function atLimpaCache(){ atCache = {}; }

/* ---------- enviar um áudio gravado em outro lugar ---------- */
function atDuracaoDoArquivo(file){
  return new Promise(function(ok){
    try{ var u = URL.createObjectURL(file), a = document.createElement('audio'); a.preload = 'metadata'; a.onloadedmetadata = function(){ var d = a.duration; URL.revokeObjectURL(u); ok(Number.isFinite(d) ? d : 0); }; a.onerror = function(){ URL.revokeObjectURL(u); ok(0); }; a.src = u; }catch(e){ ok(0); }
  });
}
function atEnviarArquivo(file){
  var f = atS.form; if (!f) return;
  if (file.size > AT_MAX_UP){ atS.erro = 'O arquivo tem ' + atTam(file.size) + ' e o limite é de 24 MB. No iPhone, em Gravador › Editar gravação › Opções, escolha a qualidade "Compacta" e envie de novo; ou grave direto por aqui, que o app divide sozinho.'; atDesenhar(); return; }
  atS.erro = ''; atS.view = 'enviando'; atS.msg = 'Enviando o áudio…'; atDesenhar();
  atCriar(f).then(function(d){
    return atDuracaoDoArquivo(file).then(function(dur){ return atEnviarTrecho(d.id, 0, file, dur).then(function(){ return atProcessar(d.id); }); });
  }).catch(function(e){ atS.view = 'novo'; atS.erro = e.message; atDesenhar(); });
}
function atCriar(f){
  return atApi('', 'POST', { titulo: (f.titulo || '').trim() || 'Atendimento', clienteId: f.clienteId || '', casoId: f.casoId || '' }).then(function(d){ atLimpaCache(); return d; });
}

/* ---------- janelas ---------- */
function atClientesOpts(sel){
  var l = (clientes || []).filter(function(c){ return !c.arquivado; }).sort(function(a, b){ return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  return '<option value="">Sem cliente ainda (vincular depois)</option>' + l.map(function(c){ return '<option value="' + escapeHtml(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + escapeHtml(c.nome) + '</option>'; }).join('');
}
function atCasosOpts(cid, sel){
  var l = (casos || []).filter(function(c){ return (!cid || (c.clienteIds || []).indexOf(cid) >= 0) && c.tipo === 'inicial'; });
  return '<option value="">Nenhuma Inicial (opcional)</option>' + l.map(function(c){ return '<option value="' + escapeHtml(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + escapeHtml((c.cliente || 'Sem nome') + (c.nomeAcao ? ' · ' + c.nomeAcao : '')) + '</option>'; }).join('');
}
function atAbrirNovo(pre){
  if (!atPode()) return;
  atS.form = { clienteId: (pre && pre.clienteId) || '', casoId: (pre && pre.casoId) || '', titulo: '' }; atS.erro = ''; atS.view = 'novo'; atS.id = '';
  qs('overlayAt').classList.add('show'); atDesenhar();
}
function atFechar(){
  if (atS.rec && !atS.rec.finalizado && !atS.rec.parou){ atS.confirma = 'sair'; atDesenhar(); return; }
  qs('overlayAt').classList.remove('show'); atParaAudio(); atS.view = ''; atS.id = ''; atS.confirma = '';
}
function atAbrir(id, sem){
  if (!sem){ qs('overlayAt').classList.add('show'); }
  atS.id = id; atS.view = 'detalhe'; atS.aba = atS.aba || 'texto'; atS.busca = '';
  return atApi('/' + encodeURIComponent(id)).then(function(d){ atS.det = d; atS.provedores = d.provedores || []; atDesenhar(); }).catch(function(e){ atS.det = null; atS.erro = e.message; atDesenhar(); });
}

/* destaque de números, valores, datas e nomes (só marca; não muda o texto) */
function atDestaque(txt, busca){
  var s = escapeHtml(txt);
  s = s.replace(/(R\$\s?[\d.]+(?:,\d{1,2})?|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d[\d.,]*\d\b|\b\d{2,}\b)/g, '<mark class="at-hl">$1</mark>');
  s = s.replace(/(^|[.!?]\s+|<\/mark>\s*)?((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do|dos|das|e)\s+)?){2,})/g, function(m, pre, nome){ return (pre || '') + (pre && /[.!?]/.test(pre) ? nome : '<mark class="at-hl at-nome">' + nome.replace(/\s+$/, '') + '</mark> '); });
  if (busca){ try{ var re = new RegExp('(' + escapeHtml(busca).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); s = ('>' + s + '<').replace(/>([^<]*)</g, function(m, t){ return '>' + t.replace(re, '<mark class="at-busca">$1</mark>') + '<'; }).slice(1, -1); }catch(e){} }
  return s;
}
function atStatusChip(d){
  var m = { gravando: ['sem áudio', 'a'], enviado: ['a transcrever', 'a'], parcial: ['transcrevendo ' + d.nTranscritos + '/' + d.nTrechos, 'a'], pronto: ['pronto', 'v'] }[d.status] || [d.status, 'a'];
  return '<span class="lc-chip' + (m[1] === 'v' ? ' ok' : '') + '">' + escapeHtml(m[0]) + '</span>';
}

function atDesenhar(){
  var b = qs('atBody'); if (!b) return;
  var t = qs('atTitulo');
  if (atS.view === 'novo'){ t.textContent = 'Novo atendimento'; b.innerHTML = atNovoHtml(); }
  else if (atS.view === 'gravando'){ t.textContent = 'Gravando'; b.innerHTML = atGravandoHtml(); }
  else if (atS.view === 'enviando' || atS.view === 'processando'){ t.textContent = 'Atendimento'; b.innerHTML = '<div class="at-espera"><div class="at-spin" aria-hidden="true"></div><b>' + escapeHtml(atS.processando || atS.msg || 'Aguarde…') + '</b><div class="saldo-data">Pode continuar usando o app: o atendimento fica guardado e aparece na ficha do cliente.</div>' + (atS.erro ? '<div class="at-erro">' + escapeHtml(atS.erro) + '</div>' : '') + '</div>'; }
  else if (atS.view === 'detalhe'){ t.textContent = (atS.det && atS.det.titulo) || 'Atendimento'; b.innerHTML = atDetalheHtml(); atLigarPlayer(); }
  else if (atS.view === 'config'){ t.textContent = 'Transcrição'; b.innerHTML = atConfigHtml(); }
  if (atS.confirma === 'sair'){ b.insertAdjacentHTML('afterbegin', '<div class="at-erro">Está gravando. Parar e guardar agora?<div class="lc-acts"><button type="button" class="btn btn-primary" data-at="parar">Parar e guardar</button><button type="button" class="btn btn-ghost" data-at="continuar">Continuar gravando</button></div></div>'); }
}
function atNovoHtml(){
  var f = atS.form || {}, ok = atGravacaoSuportada();
  return '<div class="f-sec"><div class="f-sec-t">Quem é o atendimento</div>' +
    '<div class="field"><label class="field-label" for="atCli">Cliente</label><select id="atCli" class="ext-sel">' + atClientesOpts(f.clienteId) + '</select></div>' +
    '<div class="field"><label class="field-label" for="atCaso">Inicial</label><select id="atCaso" class="ext-sel">' + atCasosOpts(f.clienteId, f.casoId) + '</select></div>' +
    '<div class="field"><label class="field-label" for="atTit">Assunto</label><input type="text" id="atTit" maxlength="120" placeholder="Ex.: Demissão sem justa causa" value="' + escapeHtml(f.titulo || '') + '"></div></div>' +
    (atS.erro ? '<div class="at-erro">' + escapeHtml(atS.erro) + '</div>' : '') +
    '<div class="lc-acts">' + (ok ? '<button type="button" class="btn btn-primary" data-at="gravar">● Gravar</button>' : '') +
    '<button type="button" class="btn btn-ghost" data-at="enviar-audio">Enviar áudio</button><input type="file" id="atArq" accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.opus" hidden></div>' +
    '<div class="at-aviso">' + (ok ? '<b>Deixe a tela ligada</b> durante a gravação: o iPhone para de gravar se a tela apagar ou se entrar uma ligação. O áudio sobe de 3 em 3 minutos; se algo falhar, o que já subiu fica guardado.' : 'Este navegador não grava áudio. Use "Enviar áudio" com uma gravação do aplicativo Gravador do celular.') + '</div>' +
    '<div class="at-aviso">Prefere gravar no aplicativo Gravador ou Notas do celular? Toque em <b>Enviar áudio</b> e escolha o arquivo (até 24 MB; no iPhone, use a qualidade "Compacta").</div>' +
    '<div id="atPend"></div>';
}
function atGravandoHtml(){
  var R = atS.rec; if (!R) return '';
  var d = atRecDuracao(R);
  return '<div class="at-rec"><div class="at-tempo" id="atTempo">' + atTempo(d) + '</div>' +
    '<div class="at-ponto' + (R.pausado ? ' pausado' : '') + '" aria-hidden="true"></div><div class="at-estado" id="atEstado">' + (R.pausado ? 'Pausado' : 'Gravando') + '</div>' +
    '<div class="lc-acts at-centro">' + (R.pausado ? '<button type="button" class="btn btn-ghost" data-at="retomar">Retomar</button>' : '<button type="button" class="btn btn-ghost" data-at="pausar">Pausar</button>') + '<button type="button" class="btn btn-primary" data-at="parar">Finalizar e guardar</button></div>' +
    '<div class="saldo-data at-centro" id="atEnv">' + atEnvTxt(R) + '</div>' +
    (R.interrompido ? '<div class="at-erro">O microfone foi interrompido (ligação, outro aplicativo ou permissão). O que já foi gravado está sendo guardado.</div>' : '') +
    '<div class="at-aviso"><b>Deixe a tela ligada.</b> Não troque de aplicativo durante a gravação.</div></div>';
}
function atEnvTxt(R){ return (R.enviados ? '✓ ' + R.enviados + (R.enviados === 1 ? ' trecho guardado' : ' trechos guardados') + ' no servidor' : 'O primeiro trecho sobe aos 3 minutos') + (R.falhas ? ' · ' + R.falhas + ' com falha (tentaremos de novo ao finalizar)' : ''); }
function atRecDesenhar(){
  var R = atS.rec; if (!R || atS.view !== 'gravando') return;
  var a = qs('atTempo'); if (!a){ atDesenhar(); return; }
  a.textContent = atTempo(atRecDuracao(R)); var e = qs('atEnv'); if (e) e.textContent = atEnvTxt(R);
  var s = qs('atEstado'); if (s) s.textContent = R.pausado ? 'Pausado' : 'Gravando';
  var pausado = R.pausado, bt = document.querySelector('#atBody [data-at="pausar"],#atBody [data-at="retomar"]');
  if (bt && ((pausado && bt.getAttribute('data-at') === 'pausar') || (!pausado && bt.getAttribute('data-at') === 'retomar'))) atDesenhar();
}

/* ---------- detalhe: player + abas ---------- */
function atDetalheHtml(){
  var d = atS.det; if (!d) return '<div class="financeiro-vazio">' + escapeHtml(atS.erro || 'Atendimento não encontrado.') + '</div>';
  var cli = d.clienteId ? clienteById(d.clienteId) : null, caso = d.casoId ? (casos || []).filter(function(c){ return c.id === d.casoId; })[0] : null;
  var h = '<div class="at-cab"><b>' + escapeHtml(d.titulo) + '</b> ' + atStatusChip(d) + '<div class="saldo-data">' + escapeHtml(fmtData(d.data)) + ' · ' + atDurTxt(d.dur) + (cli ? ' · ' + escapeHtml(cli.nome) : '') + (caso ? ' · Inicial: ' + escapeHtml(caso.nomeAcao || caso.cliente || '') : '') + '</div></div>';
  if (atS.erro) h += '<div class="at-erro">' + escapeHtml(atS.erro) + '</div>';
  var temAudio = (d.trechos || []).some(function(t){ return t.temAudio; });
  if (temAudio) h += '<div class="at-player"><button type="button" class="btn btn-ghost at-play" data-at="play" id="atPlay" aria-label="Tocar ou pausar">▶</button><input type="range" id="atSeek" min="0" max="' + Math.max(1, Math.round(d.dur)) + '" value="0" step="1" aria-label="Posição do áudio"><span class="at-hora" id="atHora">00:00 / ' + atTempo(d.dur) + '</span></div><audio id="atAudio" preload="none"></audio>';
  else if (d.nTrechos) h += '<div class="at-aviso">O áudio deste atendimento foi apagado; a transcrição continua guardada.</div>';
  h += '<div class="fl-filtros"><button type="button" class="seg-btn' + (atS.aba === 'texto' ? ' active' : '') + '" data-at="aba" data-v="texto">Transcrição</button><button type="button" class="seg-btn' + (atS.aba === 'ficha' ? ' active' : '') + '" data-at="aba" data-v="ficha">Ficha</button><button type="button" class="seg-btn' + (atS.aba === 'dados' ? ' active' : '') + '" data-at="aba" data-v="dados">Dados</button></div>';
  if (atS.aba === 'texto') h += atTextoHtml(d); else if (atS.aba === 'ficha') h += atFichaHtml(d); else h += atDadosHtml(d);
  return h;
}
function atTextoHtml(d){
  var h = '';
  if (!d.itens.length){
    h += '<div class="financeiro-vazio">' + (d.nComAudio ? 'Ainda sem transcrição.' : 'Sem transcrição.') + '</div>';
    if (d.nComAudio) h += '<div class="lc-acts"><button type="button" class="btn btn-primary" data-at="transcrever">Transcrever agora</button></div>';
    return h;
  }
  h += '<div class="saldo-data">Transcrição automática (Whisper). <b>Confira os trechos importantes</b>: números, datas e nomes saem marcados.</div>';
  h += '<input type="search" id="atBusca" class="ext-sel at-busca-in" placeholder="Buscar na conversa (ex.: aviso prévio)" value="' + escapeHtml(atS.busca) + '" aria-label="Buscar na conversa">';
  var q = atS.busca.trim().toLowerCase(), l = d.itens.filter(function(i){ return !q || String(i.texto).toLowerCase().indexOf(q) >= 0; });
  if (!l.length) h += '<div class="financeiro-vazio">Nada encontrado.</div>';
  l.forEach(function(i){
    h += '<div class="at-fala"><button type="button" class="btn-text pb-b at-t" data-at="tocar" data-t="' + Math.round(i.ini) + '">' + atTempo(i.ini) + ' ▶</button><span class="at-tx">' + atDestaque(i.texto, q) + '</span></div>';
  });
  return h;
}
function atFichaHtml(d){
  var r = d.resumo, h = '';
  if (!r){
    var tem = d.itens.length > 0;
    h += '<div class="financeiro-vazio">' + (tem ? 'A ficha ainda não foi gerada.' : 'Primeiro é preciso ter a transcrição.') + '</div>';
    if (tem) h += '<div class="lc-acts"><button type="button" class="btn btn-primary" data-at="resumir"' + (atS.processando ? ' disabled' : '') + '>Gerar a ficha de atendimento</button></div>';
    return h;
  }
  h += '<div class="at-aviso">Gerada por inteligência artificial (' + escapeHtml(r.provedor === 'claude' ? 'Claude' : 'modelo aberto da Cloudflare') + ') a partir da transcrição. <b>Confira nos trechos</b>: cada item tem o horário de onde veio. O que não foi dito aparece como "não mencionado".</div>';
  AT_SECOES.forEach(function(s){
    var l = (r.secoes && r.secoes[s[0]]) || []; if (!l.length) return;
    h += '<div class="at-sec"><div class="plano-tit">' + s[1] + '</div>' + l.map(function(it){
      return '<div class="at-it"><span class="at-tx">' + escapeHtml(it.texto) + (it.conferir ? ' <span class="lc-chip neg">conferir</span>' : '') + '</span>' + (it.t != null ? '<button type="button" class="btn-text pb-b at-t" data-at="tocar" data-t="' + it.t + '">' + atTempo(it.t) + ' ▶</button>' : '') + '</div>';
    }).join('') + '</div>';
  });
  if ((r.naoMencionado || []).length) h += '<div class="at-sec"><div class="plano-tit">Não mencionado na conversa</div><div class="at-nm">' + r.naoMencionado.map(function(x){ return '<span class="lc-chip">' + escapeHtml(x) + '</span>'; }).join(' ') + '</div></div>';
  h += '<div class="lc-acts"><button type="button" class="btn btn-ghost" data-at="copiar-ficha">Copiar a ficha</button><button type="button" class="btn btn-ghost" data-at="resumir"' + (atS.processando ? ' disabled' : '') + '>Gerar de novo</button></div>';
  return h;
}
function atDadosHtml(d){
  var conf = atS.confirma;
  return '<div class="f-sec"><div class="f-sec-t">Dados do atendimento</div>' +
    '<div class="field"><label class="field-label" for="atEdTit">Assunto</label><input type="text" id="atEdTit" maxlength="120" value="' + escapeHtml(d.titulo) + '"></div>' +
    '<div class="field"><label class="field-label" for="atEdData">Data</label><input type="date" id="atEdData" value="' + escapeHtml(d.data) + '"></div>' +
    '<div class="field"><label class="field-label" for="atEdCli">Cliente</label><select id="atEdCli" class="ext-sel">' + atClientesOpts(d.clienteId) + '</select></div>' +
    '<div class="field"><label class="field-label" for="atEdCaso">Inicial</label><select id="atEdCaso" class="ext-sel">' + atCasosOpts(d.clienteId, d.casoId) + '</select></div>' +
    '<div class="lc-acts"><button type="button" class="btn btn-primary" data-at="salvar-dados">Salvar</button></div></div>' +
    '<div class="f-sec"><div class="f-sec-t">Áudio e transcrição</div><div class="saldo-data">' + d.nTrechos + (d.nTrechos === 1 ? ' trecho' : ' trechos') + ' · ' + atTam(d.tam) + ' · transcrição: ' + d.nTranscritos + ' de ' + d.nTrechos + '</div>' +
    '<div class="lc-acts">' + (d.nComAudio ? '<button type="button" class="btn btn-ghost" data-at="transcrever-de-novo">Transcrever de novo</button>' : '') +
    (conf === 'audio' ? '<span class="saldo-data">Apagar só o áudio?</span><button type="button" class="btn btn-ghost acao-excluir" data-at="apagar-audio-sim">Sim, apagar o áudio</button><button type="button" class="btn btn-ghost" data-at="cancelar-conf">Cancelar</button>' : (d.nComAudio ? '<button type="button" class="btn btn-ghost acao-excluir" data-at="apagar-audio">Apagar só o áudio</button>' : '')) +
    (conf === 'tudo' ? '<span class="saldo-data">Apagar o atendimento inteiro?</span><button type="button" class="btn btn-ghost acao-excluir" data-at="apagar-tudo-sim">Sim, apagar tudo</button><button type="button" class="btn btn-ghost" data-at="cancelar-conf">Cancelar</button>' : '<button type="button" class="btn btn-ghost acao-excluir" data-at="apagar-tudo">Apagar o atendimento</button>') + '</div></div>';
}

/* player: toca os trechos em sequência; o botão de cada fala vai para aquele instante */
var atPl = { pos: 0, tocando: false, idx: -1 };
function atInicios(d){ var t = 0, out = []; (d.trechos || []).forEach(function(x){ out.push({ i: x.i, ini: t, dur: x.dur || 0, temAudio: x.temAudio }); t += x.dur || 0; }); return out; }
function atParaAudio(){ var a = qs('atAudio'); if (a){ try{ a.pause(); }catch(e){} } atPl.tocando = false; }
function atIrPara(seg, off, tocar){
  var d = atS.det, a = qs('atAudio'); if (!d || !a || seg < 0) return;
  var ini = atInicios(d)[seg]; if (!ini || !ini.temAudio) return;
  atPl.idx = seg;
  var corrigir = function(){ try{ a.currentTime = Math.max(0, off || 0); }catch(e){} if (tocar !== false){ var p = a.play(); if (p && p.catch) p.catch(function(){}); atPl.tocando = true; atAtualizaPlay(); } };
  if (a.getAttribute('data-seg') !== String(d.trechos[seg].i)){ a.setAttribute('data-seg', String(d.trechos[seg].i)); a.src = '/api/atendimentos/' + encodeURIComponent(d.id) + '/trecho/' + d.trechos[seg].i; a.addEventListener('loadedmetadata', function f(){ a.removeEventListener('loadedmetadata', f); corrigir(); }); a.load(); }
  else corrigir();
}
function atTocarEm(t){
  var d = atS.det; if (!d) return; var ini = atInicios(d), seg = 0;
  for (var i = 0; i < ini.length; i++){ if (t >= ini[i].ini) seg = i; }
  atIrPara(seg, t - ini[seg].ini, true);
}
function atAtualizaPlay(){ var b = qs('atPlay'); if (b) b.textContent = atPl.tocando ? '❚❚' : '▶'; }
function atLigarPlayer(){
  var a = qs('atAudio'), d = atS.det; if (!a || !d) return;
  var seek = qs('atSeek'), hora = qs('atHora');
  a.addEventListener('timeupdate', function(){ var ini = atInicios(d)[atPl.idx]; if (!ini) return; var abs = ini.ini + a.currentTime; if (seek && document.activeElement !== seek) seek.value = String(Math.round(abs)); if (hora) hora.textContent = atTempo(abs) + ' / ' + atTempo(d.dur); });
  a.addEventListener('ended', function(){ var ini = atInicios(d), prox = ini.slice(atPl.idx + 1).filter(function(x){ return x.temAudio; })[0]; if (prox) atIrPara(ini.indexOf(prox), 0, true); else { atPl.tocando = false; atAtualizaPlay(); } });
  a.addEventListener('pause', function(){ if (!a.ended){ atPl.tocando = false; atAtualizaPlay(); } }); a.addEventListener('play', function(){ atPl.tocando = true; atAtualizaPlay(); });
  if (seek) seek.addEventListener('change', function(){ atTocarEm(Number(seek.value) || 0); });
}

/* ---------- Configurações › Transcrição ---------- */
function atConfigHtml(){
  var c = atS.cfg || {}, u = c.uso || {};
  var prov = function(p){ return '<div class="row-item at-linha"><span><b>' + escapeHtml(p.nome) + '</b><small>' + escapeHtml(p.papel) + '</small></span><span class="lc-chip ' + (p.ligado ? 'ok' : 'neg') + '">' + (p.ligado ? 'ligado' : 'desligado') + '</span></div>'; };
  var dias = [[0, 'nunca'], [30, '30 dias'], [60, '60 dias'], [90, '90 dias'], [180, '180 dias'], [365, '1 ano']];
  return '<div class="f-sec"><div class="f-sec-t">Quem faz o quê</div>' +
    prov({ nome: 'Transcrição: Whisper (Cloudflare)', papel: 'principal · grátis até cerca de 214 minutos de áudio por dia', ligado: !!(c.provedores || []).some(function(p){ return p.id === 'cloudflare'; }) }) +
    prov({ nome: 'Ficha de atendimento: modelo aberto (Cloudflare)', papel: 'principal · sem retenção de dados', ligado: !!(c.resumoProvedores || []).some(function(p){ return p.id === 'cloudflare'; }) }) +
    prov({ nome: 'Ficha de atendimento: Claude', papel: 'reserva · usa a mesma chave que já lê documentos', ligado: !!(c.resumoProvedores || []).some(function(p){ return p.id === 'claude'; }) }) +
    '<div class="at-aviso">A transcrição não separa quem fala (cliente e advogado). A ficha de atendimento resume o que o cliente narrou, sempre com o horário de cada item.</div></div>' +
    '<div class="f-sec"><div class="f-sec-t">Áudios guardados</div><div class="saldo-data">' + (u.nAtend != null ? u.nAtend + (u.nAtend === 1 ? ' atendimento' : ' atendimentos') + ' · ' + atTam(u.bytes) + ' de áudio (limite gratuito do armazenamento: 10 GB)' : 'Carregando…') + '</div>' +
    (ppDono() ? '<div class="field"><label class="field-label" for="atDias">Apagar o áudio (mantendo a transcrição) depois de</label><select id="atDias" class="ext-sel">' + dias.map(function(x){ return '<option value="' + x[0] + '"' + (Number(c.apagarAudioDias || 0) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
    '<div class="saldo-data">Padrão: nunca. Se escolher um prazo, o app apaga sozinho uma vez por dia.</div>' : '<div class="saldo-data">' + (Number(c.apagarAudioDias) ? 'O proprietário definiu apagar o áudio depois de ' + c.apagarAudioDias + ' dias (a transcrição fica).' : 'O áudio fica guardado até você apagá-lo.') + '</div>') + '</div>';
}
function atAbrirConfig(){
  if (!atPode()) return;
  atS.view = 'config'; atS.cfg = {}; qs('overlayAt').classList.add('show'); atDesenhar();
  Promise.all([atApi('/config'), atApi('')]).then(function(r){ atS.cfg = Object.assign({}, r[0], { provedores: r[1].provedores, resumoProvedores: r[1].resumoProvedores }); if (atS.view === 'config') atDesenhar(); }).catch(function(e){ toast(e.message); });
}

/* ---------- bloco na ficha do cliente e na da Inicial ---------- */
function atCarregarCliente(cid){
  if (!atPode() || !window.__SERVIDOR) return;
  var c = atCache[cid]; if (c && (c.carregando || Date.now() - c.em < 60000)) return;
  atCache[cid] = { itens: c ? c.itens : null, em: Date.now(), carregando: true };
  atApi('?cliente=' + encodeURIComponent(cid)).then(function(r){ atCache[cid] = { itens: r.itens || [], em: Date.now() }; }).catch(function(){ atCache[cid] = { itens: [], em: Date.now() }; }).then(function(){
    try{ if (qs('overlayClientePerfil').classList.contains('show')) renderPerfil(); }catch(e){}
    try{ if (qs('overlayLc') && qs('overlayLc').classList.contains('show') && typeof lcDesenhar === 'function') lcDesenhar(); }catch(e){}
  });
}
function atLinhaHtml(d){
  return '<div class="cli-item"><div class="t"><span>' + escapeHtml(d.titulo) + '</span>' + atStatusChip(d) + '</div><div class="s">' + escapeHtml(fmtData(d.data)) + ' · ' + atDurTxt(d.dur) + '</div><div class="bt"><button type="button" data-at="abrir" data-id="' + escapeHtml(d.id) + '">Abrir</button></div></div>';
}
function atPerfilHtml(cid){
  if (!atPode()) return '';
  atCarregarCliente(cid);
  var c = atCache[cid], l = (c && c.itens) || [];
  return '<details class="cli-sec" data-sec="atendimentos"' + (perfilAbertos['atendimentos'] ? ' open' : '') + '><summary><span>Atendimentos' + (c && c.itens ? ' (' + l.length + ')' : '') + '</span></summary><div class="cli-sec-body">' +
    '<div class="lc-acts"><button type="button" class="btn btn-primary" data-at="novo" data-cli="' + escapeHtml(cid) + '">● Novo atendimento</button></div>' +
    (c && c.itens ? (l.length ? l.map(atLinhaHtml).join('') : '<div class="s" style="color:var(--ink-soft);font-size:var(--t3);">Nenhum atendimento gravado ainda.</div>') : '<div class="s" style="color:var(--ink-soft);font-size:var(--t3);">Carregando…</div>') + '</div></details>';
}
var atInicialId = '';
function atInicialAtualizar(id){
  atInicialId = id || '';
  var box = qs('atInicialBox'); if (!box) return;
  if (!id || !atPode()){ box.innerHTML = ''; return; }
  var caso = (casos || []).filter(function(c){ return c.id === id; })[0]; if (!caso){ box.innerHTML = ''; return; }
  box.innerHTML = '<div class="f-sec"><div class="f-sec-t">Atendimento de origem</div><div class="saldo-data">Carregando…</div></div>';
  atApi('?caso=' + encodeURIComponent(id)).then(function(r){
    if (atInicialId !== id) return;
    var l = r.itens || [];
    box.innerHTML = '<div class="f-sec"><div class="f-sec-t">Atendimento de origem</div>' + (l.length ? l.map(atLinhaHtml).join('') : '<div class="saldo-data">Nenhum atendimento ligado a esta Inicial.</div>') +
      '<div class="lc-acts"><button type="button" class="btn btn-primary" data-at="novo" data-caso="' + escapeHtml(id) + '" data-cli="' + escapeHtml((caso.clienteIds || [])[0] || '') + '">● Gravar atendimento</button></div></div>';
  }).catch(function(){ box.innerHTML = ''; });
}

/* ---------- eventos ---------- */
(function(){
  var ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'overlayAt';
  ov.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="atTitulo">Atendimento</h2><button class="icon-btn" id="atFecha" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="atBody"></div></div>';
  document.body.appendChild(ov);
  qs('atFecha').addEventListener('click', atFechar);
  ov.addEventListener('click', function(e){ if (e.target === ov) atFechar(); });
  ov.addEventListener('input', function(e){ if (e.target.id === 'atBusca'){ atS.busca = e.target.value; var pos = e.target.selectionStart; atDesenhar(); var n = qs('atBusca'); if (n){ n.focus(); try{ n.setSelectionRange(pos, pos); }catch(er){} } } if (e.target.id === 'atTit' && atS.form) atS.form.titulo = e.target.value; });
  ov.addEventListener('change', function(e){
    var id = e.target.id;
    if (id === 'atCli' && atS.form){ atS.form.clienteId = e.target.value; atS.form.casoId = ''; var tt = qs('atTit'); if (tt) atS.form.titulo = tt.value; atDesenhar(); }
    else if (id === 'atCaso' && atS.form){ atS.form.casoId = e.target.value; var c = (casos || []).filter(function(x){ return x.id === e.target.value; })[0]; if (c && !atS.form.clienteId && (c.clienteIds || [])[0]) atS.form.clienteId = c.clienteIds[0]; var t2 = qs('atTit'); if (t2) atS.form.titulo = t2.value; atDesenhar(); }
    else if (id === 'atEdCli' && atS.det){ atS.det.clienteId = e.target.value; atS.det.casoId = ''; var s1 = qs('atEdCaso'); if (s1) s1.innerHTML = atCasosOpts(e.target.value, ''); }
    else if (id === 'atArq' && e.target.files && e.target.files[0]){ var tt2 = qs('atTit'); if (atS.form && tt2) atS.form.titulo = tt2.value; atEnviarArquivo(e.target.files[0]); }
    else if (id === 'atDias'){ atApi('/config', 'PUT', { apagarAudioDias: Number(e.target.value) || 0 }).then(function(){ toast('Guardado.'); }).catch(function(er){ toast(er.message); }); }
  });
})();
document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('[data-at]') : null; if (!b || b.disabled) return;
  var a = b.getAttribute('data-at'), v = b.getAttribute('data-v') || '';
  if (a === 'novo'){ if (typeof lcFechar === 'function' && b.closest('#overlayLc')) lcFechar(); atAbrirNovo({ clienteId: b.getAttribute('data-cli') || '', casoId: b.getAttribute('data-caso') || '' }); atMostrarPendentes(); }
  else if (a === 'abrir'){ atS.aba = 'texto'; atS.erro = ''; atAbrir(b.getAttribute('data-id')); }
  else if (!b.closest('#overlayAt')) return;
  else if (a === 'gravar'){
    var f = atS.form || {}; var tt = qs('atTit'); if (tt) f.titulo = tt.value;
    b.disabled = true;
    atCriar(f).then(function(d){ return atRecIniciar(d.id).then(function(){ atS.view = 'gravando'; atS.erro = ''; atDesenhar(); }); }).catch(function(er){
      atS.rec = null; atS.view = 'novo'; atS.erro = (er && er.name === 'NotAllowedError') ? 'O microfone foi bloqueado. Libere o microfone para este site nas configurações do navegador e tente de novo.' : (er && er.name === 'NotFoundError' ? 'Não encontrei um microfone neste aparelho.' : ((er && er.message) || 'Não consegui começar a gravar.')); atDesenhar();
    });
  }
  else if (a === 'enviar-audio'){ var inp = qs('atArq'); if (inp) inp.click(); }
  else if (a === 'pausar') atRecPausar();
  else if (a === 'retomar') atRecRetomar();
  else if (a === 'parar'){ atS.confirma = ''; atRecParar(); }
  else if (a === 'continuar'){ atS.confirma = ''; atDesenhar(); }
  else if (a === 'aba'){ atS.aba = v; atDesenhar(); }
  else if (a === 'tocar') atTocarEm(Number(b.getAttribute('data-t')) || 0);
  else if (a === 'play'){ var au = qs('atAudio'); if (!au) return; if (atPl.tocando) au.pause(); else if (au.getAttribute('data-seg')){ var pp = au.play(); if (pp && pp.catch) pp.catch(function(){}); } else atTocarEm(Number((qs('atSeek') || {}).value) || 0); }
  else if (a === 'transcrever' || a === 'transcrever-de-novo'){
    var det = atS.det; if (!det) return;
    var go = function(){ atProcessar(det.id); };
    if (a === 'transcrever-de-novo') atApi('/' + encodeURIComponent(det.id) + '/transcrever', 'POST', { refazer: true, trecho: undefined }).then(function(){ return atProcessar(det.id); }).catch(function(er){ atS.erro = er.message; atDesenhar(); }); else go();
  }
  else if (a === 'resumir'){
    var d0 = atS.det; if (!d0) return; atS.processando = 'Montando a ficha de atendimento…'; atS.erro = ''; atDesenhar();
    atApi('/' + encodeURIComponent(d0.id) + '/resumir', 'POST', {}).catch(function(er){ atS.erro = er.message; }).then(function(){ atS.processando = ''; atAbrir(d0.id, true); });
  }
  else if (a === 'copiar-ficha'){
    var r = atS.det && atS.det.resumo; if (!r) return; var L = ['FICHA DE ATENDIMENTO · ' + atS.det.titulo + ' · ' + fmtData(atS.det.data), '(gerada por IA a partir da transcrição; confira nos trechos)', ''];
    AT_SECOES.forEach(function(s){ var l = (r.secoes && r.secoes[s[0]]) || []; if (!l.length) return; L.push(s[1].toUpperCase()); l.forEach(function(it){ L.push('- ' + it.texto + (it.t != null ? ' [' + atTempo(it.t) + ']' : '') + (it.conferir ? ' (conferir)' : '')); }); L.push(''); });
    if ((r.naoMencionado || []).length) L.push('NÃO MENCIONADO: ' + r.naoMencionado.join('; '));
    var txt = L.join('\n'), ok = function(){ toast('Ficha copiada.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function(){ toast('Não consegui copiar.'); }); else toast('Não consegui copiar.');
  }
  else if (a === 'salvar-dados'){
    var d1 = atS.det; if (!d1) return;
    atApi('/' + encodeURIComponent(d1.id), 'PUT', { titulo: (qs('atEdTit') || {}).value, data: (qs('atEdData') || {}).value, clienteId: (qs('atEdCli') || {}).value, casoId: (qs('atEdCaso') || {}).value }).then(function(){ atLimpaCache(); toast('Guardado.'); return atAbrir(d1.id, true); }).catch(function(er){ toast(er.message); });
  }
  else if (a === 'apagar-audio'){ atS.confirma = 'audio'; atDesenhar(); }
  else if (a === 'apagar-tudo'){ atS.confirma = 'tudo'; atDesenhar(); }
  else if (a === 'cancelar-conf'){ atS.confirma = ''; atDesenhar(); }
  else if (a === 'apagar-audio-sim'){ var d2 = atS.det; atS.confirma = ''; atParaAudio(); atApi('/' + encodeURIComponent(d2.id) + '?soAudio=1', 'DELETE').then(function(){ atLimpaCache(); toast('Áudio apagado. A transcrição continua guardada.'); return atAbrir(d2.id, true); }).catch(function(er){ toast(er.message); }); }
  else if (a === 'apagar-tudo-sim'){ var d3 = atS.det; atS.confirma = ''; atParaAudio(); atApi('/' + encodeURIComponent(d3.id), 'DELETE').then(function(){ atLimpaCache(); toast('Atendimento apagado.'); atFechar(); try{ if (qs('overlayClientePerfil').classList.contains('show')) renderPerfil(); }catch(e){} try{ atInicialAtualizar(atInicialId); }catch(e){} }).catch(function(er){ toast(er.message); }); }
  else if (a === 'reenviar'){ atReenviarPendentes(); }
});
/* trechos que ficaram no aparelho (internet caiu, app fechou) */
function atMostrarPendentes(){
  atPendentesLocais().then(function(l){
    var box = qs('atPend'); if (!box || !l.length) return;
    box.innerHTML = '<div class="at-erro">Há ' + l.length + (l.length === 1 ? ' trecho de gravação' : ' trechos de gravação') + ' neste aparelho que não chegou ao servidor.<div class="lc-acts"><button type="button" class="btn btn-primary" data-at="reenviar">Enviar trechos pendentes</button></div></div>';
  });
}
function atReenviarPendentes(){
  atPendentesLocais().then(function(l){
    var ids = {}; l.forEach(function(x){ ids[x.id] = 1; });
    var fila = Promise.resolve(); l.sort(function(a, b){ return a.n - b.n; });
    l.forEach(function(x){ fila = fila.then(function(){ return atEnviarTrecho(x.id, x.n, x.blob, x.dur).then(function(){ return atApagarLocal(x.id, x.n); }); }); });
    fila.then(function(){ var ks = Object.keys(ids); if (!ks.length) return; toast('Trechos enviados.'); return atProcessar(ks[0]); }).catch(function(e){ toast('Não consegui enviar agora: ' + e.message); });
  });
}
(function(){
  var st = document.createElement('style'); st.id = 'atCss';
  st.textContent = '.at-rec{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0}.at-tempo{font-size:38px;font-weight:800;letter-spacing:.02em}.at-ponto{width:64px;height:64px;border-radius:50%;background:#D93B3B;box-shadow:0 0 0 8px rgba(217,59,59,.18);animation:atPulsa 1.4s ease-in-out infinite}.at-ponto.pausado{background:#8A93AD;box-shadow:none;animation:none}' +
    '@keyframes atPulsa{0%,100%{box-shadow:0 0 0 4px rgba(217,59,59,.18)}50%{box-shadow:0 0 0 12px rgba(217,59,59,.08)}}.at-estado{font-weight:700;color:var(--ink-soft)}.at-centro{justify-content:center;text-align:center}' +
    '.at-aviso{background:#FFF7DC;border:1px solid #F0DC9A;border-radius:12px;padding:10px 12px;font-size:var(--t2);margin:10px 0;line-height:1.45}.at-erro{background:rgba(217,59,59,.1);border:1px solid rgba(217,59,59,.35);border-radius:12px;padding:10px 12px;font-size:var(--t2);margin:10px 0;line-height:1.45}' +
    '.at-espera{display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 8px;text-align:center}.at-spin{width:34px;height:34px;border-radius:50%;border:4px solid var(--border);border-top-color:var(--ink);animation:atGira 1s linear infinite}@keyframes atGira{to{transform:rotate(360deg)}}' +
    '.at-cab{margin-bottom:8px}.at-player{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:8px 10px;margin:8px 0}.at-player input[type=range]{width:100%;min-width:0}.at-hora{font-size:var(--t2);color:var(--ink-soft);white-space:nowrap}' +
    '.at-fala,.at-it{display:grid;grid-template-columns:58px minmax(0,1fr);gap:8px;align-items:start;padding:8px 2px;border-top:1px solid var(--border);font-size:var(--t3)}.at-it{grid-template-columns:minmax(0,1fr) auto}.at-tx{overflow-wrap:anywhere;line-height:1.45}.at-t{white-space:nowrap}' +
    '.at-hl{background:#FFEFC2;border-radius:4px;padding:0 2px}.at-nome{background:#E6EEFB}.at-busca{background:#C7F0D8}.at-busca-in{width:100%;margin:6px 0}.at-sec{margin-top:12px}.at-nm{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.at-linha{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border)}.at-linha small{display:block;color:var(--ink-soft)}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { atAbrirNovo: atAbrirNovo, atAbrir: atAbrir, atS: function(){ return atS; }, atDestaque: atDestaque, atTempo: atTempo, atAbrirConfig: atAbrirConfig, atInicialAtualizar: atInicialAtualizar, atCache: function(){ return atCache; } });
})();

/* a ficha da Inicial mostra o "Atendimento de origem" ao abrir uma Inicial já salva */
(function(){
  var a1 = abrirEdicao, a2 = abrirNovo;
  abrirEdicao = function(id){ var r = a1.apply(this, arguments); try{ atInicialAtualizar(id); }catch(e){} return r; };
  abrirNovo = function(){ var r = a2.apply(this, arguments); try{ atInicialAtualizar(''); }catch(e){} return r; };
})();
