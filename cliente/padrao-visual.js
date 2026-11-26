/* Padrão visual: chave liga/desliga igual à do iPhone + três reparos de layout vistos no celular (20/11).
   Só CSS: nada muda de lugar nem de função.
   CHAVE (switch): trilho 51×31 px, bolinha de 27 px com sombra, verde suave (#64ac6c, medido na foto de referência) e bolinha cinza-clara (#e3e3e1) quando ligada, cinza quando desligada, sem encolher e sem
   herdar largura/altura dos campos. Vale para toda chave do app: `.nt-sw` (Lembretes no iPhone), `.pl-sw` (Também na planilha) e a classe
   genérica `input.sw` — qualquer chave nova usa `<input type="checkbox" class="sw">` e já nasce no padrão. */
(function(){
  var st = document.createElement('style');
  st.textContent =
    ':root{--sw-on:#64ac6c;--sw-off:#c4c4c9;--sw-knob:#e3e3e1}' +
    ':root[data-theme="dark"]{--sw-on:#6fbf78;--sw-off:#48484d;--sw-knob:#ececea}' +
    'input.sw,input.nt-sw,input.pl-sw{-webkit-appearance:none;appearance:none;box-sizing:border-box;flex:none;position:relative;display:inline-block;width:51px!important;min-width:51px!important;max-width:51px!important;height:31px!important;min-height:31px!important;margin:0;padding:0;border:0;border-radius:999px;background:var(--sw-off);cursor:pointer;vertical-align:middle;transition:background .2s ease;-webkit-tap-highlight-color:transparent;outline-offset:2px}' +
    'input.sw::after,input.nt-sw::after,input.pl-sw::after{content:"";position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:var(--sw-knob);box-shadow:0 3px 8px rgba(0,0,0,.15),0 1px 1px rgba(0,0,0,.16),0 3px 1px rgba(0,0,0,.10);transition:transform .2s ease}' +
    'input.sw:checked,input.nt-sw:checked,input.pl-sw:checked{background:var(--sw-on)}' +
    'input.sw:checked::after,input.nt-sw:checked::after,input.pl-sw:checked::after{transform:translateX(20px)}' +
    'input.sw:disabled,input.nt-sw:disabled,input.pl-sw:disabled{opacity:.45;cursor:not-allowed}' +
    'input.sw:focus-visible,input.nt-sw:focus-visible,input.pl-sw:focus-visible{outline:2px solid var(--info,#2a78d6)}' +
    /* Construção › Dinheiro da obra: a frase "veio de um recebimento…" quebra a linha dentro do cartão em vez de passar da borda */
    '.ob-gasto-val{min-width:0;max-width:100%}.ob-gasto-val .saldo-data{white-space:normal;overflow-wrap:anywhere;text-align:right;line-height:1.35}' +
    '@media (max-width:640px){.ob-gasto-val .saldo-data{text-align:left}}' +
    /* Extratos: o campo de data respeita a largura do cartão e os cartões de cada mês têm espaço entre si, com o mês numa linha e o resumo na de baixo */
    '.field input[type=date],#impCorte{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box}' +
    '.ext-dd{margin:0 0 10px;min-width:0}.ext-dd>summary{display:block!important;padding-right:20px;line-height:1.45;overflow-wrap:anywhere}' +
    '.ext-dd>summary>b{display:block;font-size:var(--t4);margin-bottom:2px}' +
    '.ext-dd .plan-linha{min-width:0;gap:10px}.ext-dd .plan-linha>span{min-width:0;overflow-wrap:anywhere}' +
    /* Extratos > Recebidos pelo Compartilhar: nome comprido do arquivo quebra de linha e o botão Apagar não sai do cartão */
    '#extTopo .plan-linha{min-width:0;align-items:center}#extTopo .plan-linha>span{min-width:0;overflow-wrap:anywhere}#extTopo .plan-linha>button{flex:none}';
  document.head.appendChild(st);
})();
/* JANELA QUE ABRE POR CIMA DE OUTRA FICA POR CIMA: todas as janelas (.overlay) têm o mesmo nível, então vale a ordem no HTML — uma janela criada antes (ex.: "Adiar") aparecia ATRÁS
   da que já estava aberta (ex.: a ficha do prazo) e a data não dava para escolher. Quando uma janela passa a aparecer, ela vai para o fim da página (a mais recente fica na frente). */
(function(){
  if (!window.MutationObserver) return;
  var movendo = false;
  new MutationObserver(function(ms){
    if (movendo) return;
    ms.forEach(function(m){
      var t = m.target; if (!t || !t.classList || !t.classList.contains('overlay') || !t.classList.contains('show')) return;
      if (m.oldValue && /(^|\s)show(\s|$)/.test(m.oldValue)) return;   /* já estava aberta: só mudou outra classe */
      if (t.parentNode !== document.body || document.body.lastElementChild === t) return;
      var ae = document.activeElement, tinha = ae && t.contains(ae), sc = t.querySelector('.modal-body, .modal'), rol = sc ? sc.scrollTop : 0;
      movendo = true; try{ document.body.appendChild(t); }finally{ movendo = false; }
      if (tinha && ae && ae.focus) try{ ae.focus(); }catch(e){}
      if (sc && rol) sc.scrollTop = rol;
    });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
})();
