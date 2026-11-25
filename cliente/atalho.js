/* ============================================================
   ATALHO DO IPHONE (prefixo atl) — Configurações › Atalho do iPhone
   Cada pessoa (proprietário e advogados) tem o SEU código e a SUA caixa de entrada: o extrato mandado pelo iPhone chega só para ela.
   O servidor (src/atalho.js) guarda o código e o arquivo (R2, até 25 MB); o app lê os recebidos na aba Extratos.
   ============================================================ */
var atlS = { info: null, pessoas: null, mostrar: false, nota: '', aba: 'iphone' };
function atlDono(){ return typeof ppDono === 'function' && ppDono(); }
function atlQuando(iso){ if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; var h = new Date(), mesmo = d.toDateString() === h.toDateString(), ont = new Date(h.getTime() - 864e5).toDateString() === d.toDateString(); return (mesmo ? 'hoje' : (ont ? 'ontem' : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'))) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function atlCopiar(txt){
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function(){ return true; }, function(){ return atlCopiarVelho(txt); });
  return Promise.resolve(atlCopiarVelho(txt));
}
function atlCopiarVelho(txt){ try{ var t = document.createElement('textarea'); t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); t.remove(); return ok; }catch(e){ return false; } }
/* Texto para colar em "Descrever um atalho" no app Atalhos (a IA do próprio iPhone monta o atalho). Curto e direto, JÁ COM O CÓDIGO DA PESSOA,
   para ninguém errar ao digitar ou colar o código. */
function atlPrompt(codigo){
  var url = location.origin + '/api/enviar';
  return 'Crie um atalho chamado "Enviar extrato ao Horus". Ele deve aparecer na Folha de Compartilhamento e receber arquivos (PDF, OFX ou ZIP). ' +
    'Para cada arquivo recebido: use a ação "Obter conteúdo do URL" no endereço ' + url + ' com método POST, cabeçalho Authorization com o valor Bearer ' + codigo + ' (a palavra Bearer, um espaço e o código, exatamente assim, em minúsculas e com os traços), cabeçalho X-Nome com o nome do arquivo codificado para URL, e corpo da requisição do tipo Arquivo (o próprio arquivo recebido). ' +
    'Se o arquivo tiver mais de 25 MB, mostre um alerta com o nome dele e pule para o próximo. Se a resposta do servidor não tiver "ok" verdadeiro, mostre um alerta com o nome do arquivo e a mensagem de erro. ' +
    'Ao terminar, mostre apenas uma notificação: "N extrato(s) enviado(s) ao Horus." (N = quantos deram certo). Não abra nenhum app nem site.';
}
/* texto para o app HTTP Shortcuts (Android), já com o código da pessoa */
function atlPromptAndroid(codigo){
  return 'No app HTTP Shortcuts (Android), crie um atalho chamado "Enviar ao Horus" que apareça no menu Compartilhar e aceite arquivos (ative a opção de receber arquivos compartilhados). ' +
    'Ele deve fazer uma requisição POST para ' + location.origin + '/api/enviar com o cabeçalho Authorization com o valor Bearer ' + codigo + ' (a palavra Bearer, um espaço e o código, exatamente assim, em minúsculas e com os traços), o cabeçalho X-Nome com o nome do arquivo compartilhado e o corpo da requisição do tipo Arquivo (o próprio arquivo compartilhado). ' +
    'Ao terminar mostre apenas uma notificação "Enviado ao Horus" se a resposta tiver "ok" verdadeiro, ou o erro se não tiver. Não abra nenhum app nem site.';
}
function atlInstalado(){ try{ return !!((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone); }catch(e){ return false; } }
function atlCodigoHtml(i){
  if (!i.tem) return '<div class="atl-vazio">Você ainda não tem um código.' + (i.legado ? ' O código antigo continua valendo até você gerar o seu.' : '') + '</div><button type="button" class="atl-bt atl-esc" data-atla="gerar">Gerar meu código</button>';
  return '<div class="atl-cod" id="atlCod">' + escapeHtml(atlS.mostrar ? i.codigo : atlMascara(i.codigo)) + '</div>' +
    '<div class="atl-duo"><button type="button" class="atl-bt" data-atla="mostrar">' + (atlS.mostrar ? 'Esconder' : 'Mostrar') + '</button><button type="button" class="atl-bt" data-atla="copiar">Copiar</button></div>' +
    '<div class="atl-nota atl-verm">É só seu: quem tiver este código consegue mandar arquivos para a sua caixa. Não repasse.</div>' +
    '<button type="button" class="atl-bt atl-perigo" data-atla="novo">Gerar novo código</button><div class="atl-peq">O código atual deixa de valer na hora. Cole o novo no atalho (iPhone: Atalhos › Editar; Android: HTTP Shortcuts › Editar).</div>';
}
function atlAndroidHtml(i){
  var inst = atlInstalado();
  return '<p class="atl-intro">Mande extrato, fatura do cartão, boleto, comprovante ou contracheque direto do Android para o Horus: em qualquer app, toque em Compartilhar › <b>Horus</b>. O Horus lê o arquivo e mostra a conferência; nada é lançado antes de você confirmar.</p>' + (atlS.nota ? '<div class="atl-nota atl-ok">' + escapeHtml(atlS.nota) + '</div>' : '') +
    '<div class="atl-sec"><div class="atl-t"><span class="atl-n">1</span>Instalar o Horus no celular <span class="atl-tag atl-ok2">recomendado</span></div>' +
    '<ol class="atl-passos"><li>Abra o Horus no <b>Chrome</b> (ou Samsung Internet) e entre com o seu e-mail e a sua senha.</li><li>Toque no menu <b>⋮</b> › <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li><li>Abra o Horus pelo <b>ícone novo</b> uma vez. Pronto: ele passa a aparecer no menu <b>Compartilhar</b> de qualquer app (banco, Gmail, Arquivos, WhatsApp).</li></ol>' +
    '<div class="atl-lin"><span>Neste aparelho</span><span class="atl-tag ' + (inst ? 'atl-ok2' : 'atl-av') + '">' + (inst ? 'Horus instalado' : 'aberto no navegador (ainda não instalado)') + '</span></div>' +
    '<div class="atl-peq">Sem código e sem app extra. Vale a sua sessão: o arquivo cai só na sua caixa. Se a sessão tiver vencido, entre no app antes de compartilhar.</div></div>' +
    '<div class="atl-sec"><div class="atl-t"><span class="atl-n">2</span>Alternativa: atalho com código <span class="atl-tag atl-cz">opcional</span></div>' +
    '<div class="atl-peq" style="margin:0 0 8px">Para quem prefere não instalar o app: use o app gratuito <b>HTTP Shortcuts</b> (Play Store) com o seu código pessoal, o mesmo do iPhone.</div>' + atlCodigoHtml(i) +
    '<button type="button" class="atl-bt atl-azul" data-atla="promptand"' + (i.tem ? '' : ' disabled') + '>Copiar as instruções do atalho (já com o meu código)</button>' +
    (i.tem ? '' : '<div class="atl-peq">Gere o seu código para liberar as instruções.</div>') + '</div>';
}
function atlAbrir(){
  var ov = sgMontar('overlayAtalho', 'Atalhos do iPhone e Android');
  if (!ov.getAttribute('data-atl')){
    ov.setAttribute('data-atl', '1');
    ov.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-atla]') : null; if (b) atlAcao(b.getAttribute('data-atla'), b); });
  }
  atlS.mostrar = false; atlS.nota = ''; ov.classList.add('show');
  qs('overlayAtalhoC').innerHTML = '<div class="atl-vazio">Carregando…</div>';
  atlCarregar();
}
function atlCarregar(){
  var ps = [esJson('/api/atalho')]; if (atlDono()) ps.push(esJson('/api/atalho/pessoas').catch(function(){ return { pessoas: [] }; }));
  return Promise.all(ps).then(function(r){ atlS.info = r[0]; atlS.pessoas = r[1] ? r[1].pessoas : null; atlDesenhar(); try{ if (typeof impVerRecebidos === 'function') impVerRecebidos(); }catch(e){} })
    .catch(function(e){ qs('overlayAtalhoC').innerHTML = '<div class="atl-nota atl-verm">' + escapeHtml(e.message) + '</div>'; });
}
function atlMascara(c){ return '•••• •••• •••• ' + c.slice(-4); }
function atlDesenhar(){
  var c = qs('overlayAtalhoC'), i = atlS.info; if (!c || !i) return;
  var seg = '<div class="atl-seg"><button type="button" data-atla="aba-iphone" class="' + (atlS.aba === 'iphone' ? 'on' : '') + '">iPhone</button><button type="button" data-atla="aba-android" class="' + (atlS.aba === 'android' ? 'on' : '') + '">Android</button></div>';
  var h = '<p class="atl-intro">Mande o extrato do banco direto do iPhone para o Horus: no extrato, toque em Compartilhar › <b>Enviar extrato ao Horus</b>. O Horus lê o arquivo e mostra a conferência; nada é lançado antes de você confirmar.</p>' + (atlS.nota ? '<div class="atl-nota atl-ok">' + escapeHtml(atlS.nota) + '</div>' : '');
  if (atlS.aba === 'android') h = atlAndroidHtml(i);
  else {
  /* 1. código */
  h += '<div class="atl-sec"><div class="atl-t"><span class="atl-n">1</span>Seu código pessoal</div>';
  if (!i.tem){
    h += '<div class="atl-vazio">Você ainda não tem um código.' + (i.legado ? ' O código antigo continua valendo até você gerar o seu.' : '') + '</div><button type="button" class="atl-bt atl-esc" data-atla="gerar">Gerar meu código</button>';
  } else {
    h += '<div class="atl-cod" id="atlCod">' + escapeHtml(atlS.mostrar ? i.codigo : atlMascara(i.codigo)) + '</div>' +
      '<div class="atl-duo"><button type="button" class="atl-bt" data-atla="mostrar">' + (atlS.mostrar ? 'Esconder' : 'Mostrar') + '</button><button type="button" class="atl-bt" data-atla="copiar">Copiar</button></div>' +
      '<div class="atl-nota atl-verm">É só seu: quem tiver este código consegue mandar arquivos para a sua caixa. Não repasse.</div>' +
      '<button type="button" class="atl-bt atl-perigo" data-atla="novo">Gerar novo código</button><div class="atl-peq">O código atual deixa de valer na hora. No iPhone, cole o novo no atalho (Atalhos › Editar).</div>';
  }
  h += '</div>';
  /* 2. criar o atalho (a IA do próprio app Atalhos monta, a partir da descrição) */
  h += '<div class="atl-sec"><div class="atl-t"><span class="atl-n">2</span>Criar o atalho no iPhone</div>' +
    '<ol class="atl-passos"><li>Toque em <b>Copiar a descrição do atalho</b>: o texto já leva o <b>seu código</b>, sem você digitar nada.</li><li>Toque em <b>Abrir o app Atalhos</b>, crie um atalho novo e <b>cole</b> o texto em <b>“Descrever um atalho”</b>. O iPhone monta o atalho sozinho.</li><li><b>Confira antes de salvar</b> (abaixo) e toque em concluir.</li></ol>' +
    '<button type="button" class="atl-bt atl-azul" data-atla="prompt"' + (i.tem ? '' : ' disabled') + '>Copiar a descrição do atalho (já com o meu código)</button>' +
    '<a class="atl-bt" href="shortcuts://create-shortcut">Abrir o app Atalhos</a>' +
    (i.tem ? '' : '<div class="atl-peq">Gere o seu código no passo 1 para liberar a descrição.</div>') +
    '<div class="atl-conf"><b>Conferir antes de salvar:</b><ul><li>O atalho aparece na <b>Folha de Compartilhamento</b> e aceita arquivos.</li><li>Ação <b>Obter conteúdo do URL</b>: método <b>POST</b>, corpo <b>Arquivo</b>.</li><li>Cabeçalho <b>Authorization</b> = <b>Bearer</b> + o seu código (toque em Mostrar acima para comparar).</li><li>Cabeçalho <b>X-Nome</b> = nome do arquivo.</li><li>No fim, só uma <b>notificação</b>.</li></ul><div class="atl-peq">Se o iPhone errar algum ponto, corrija à mão ou descreva de novo. O texto contém o seu código: se achar que vazou, gere um novo.</div></div></div>';
  }
  /* 3. testar */
  h += '<div class="atl-sec"><div class="atl-t"><span class="atl-n">3</span>Testar</div>' +
    '<div class="atl-lin"><span>Último envio</span><span>' + (i.ultimo ? '<b>' + escapeHtml(atlQuando(i.ultimo.em)) + '</b> · ' + escapeHtml(i.ultimo.nome) : 'nenhum ainda') + '</span></div>' +
    '<div class="atl-lin"><span>Esperando você conferir</span><span><b>' + i.esperando + (i.esperando === 1 ? ' arquivo' : ' arquivos') + '</b></span></div>' +
    '<button type="button" class="atl-bt" data-atla="atualizar">Atualizar</button>' + (i.esperando ? '<button type="button" class="atl-bt atl-esc" data-atla="extratos">Abrir os extratos recebidos</button>' : '') + '</div>';
  /* quando algo dá errado */
  h += '<div class="atl-sec"><div class="atl-t">Quando algo dá errado</div>' +
    '<div class="atl-lin"><span class="atl-tag atl-er">código recusado</span><span class="atl-peq">gere um novo e cole no atalho</span></div>' +
    '<div class="atl-lin"><span class="atl-tag atl-av">arquivo acima de 25 MB</span><span class="atl-peq">use “Escolher extratos” no app</span></div>' +
    '<div class="atl-lin"><span class="atl-tag atl-av">muitos esperando</span><span class="atl-peq">leia os recebidos primeiro</span></div></div>';
  /* proprietário: pessoas */
  if (i.dono && atlS.pessoas){
    h += '<div class="atl-sec"><div class="atl-t">Pessoas com atalho (só o proprietário vê)</div>' + atlS.pessoas.map(function(p){
      var st = !p.aplica ? '<span class="atl-tag atl-cz">não se aplica</span>' : (p.tem ? '<span class="atl-tag atl-ok2">ativo</span>' + (p.ultimo ? '<br><span class="atl-peq">' + escapeHtml(atlQuando(p.ultimo)) + '</span>' : '') : '<span class="atl-tag atl-cz">sem código</span>');
      return '<div class="atl-lin"><span><b>' + escapeHtml(p.nome) + '</b><br><span class="atl-peq">' + (p.papel === 'proprietario' ? 'proprietário' : (p.papel === 'advogado' ? 'advogado(a)' : 'estagiário(a): não usa')) + '</span></span><span style="text-align:right">' + st + (p.tem && p.papel !== 'proprietario' ? '<br><button type="button" class="atl-mini" data-atla="desligar" data-uid="' + escapeHtml(p.id) + '" data-nome="' + escapeHtml(p.nome) + '">Desligar</button>' : '') + '</span></div>';
    }).join('') + '<div class="atl-peq" style="margin-top:8px">Você não vê o código nem o conteúdo dos extratos de ninguém: só quem tem atalho e quando usou.</div></div>';
  }
  c.innerHTML = seg + h;
}
function atlAcao(a, bt){
  var i = atlS.info;
  var gerar = function(){ return esJson('/api/atalho/gerar', 'POST', {}).then(function(){ atlS.mostrar = true; atlS.nota = 'Código gerado. Cole-o no atalho do iPhone.'; return atlCarregar(); }).catch(function(e){ toast(e.message); }); };
  if (a === 'gerar') return gerar();
  if (a === 'novo'){ if (!confirm('Gerar um novo código e desligar o atual? O atalho do iPhone vai parar de enviar até você colar o novo código nele.')) return; return gerar(); }
  if (a === 'aba-iphone' || a === 'aba-android'){ atlS.aba = a === 'aba-android' ? 'android' : 'iphone'; return atlDesenhar(); }
  if (a === 'promptand'){ if (!i.tem){ toast('Gere o seu código primeiro.'); return; } return atlCopiar(atlPromptAndroid(i.codigo)).then(function(ok){ toast(ok ? 'Instruções copiadas, já com o seu código.' : 'Não consegui copiar.'); }); }
  if (a === 'mostrar'){ atlS.mostrar = !atlS.mostrar; return atlDesenhar(); }
  if (a === 'copiar') return atlCopiar(i.codigo).then(function(ok){ toast(ok ? 'Código copiado.' : 'Não consegui copiar: toque em Mostrar e copie à mão.'); });
  if (a === 'prompt'){ if (!i.tem){ toast('Gere o seu código primeiro.'); return; } return atlCopiar(atlPrompt(i.codigo)).then(function(ok){ toast(ok ? 'Descrição copiada, já com o seu código. Cole em “Descrever um atalho”.' : 'Não consegui copiar.'); }); }
  if (a === 'atualizar'){ atlS.nota = ''; return atlCarregar(); }
  if (a === 'extratos'){ qs('overlayAtalho').classList.remove('show'); try{ setActiveTab('extratos'); }catch(e){} return; }
  if (a === 'desligar'){ var uid = bt.getAttribute('data-uid'), nome = bt.getAttribute('data-nome'); if (!confirm('Desligar o código de ' + nome + '? O atalho dela para de enviar até ela gerar outro.')) return; return esJson('/api/atalho/desligar', 'POST', { uid: uid }).then(function(){ atlS.nota = 'Código de ' + nome + ' desligado.'; return atlCarregar(); }).catch(function(e){ toast(e.message); }); }
}
(function(){
  var st = document.createElement('style');
  st.textContent = '#overlayAtalho .modal-body{gap:0}.atl-intro{font-size:var(--t2);color:var(--ink-soft);line-height:1.45;margin:0 0 10px}.atl-sec{border:1px solid var(--border);border-radius:14px;padding:12px;margin:0 0 10px;background:var(--surface)}' +
    '.atl-t{font-size:var(--t1);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:8px}.atl-n{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;font-weight:800;margin-right:6px}' +
    '.atl-cod{font:700 15px ui-monospace,Menlo,monospace;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;letter-spacing:.05em;word-break:break-all}.atl-bt{display:block;width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:11px;padding:10px;text-align:center;font:inherit;font-weight:800;font-size:var(--t3);margin-top:8px;background:var(--surface);color:var(--ink);cursor:pointer;text-decoration:none}' +
    '.atl-esc{background:#12172A;color:#fff;border-color:#12172A}.atl-azul{background:var(--accent);color:#fff;border-color:var(--accent)}.atl-perigo{color:var(--urgente)}.atl-duo{display:flex;gap:8px}.atl-duo .atl-bt{flex:1}' +
    '.atl-nota{border-radius:10px;padding:9px 11px;font-size:var(--t2);margin:8px 0;line-height:1.4;background:#FBEFD2;color:#6B4509}.atl-verm{background:#FDE3E3;color:#8E1B1B}.atl-ok{background:#DDF3E5;color:#16683A}.atl-peq{color:var(--ink-soft);font-size:var(--t1);margin-top:6px}.atl-vazio{color:var(--ink-soft);font-size:var(--t2)}' +
    '.atl-lin{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);font-size:var(--t2)}.atl-t+.atl-lin{border-top:0}.atl-tag{display:inline-block;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:800}' +
    '.atl-er{background:#FDE3E3;color:#B42323}.atl-av{background:#FBEFD2;color:#8A5A0B}.atl-cz{background:#EAEEFB;color:#5b6488}.atl-ok2{background:#DDF3E5;color:#16683A}.atl-l{display:block;font-size:var(--t1);font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-soft);margin:10px 0 4px}' +
    '.atl-in{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:10px;font:inherit;font-size:var(--t3);background:var(--bg);color:var(--ink)}.atl-conf{margin-top:10px;background:var(--bg);border-radius:10px;padding:10px 12px;font-size:var(--t2)}.atl-conf ul{margin:6px 0 0;padding-left:18px;line-height:1.5}.atl-passos{margin:0 0 6px;padding-left:20px;font-size:var(--t2);line-height:1.5}.atl-bt[disabled]{opacity:.5}a.atl-bt{box-sizing:border-box}.atl-mini{border:1px solid var(--border);background:var(--surface);color:var(--urgente);border-radius:8px;padding:3px 9px;font:700 11px system-ui,sans-serif;cursor:pointer;margin-top:4px}';
  st.textContent += '.atl-seg{display:flex;background:var(--surface-2);border-radius:99px;padding:3px;width:fit-content;margin:0 0 10px}.atl-seg button{border:0;background:transparent;padding:7px 20px;min-height:40px;border-radius:99px;font:inherit;font-weight:700;font-size:var(--t2);color:var(--ink-soft);cursor:pointer}.atl-seg button.on{background:#12172A;color:#fff}';
  document.head.appendChild(st);
  /* voltou do compartilhar do Android: diz quantos arquivos chegaram e abre os extratos */
  try{
    var q = new URLSearchParams(location.search);
    if (q.has('compartilhado')){
      var n = parseInt(q.get('compartilhado'), 10) || 0, mot = q.get('motivo') || '';
      history.replaceState(null, '', location.pathname + location.hash);
      var avisar = function(){ toast(n ? (n + (n === 1 ? ' arquivo recebido' : ' arquivos recebidos') + '. Confira em Extratos.') : (mot || 'Não consegui receber o arquivo.')); if (n){ try{ setActiveTab('extratos'); }catch(e){} } };
      if (window.__horusEu && window.__horusEu.pronto) setTimeout(avisar, 600); else window.addEventListener('horus-eu', function(){ setTimeout(avisar, 600); }, { once: true });
    }
  }catch(e){}
  if (typeof CF_LINHAS !== 'undefined') CF_LINHAS.splice(1, 0, { id: 'atalho', ic: 'file-up', t: 'Atalho do iPhone e Android', s: 'mande extratos, faturas e documentos direto do celular', go: function(){ atlAbrir(); } });
  /* advogado: a lista simplificada de Minha conta ganha a linha do atalho */
  if (typeof cfRender === 'function'){
    var cfOrig = cfRender;
    cfRender = function(){
      cfOrig.apply(this, arguments);
      try{ var w = qs('cfWrap'), m = w && w.querySelector('.pb-menu'); if (m && typeof ppPapel === 'function' && (ppPapel() === 'advogado' || (typeof ffnAtivo === 'function' && ffnAtivo())) && !m.querySelector('[data-cf="atalho"]')) m.insertAdjacentHTML('beforeend', cfLinha(CF_LINHAS.filter(function(x){ return x.id === 'atalho'; })[0], false)); }catch(e){}
    };
  }
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { atlAbrir: atlAbrir, atlS: atlS, atlPrompt: atlPrompt });
})();
