/* ============================================================
   CATÁLOGO ÚNICO DE CATEGORIAS DE DESPESA (prefixo cat)
   Uma lista só (78 categorias em 11 famílias, com ícone, cor da família, escopo e palavras que classificam sozinhas), usada:
   - no lançamento de despesa da PJ e da PF (seletor com busca e famílias);
   - na classificação do extrato "dia a dia" (palavras como UBER, IFOOD, NETFLIX, OFICINA…);
   - na aba Análise (as despesas lançadas e as do extrato somam na mesma categoria, com o mesmo ícone e a mesma cor).
   As 5 categorias antigas (estrutura, impostos, pessoal, sistemas, outros) mantêm os mesmos ids: nada do que já foi lançado se perde.
   Os nomes antigos do extrato (Mercado, Alimentação, Casa…) viram os novos na leitura (catNomeNovo). "Reclassificar Outros em lote" sugere
   a categoria certa para o que já está em "Outros" e só muda o que a pessoa aprovar.
   ============================================================ */
var CAT_FAMILIAS = [
  ['moradia', 'Moradia', '#0284C7'], ['alimentacao', 'Alimentação', '#C98500'], ['transporte', 'Transporte e veículos', '#4F46E5'],
  ['saude', 'Saúde e bem-estar', '#DB2777'], ['educacao', 'Educação e desenvolvimento', '#0D9488'], ['lazer', 'Lazer, assinaturas e serviços online', '#8B5CF6'],
  ['compras', 'Compras e cuidados pessoais', '#EA580C'], ['familia', 'Família e doações', '#16A34A'], ['financas', 'Finanças e impostos', '#475569'],
  ['escritorio', 'Escritório (PJ)', '#B7791E'], ['outros', 'Outros', '#8A93AD']
];
/* [id, rótulo, ícone (lucide), família, escopo (A = os dois, F = pessoal, J = escritório), palavras do extrato ("*" no fim = começa com), nome antigo do extrato] */
var CAT_DADOS = [
  ['aluguel_moradia', 'Aluguel e financiamento do imóvel', 'house', 'moradia', 'F', 'IMOBILIARIA|ALUGUEL|FINANCIAMENTO IMOVEL|CAIXA HABITACAO'],
  ['condominio', 'Condomínio', 'building-2', 'moradia', 'F', 'CONDOMINIO'],
  ['energia', 'Energia elétrica', 'zap', 'moradia', 'A', 'CELG|ENEL|EQUATORIAL|CPFL|CEMIG|ENERGIA'],
  ['agua', 'Água e esgoto', 'droplets', 'moradia', 'A', 'SANEAGO|SABESP|COPASA|AGUA E ESGOTO'],
  ['gas', 'Gás', 'flame', 'moradia', 'F', 'ULTRAGAZ|LIQUIGAS|SUPERGASBRAS|COMGAS|GAS DE COZINHA'],
  ['internet_tel', 'Internet e telefone', 'wifi', 'moradia', 'A', 'CLARO|VIVO|TIM|OI FIBRA|OI MOVEL|INTERNET|TELEFON*|BRISANET|ALGAR', 'Telefone e internet'],
  ['iptu', 'IPTU e taxas do imóvel', 'landmark', 'moradia', 'F', 'IPTU|PREFEITURA'],
  ['manut_casa', 'Manutenção da casa', 'wrench', 'moradia', 'F', 'ELETRICA|HIDRAULICA|ENCANADOR|ELETRICISTA|PEDREIRO', 'Casa'],
  ['reforma', 'Reforma e obra', 'hammer', 'moradia', 'F', 'MATERIAL DE CONSTRUCAO|CONSTRU*|LEROY MERLIN|TELHANORTE|REFORMA'],
  ['moveis', 'Móveis, eletro e decoração', 'armchair', 'moradia', 'F', 'MOVEIS|MAGAZINE LUIZA|MAGALU|TOK STOK|CASAS BAHIA|PONTO FRIO'],
  ['limpeza', 'Limpeza e diarista', 'spray-can', 'moradia', 'F', 'DIARISTA|FAXINA|LIMPEZA'],
  ['mercado', 'Supermercado', 'shopping-cart', 'alimentacao', 'A', 'SUPER*|ATACADAO|ASSAI|CARREFOUR|MERCEARIA|MERCA|ATACAREJO|SOLID', 'Mercado'],
  ['feira', 'Feira, açougue e hortifruti', 'carrot', 'alimentacao', 'F', 'ACOUGUE|HORTIFRUT*|SACOLAO|FEIRA|CARNES|FRIGORIFICO'],
  ['padaria', 'Padaria e lanchonete', 'croissant', 'alimentacao', 'F', 'PADARIA|PANIF*|LANCHONETE|LANCH*|SALGAD*'],
  ['restaurante', 'Restaurantes e bares', 'utensils', 'alimentacao', 'A', 'RESTAUR*|PIZZ*|BURGER|CHURRASC*|CERVEJ*|CERVA|CANTINA|BOTECO|SUSHI|BAR', 'Alimentação'],
  ['delivery', 'Delivery (iFood e similares)', 'bike', 'alimentacao', 'A', 'IFOOD|IFD|RAPPI|99FOOD|UBER EATS|KEETA'],
  ['cafe', 'Café e sobremesas', 'coffee', 'alimentacao', 'F', 'CAFE*|CAFETERIA|SORVET*|ACAI|DOCERIA|CACAU|STARBUCKS'],
  ['combustivel', 'Combustível', 'fuel', 'transporte', 'A', 'POSTO|COMBUST*|GASOLINA|ETANOL|DIESEL|IPIRANGA|SHELL|PETROBRAS', 'Combustível'],
  ['apps_transporte', 'Aplicativos de transporte (Uber, 99)', 'car-taxi-front', 'transporte', 'A', 'UBER|99|99POP|99 TAXI|CABIFY|INDRIVE|TAXI*'],
  ['transp_publico', 'Transporte público', 'bus', 'transporte', 'F', 'METROBUS|RMTC|BILHETE UNICO|ONIBUS|CARTAO TRANSPORTE'],
  ['estacionamento', 'Estacionamento e pedágio', 'parking-circle', 'transporte', 'A', 'ESTACIONAMENTO|ESTAPAR|SEM PARAR|CONECTCAR|PEDAGIO|VELOE'],
  ['manut_veiculo', 'Manutenção do veículo', 'wrench', 'transporte', 'A', 'OFICINA|MECANICA|AUTO PECAS|PECAS AUTO|BORRACHARIA|PNEU*|FUNILARIA|AUTO CENTER|TROCA DE OLEO'],
  ['lavagem', 'Lavagem e estética automotiva', 'car-front', 'transporte', 'F', 'LAVA JATO|LAVAGEM|ESTETICA AUTOMOTIVA'],
  ['ipva', 'IPVA, licenciamento e multas', 'alert-triangle', 'transporte', 'A', 'DETRAN|IPVA|LICENCIAMENTO|MULTA DE TRANSITO|DPVAT'],
  ['seguro_veiculo', 'Seguro e financiamento do veículo', 'shield-check', 'transporte', 'A', 'SEGURO AUTO|PORTO SEGURO|BV FINANCEIRA|FINANCIAMENTO VEICULO'],
  ['viagens', 'Passagens, hospedagem e viagens', 'plane', 'transporte', 'A', 'LATAM|GOL LINHAS|AZUL LINHAS|BOOKING|AIRBNB|DECOLAR|HOTEL*|POUSADA|CVC|MAXMILHAS'],
  ['plano_saude', 'Plano de saúde', 'heart-pulse', 'saude', 'F', 'UNIMED|BRADESCO SAUDE|AMIL|SULAMERICA|HAPVIDA|PLANO DE SAUDE'],
  ['consultas', 'Consultas e exames', 'stethoscope', 'saude', 'F', 'CLINICA|LABORATORIO|HOSPITAL|EXAME*|CONSULTA|MEDICO'],
  ['farmacia', 'Farmácia e medicamentos', 'pill', 'saude', 'A', 'DROGA*|FARMA*|DROGARIA|PACHECO|PAGUE MENOS', 'Farmácia'],
  ['dentista', 'Dentista', 'smile', 'saude', 'F', 'ODONTO*|DENTISTA'],
  ['terapia', 'Psicólogo e terapias', 'brain', 'saude', 'F', 'PSICOLOG*|TERAPIA|PSIQUIATR*'],
  ['academia', 'Academia e esportes', 'dumbbell', 'saude', 'F', 'ACADEMIA|SMARTFIT|BLUEFIT|BODYTECH|CROSSFIT|PILATES'],
  ['otica', 'Óculos e ótica', 'glasses', 'saude', 'F', 'OTICA*|OCULOS|CHILLI BEANS'],
  ['faculdade', 'Faculdade e pós-graduação', 'graduation-cap', 'educacao', 'A', 'UNIVERSIDADE|FACULDADE|POS GRADUACAO|ANHANGUERA|ESTACIO|UNIP'],
  ['cursos', 'Cursos e treinamentos', 'book-open', 'educacao', 'A', 'CURSO*|UDEMY|ALURA|COURSERA|HOTMART|TREINAMENTO*'],
  ['livros', 'Livros e materiais', 'book', 'educacao', 'A', 'LIVRARIA|SARAIVA|LIVRO*'],
  ['congressos', 'Congressos e eventos', 'presentation', 'educacao', 'A', 'CONGRESSO|SEMINARIO|SIMPOSIO'],
  ['idiomas', 'Idiomas', 'languages', 'educacao', 'F', 'WIZARD|CNA|DUOLINGO|CCAA|FISK|IDIOMA*'],
  ['escola', 'Escola e mensalidades', 'calendar-days', 'educacao', 'F', 'COLEGIO|ESCOLA|MENSALIDADE ESCOLAR'],
  ['streaming', 'Streaming de vídeo e música', 'tv', 'lazer', 'F', 'NETFLIX|SPOTIFY|DISNEY*|HBO|PRIME VIDEO|AMAZON PRIME|YOUTUBE PREMIUM|DEEZER|GLOBOPLAY|APPLE COM BILL|APPLE MUSIC|PARAMOUNT|TELECINE|CRUNCHYROLL'],
  ['jogos', 'Jogos e entretenimento', 'gamepad-2', 'lazer', 'F', 'STEAM|PLAYSTATION|XBOX|NINTENDO|EPIC GAMES'],
  ['cinema_eventos', 'Cinema, shows e eventos', 'clapperboard', 'lazer', 'F', 'CINEMA|CINEMARK|INGRESSO*|SYMPLA|SHOW*|TEATRO|TICKET MASTER'],
  ['passeios', 'Hotéis e passeios', 'bed-double', 'lazer', 'F', 'PASSEIO*|PARQUE*|EXCURS*|TURISMO'],
  ['apps_servicos', 'Aplicativos e serviços online', 'cloud', 'lazer', 'A', 'GOOGLE ONE|GOOGLE STORAGE|ICLOUD|DROPBOX|OPENAI|CHATGPT|ANTHROPIC|CLAUDE|ADOBE|MICROSOFT*|CANVA|ZOOM|NOTION|SLACK|GITHUB'],
  ['dominio_hosp', 'Domínios e hospedagem', 'globe', 'lazer', 'A', 'HOSTINGER|GODADDY|REGISTRO BR|LOCAWEB|HOSTGATOR|CLOUDFLARE'],
  ['assinaturas_div', 'Assinaturas diversas', 'repeat', 'lazer', 'A', 'ASSINATURA*|CLUBE*|REVISTA*|JORNAL*'],
  ['roupas', 'Roupas e calçados', 'shirt', 'compras', 'F', 'RENNER|C&A|RIACHUELO|MARISA|ZARA|CALCADO*|ROUPAS|MODA|HERING|AREZZO|NIKE|ADIDAS'],
  ['beleza', 'Beleza e estética', 'sparkles', 'compras', 'F', 'BOTICARIO|NATURA|ESTETICA|SEPHORA|AVON|PERFUM*'],
  ['barbearia', 'Cabeleireiro e barbearia', 'scissors', 'compras', 'F', 'SALAO|BARBEARIA|CABELEIREIR*'],
  ['eletronicos', 'Eletrônicos e informática', 'laptop', 'compras', 'A', 'KABUM|FAST SHOP|SAMSUNG|APPLE STORE|INFORMATICA|CELULAR'],
  ['presentes', 'Presentes', 'gift', 'compras', 'F', 'PRESENTE*'],
  ['compras_online', 'Compras online', 'package', 'compras', 'A', 'MERCADO LIVRE|MERCADOLIVRE|AMAZON|SHOPEE|SHEIN|ALIEXPRESS|AMERICANAS|SUBMARINO'],
  ['pets', 'Pets e veterinário', 'paw-print', 'compras', 'F', 'PETZ|COBASI|PET SHOP|PETSHOP|VETERINAR*'],
  ['filhos', 'Filhos e família', 'user-round', 'familia', 'F', 'ESCOLINHA|BRINQUEDO*|RIHAPPY'],
  ['doacoes', 'Doações e dízimo', 'handshake', 'familia', 'F', 'IGREJA|DIZIMO|DOACAO'],
  ['tarifas', 'Tarifas bancárias', 'building-2', 'financas', 'A', 'TARIFA*|ANUIDADE CARTAO|PACOTE SERVICOS', 'Tarifas e juros'],
  ['juros', 'Juros, multas e IOF', 'percent', 'financas', 'A', 'JUROS|IOF|MULTA|ENCARGOS|MORA'],
  ['emprestimos', 'Empréstimos e financiamentos', 'hand-coins', 'financas', 'A', 'EMPRESTIMO|FINANCIAMENTO|PARCELA*|CONSIGNADO'],
  ['cartao', 'Fatura de cartão', 'credit-card', 'financas', 'A', 'FATURA|PAGAMENTO FATURA|CARTAO DE CREDITO'],
  ['seguros', 'Seguros', 'shield-check', 'financas', 'A', 'SEGURO*|SEGURADORA|MAPFRE|TOKIO MARINE'],
  ['impostos_pf', 'Imposto de renda e tributos pessoais', 'landmark', 'financas', 'F', 'DARF|IMPOSTO DE RENDA|RECEITA FEDERAL|IRPF'],
  ['estrutura', 'Estrutura do escritório (aluguel, condomínio)', 'building-2', 'escritorio', 'J', 'ALUGUEL ESCRIT*|COWORKING|CONDOMINIO ESCRIT*', 'Estrutura'],
  ['contabilidade', 'Contabilidade', 'calculator', 'escritorio', 'J', 'CONTADOR|CONTABIL*|CONTABILIDADE'],
  ['impostos', 'Impostos e taxas (DAS, ISS)', 'landmark', 'escritorio', 'J', 'DAS|ISS|SIMPLES NACIONAL|DAS MEI', 'Impostos'],
  ['pessoal', 'Pessoal e encargos', 'users', 'escritorio', 'J', 'SALARIO*|FGTS|ESTAGIARIO*|FOLHA|FUNCIONARIO*', 'Pessoal'],
  ['pro_labore', 'Pró-labore e retiradas', 'wallet', 'escritorio', 'J', 'PRO LABORE|PROLABORE|DISTRIBUICAO DE LUCROS'],
  ['sistemas', 'Sistemas e software jurídico', 'scale', 'escritorio', 'J', 'PROJURIS|ASTREA|ADVBOX|SOFTWARE JURIDICO|JUSBRASIL', 'Sistemas'],
  ['marketing', 'Marketing e anúncios', 'megaphone', 'escritorio', 'J', 'META ADS|GOOGLE ADS|FACEBK|FACEBOOK ADS|INSTAGRAM ADS|LINKEDIN ADS|TIKTOK ADS|MARKETING|PUBLICIDADE'],
  ['material_escritorio', 'Material de escritório e impressões', 'printer', 'escritorio', 'J', 'PAPELARIA|KALUNGA|IMPRESS*|TONER|CARTUCHO'],
  ['custas', 'Custas e despesas processuais', 'landmark', 'escritorio', 'J', 'CUSTAS|TJGO|GUIA JUDICIAL|EMOLUMENTO*'],
  ['correios_cartorio', 'Correios e cartório', 'mail', 'escritorio', 'J', 'CORREIOS|SEDEX|CARTORIO|CERTIDAO'],
  ['correspondente', 'Correspondentes e diligências', 'handshake', 'escritorio', 'J', 'CORRESPONDENTE|DILIGENCIA*'],
  ['deslocamento', 'Deslocamentos a trabalho', 'briefcase', 'escritorio', 'J', 'DESLOCAMENTO*'],
  ['cert_digital', 'Certificado digital e assinaturas', 'file-check', 'escritorio', 'J', 'CERTISIGN|SERASA CERTIFICADO|CERTIFICADO DIGITAL|SAFEWEB'],
  ['anuidade_oab', 'Anuidade OAB e entidades', 'scale', 'escritorio', 'J', 'OAB|CAA GO|ANUIDADE OAB'],
  ['manut_equip', 'Manutenção de equipamentos', 'wrench', 'escritorio', 'J', 'ASSISTENCIA TECNICA|MANUTENCAO DE EQUIPAMENTO*'],
  ['copa_limpeza', 'Limpeza e copa do escritório', 'spray-can', 'escritorio', 'J', 'COPA|MATERIAL DE LIMPEZA'],
  ['outros', 'Outros', 'ellipsis', 'outros', 'A', '', 'Outros']
];
var CAT_PRONTO = false;
var CAT_FAM = {}; CAT_FAMILIAS.forEach(function(f){ CAT_FAM[f[0]] = { id: f[0], nome: f[1], cor: f[2] }; });
var CAT_CATALOGO = CAT_DADOS.map(function(d){
  var pal = d[5] ? d[5].split('|').map(function(p){ var pref = /\*$/.test(p); return { t: p.replace(/\*$/, ''), pref: pref }; }) : [];
  return { id: d[0], label: d[1], ic: d[2], fam: d[3], esc: d[4], pal: pal, leg: d[6] || '' };
});
var CAT_POR_ID = {}, CAT_POR_LABEL = {}, CAT_LEGADO = {};
CAT_CATALOGO.forEach(function(c){ CAT_POR_ID[c.id] = c; CAT_POR_LABEL[c.label] = c; if (c.leg) CAT_LEGADO[c.leg] = c.label; });
/* ordem de teste das palavras: os mais específicos primeiro (UBER EATS antes de UBER, GOOGLE ADS antes de GOOGLE ONE…) */
var CAT_CEDO = ['delivery', 'apps_transporte', 'streaming', 'marketing', 'estrutura', 'cert_digital', 'anuidade_oab', 'custas', 'compras_online', 'jogos', 'dominio_hosp', 'apps_servicos', 'plano_saude', 'seguro_veiculo', 'ipva', 'impostos_pf', 'cartao', 'juros', 'sistemas'];
var CAT_ORDEM = CAT_CEDO.map(function(id){ return CAT_POR_ID[id]; }).concat(CAT_CATALOGO.filter(function(c){ return CAT_CEDO.indexOf(c.id) < 0 && c.id !== 'outros'; }));

/* as 5 categorias padrão antigas continuam com os mesmos ids; as novas se juntam a elas (aplicarPersonalizacao lê CATEGORIAS_PADRAO) */
CATEGORIAS_PADRAO.splice(0, CATEGORIAS_PADRAO.length);
CAT_CATALOGO.forEach(function(c){ CATEGORIAS_PADRAO.push({ id: c.id, label: c.label, fam: c.fam, ic: c.ic, esc: c.esc }); });
/* a lista de categorias do extrato passa a ser a mesma (rótulos novos) */
EXT_CATS.splice(0, EXT_CATS.length);
CAT_CATALOGO.forEach(function(c){ EXT_CATS.push(c.label); });

function catNormTxt(t){ return ' ' + String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9&]+/g, ' ').trim() + ' '; }
/* o rótulo de categoria escrito no passado (extrato antigo, "Dia a dia · …") no rótulo de hoje; nomes que a pessoa criou ficam como estão */
function catNomeNovo(nome){
  if (!CAT_PRONTO) return String(nome == null ? '' : nome).replace(/^Dia a dia\s*·\s*/i, '').trim() || 'Outros';
  var n = String(nome == null ? '' : nome).replace(/^Dia a dia\s*·\s*/i, '').trim();
  if (CAT_POR_LABEL[n]) return n;
  return CAT_LEGADO[n] || n || 'Outros';
}
/* a categoria que as palavras do texto indicam (rótulo) ou null */
function catClassificar(texto){
  if (!CAT_PRONTO) return null;
  var t = catNormTxt(texto), i, j, c, p;
  for (i = 0; i < CAT_ORDEM.length; i++){
    c = CAT_ORDEM[i];
    for (j = 0; j < c.pal.length; j++){ p = c.pal[j]; if (t.indexOf(' ' + p.t + (p.pref ? '' : ' ')) >= 0) return c.label; }
  }
  return null;
}
function catEscopoDe(label){ if (!CAT_PRONTO) return 'A'; var c = CAT_POR_LABEL[label]; return c ? c.esc : 'A'; }
/* ícone e cor de uma categoria (pelo rótulo ou pelo id); null se não for do catálogo */
function catVisualDe(chave){
  if (!CAT_PRONTO) return null;
  var c = CAT_POR_LABEL[catNomeNovo(chave)] || CAT_POR_ID[chave]; if (!c) return null;
  return { lu: c.ic, cor: CAT_FAM[c.fam].cor, fam: c.fam, id: c.id, label: c.label };
}
function catPaths(lu){ return (typeof IC_LUCIDE !== 'undefined' && IC_LUCIDE[lu]) || (lu === 'ellipsis' ? '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>' : ''); }
function catSvg(lu, t){
  var d = catPaths(lu);
  return '<svg viewBox="0 0 24 24" width="' + (t || 16) + '" height="' + (t || 16) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">' + d + '</svg>';
}
/* o rótulo de um limite de orçamento antigo ("Dia a dia · Mercado", "Alimentação"…) no rótulo de hoje */
function catRotNovo(rot){ if (!CAT_PRONTO) return String(rot || ''); var r = String(rot || ''); return r ? catNomeNovo(r) : r; }

/* opções agrupadas por família para <select> (rótulos como valor) */
function catOpcoesHtml(atual, so){
  if (!CAT_PRONTO) return '';
  var h = '', atualN = catNomeNovo(atual), vistos = {};
  CAT_FAMILIAS.forEach(function(f){
    var its = CAT_CATALOGO.filter(function(c){ return c.fam === f[0] && (!so || so.indexOf(c.esc) >= 0 || c.label === atualN); });
    if (!its.length) return;
    h += '<optgroup label="' + escapeHtml(f[1]) + '">' + its.map(function(c){ vistos[c.label] = 1; return '<option value="' + escapeHtml(c.label) + '"' + (c.label === atualN ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') + '</optgroup>';
  });
  if (atualN && !vistos[atualN]) h = '<option value="' + escapeHtml(atualN) + '" selected>' + escapeHtml(atualN) + '</option>' + h;
  return h;
}
/* opções (valor = id) para a ficha de edição de uma despesa já lançada: as da conta, a atual e as criadas à mão */
function catOpcoesIdHtml(atualId, so){
  if (!CAT_PRONTO) return '';
  var h = '', vistos = {};
  CAT_FAMILIAS.forEach(function(f){
    var its = CATEGORIAS_LISTA.filter(function(c){ var ci = CAT_POR_ID[c.id]; return ci && ci.fam === f[0] && (!so || so.indexOf(ci.esc) >= 0 || c.id === atualId); });
    if (!its.length) return;
    h += '<optgroup label="' + escapeHtml(f[1]) + '">' + its.map(function(c){ vistos[c.id] = 1; return '<option value="' + escapeHtml(c.id) + '"' + (c.id === atualId ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') + '</optgroup>';
  });
  var meus = CATEGORIAS_LISTA.filter(function(c){ return !CAT_POR_ID[c.id]; });
  if (meus.length) h += '<optgroup label="Minhas categorias">' + meus.map(function(c){ return '<option value="' + escapeHtml(c.id) + '"' + (c.id === atualId ? ' selected' : '') + '>' + escapeHtml(c.label) + '</option>'; }).join('') + '</optgroup>';
  return h;
}
/* Campo de categoria com busca: o <select> continua ali (escondido) guardando o valor e disparando "change", como antes; por cima fica um botão que abre o seletor com busca
   (extratos, reclassificar em lote e regras que você ensinou). "so" (['A','F'] ou ['A','J']) mostra primeiro só as categorias daquele lado, com o atalho para as do outro. */
function catPsBotaoHtml(label){
  var v = catVisualDe(label), fam = v ? CAT_FAM[v.fam].nome : '';
  return '<span class="cat-ic" style="background:' + (v ? v.cor : '#8A93AD') + '">' + catSvg(v ? v.lu : 'tag', 16) + '</span><span class="cat-pk-t"><b>' + escapeHtml(label) + '</b>' + (fam ? '<small>' + escapeHtml(fam) + '</small>' : '') + '</span><span class="cat-pk-seta">▾</span>';
}
function catSelectHtml(attrs, atual, so){
  if (!CAT_PRONTO) return '<select class="ext-sel" ' + attrs + '>' + catOpcoesHtml(atual, so) + '</select>';
  return '<span class="cat-ps"' + (so ? ' data-catps-so="' + so.join('') + '"' : '') + '><button type="button" class="cat-pk-btn" data-catps-btn aria-haspopup="dialog" aria-label="Escolher a categoria">' + catPsBotaoHtml(catNomeNovo(atual)) + '</button>' +
    '<select class="ext-sel cat-oculto" ' + attrs + ' tabindex="-1" aria-hidden="true">' + catOpcoesHtml(atual, so) + '</select></span>';
}
var catPsS = { sel: null, wrap: null, q: '', todas: false, so: null };
function catPsAtual(){ var s = catPsS.sel; return catNomeNovo((s && s.value) || 'Outros'); }
function catPsLista(){
  var S = catPsS, l = qs('catPsL'), rod = qs('catPsRod'); if (!l || !S.sel) return;
  var atual = catPsAtual(), toks = catNormTxt(S.q).trim().split(' ').filter(Boolean), h = '', n = 0;
  CAT_FAMILIAS.forEach(function(f){
    var its = CAT_CATALOGO.filter(function(c){
      if (c.fam !== f[0]) return false;
      if (S.so && !S.todas && S.so.indexOf(c.esc) < 0 && c.label !== atual) return false;
      var hay = catNormTxt(c.label + ' ' + f[1] + ' ' + c.pal.map(function(p){ return p.t; }).join(' '));
      return toks.every(function(t){ return hay.indexOf(t) >= 0; });
    });
    if (!its.length) return;
    h += '<div class="cat-pk-f"><span style="background:' + f[2] + '"></span>' + escapeHtml(f[1]) + '</div>';
    its.forEach(function(c){ n++; h += '<button type="button" class="cat-pk-i' + (c.label === atual ? ' on' : '') + '" data-catps-it="' + escapeHtml(c.label) + '"><span class="cat-ic" style="background:' + f[2] + '">' + catSvg(c.ic, 15) + '</span><span>' + escapeHtml(c.label) + '</span></button>'; });
  });
  if (!n) h += '<div class="cat-pk-v">Nenhuma categoria com “' + escapeHtml(S.q) + '”.' + (S.so && !S.todas ? ' <button type="button" class="cat-pk-lk" data-catps-todas="1">Procurar nas do outro lado também</button>' : '') + '</div>';
  l.innerHTML = h;
  if (rod) rod.innerHTML = S.so ? '<button type="button" class="cat-pk-lk" data-catps-todas="1">' + (S.todas ? 'Mostrar só as da ' + (S.so.indexOf('F') >= 0 ? 'pessoa física' : 'PJ') : 'Mostrar também as do outro lado') + '</button>' : '';
  if (rod) rod.style.display = S.so ? '' : 'none';
}
function catPsAjusta(){ var bg = qs('catPsBg'); if (!bg || !window.visualViewport) return; bg.style.top = window.visualViewport.offsetTop + 'px'; bg.style.height = window.visualViewport.height + 'px'; }
function catPsAbrir(btn){
  var w = btn.closest('.cat-ps'), sel = w && w.querySelector('select'); if (!sel) return;
  var so = w.getAttribute('data-catps-so');
  catPsS = { sel: sel, wrap: w, q: '', todas: false, so: so ? so.split('') : null };
  var bg = qs('catPsBg');
  if (!bg){
    bg = document.createElement('div'); bg.id = 'catPsBg'; bg.className = 'cat-ps-bg';
    bg.innerHTML = '<div class="cat-ps-pan" id="catPsPan" role="dialog" aria-label="Escolher a categoria"><input type="search" id="catPsQ" class="cat-pk-q" placeholder="Buscar categoria (uber, netflix, farmácia…)" autocomplete="off" autocapitalize="off"><div class="cat-pk-l" id="catPsL"></div><div class="cat-pk-rod" id="catPsRod"></div></div>';
    document.body.appendChild(bg);
    if (window.visualViewport){ window.visualViewport.addEventListener('resize', catPsAjusta); window.visualViewport.addEventListener('scroll', catPsAjusta); }
  }
  qs('catPsQ').value = '';
  catPsLista(); bg.classList.add('show'); catPsAjusta();
  var on = bg.querySelector('.cat-pk-i.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'center' });
  try{ qs('catPsQ').focus(); }catch(e){}
}
function catPsFechar(){ var bg = qs('catPsBg'); if (bg) bg.classList.remove('show'); var b = catPsS.wrap && catPsS.wrap.querySelector('[data-catps-btn]'); catPsS.sel = null; if (b && b.focus) try{ b.focus(); }catch(e){} }
function catPsEscolher(label){
  var S = catPsS, sel = S.sel; if (!sel) return;
  var tem = Array.prototype.some.call(sel.options, function(o){ return o.value === label; });
  if (!tem) sel.appendChild(new Option(label, label));
  var mudou = sel.value !== label; sel.value = label;
  var b = S.wrap && S.wrap.querySelector('[data-catps-btn]'); if (b) b.innerHTML = catPsBotaoHtml(label);
  catPsFechar();
  if (mudou) sel.dispatchEvent(new Event('change', { bubbles: true }));
}

/* ---------- seletor de categoria da ficha de despesa (PJ e PF) ---------- */
var catPickS = { aberto: false, q: '', todas: false };
function catColunaAtual(){ try{ return (formStateDespesa && formStateDespesa.coluna) === 'pf' ? 'pf' : 'pj'; }catch(e){ return 'pj'; } }
function catListaParaPick(){
  var col = catColunaAtual(), ok = col === 'pf' ? ['A', 'F'] : ['A', 'J'], sel = null;
  try{ sel = formStateDespesa.categoria; }catch(e){}
  var out = [];
  CAT_FAMILIAS.forEach(function(f){
    var its = CATEGORIAS_LISTA.filter(function(c){ var ci = CAT_POR_ID[c.id]; return ci && ci.fam === f[0] && (catPickS.todas || ok.indexOf(ci.esc) >= 0 || c.id === sel); });
    if (its.length) out.push({ nome: f[1], cor: f[2], its: its });
  });
  var meus = CATEGORIAS_LISTA.filter(function(c){ return !CAT_POR_ID[c.id]; });
  if (meus.length) out.push({ nome: 'Minhas categorias', cor: '', its: meus, meus: true });
  return out;
}
function catVisCat(c){ if (!CAT_PRONTO) return { lu: 'tag', cor: (c && c.cor) || '#8B5CF6' }; var ci = CAT_POR_ID[c.id]; return ci ? { lu: ci.ic, cor: CAT_FAM[ci.fam].cor } : { lu: 'tag', cor: c.cor || '#8B5CF6' }; }
function catIconeHtml(c, t){ var v = catVisCat(c); return '<span class="cat-ic" style="background:' + v.cor + '">' + catSvg(v.lu, t || 16) + '</span>'; }
function catPickAtualizar(){
  if (!CAT_PRONTO) return;
  var btn = qs('catPickBtn'); if (!btn) return;
  var id = null; try{ id = formStateDespesa.categoria; }catch(e){}
  var c = CATEGORIAS_LISTA.filter(function(x){ return x.id === id; })[0] || CATEGORIAS_LISTA.filter(function(x){ return x.id === 'outros'; })[0];
  if (!c) return;
  var ci = CAT_POR_ID[c.id], fam = ci ? CAT_FAM[ci.fam].nome : 'Minha categoria';
  btn.innerHTML = catIconeHtml(c, 18) + '<span class="cat-pk-t"><b>' + escapeHtml(c.label) + '</b><small>' + escapeHtml(fam) + '</small></span><span class="cat-pk-seta">▾</span>';
  if (catPickS.aberto) catPickDesenhar();
}
function catPickDesenhar(){
  var pop = qs('catPickPop'); if (!pop) return;
  var toks = catNormTxt(catPickS.q).trim().split(' ').filter(Boolean), sel = null; try{ sel = formStateDespesa.categoria; }catch(e){}
  var h = '<input type="search" id="catPickQ" class="cat-pk-q" placeholder="Buscar categoria (uber, netflix, farmácia…)" value="' + escapeHtml(catPickS.q) + '" autocomplete="off"><div class="cat-pk-l">', n = 0;
  catListaParaPick().forEach(function(f){
    var its = f.its.filter(function(c){ var ci = CAT_POR_ID[c.id], hay = catNormTxt(c.label + ' ' + f.nome + ' ' + (ci ? ci.pal.map(function(p){ return p.t; }).join(' ') : '')); return toks.every(function(t){ return hay.indexOf(t) >= 0; }); });
    if (!its.length) return;
    h += '<div class="cat-pk-f">' + (f.cor ? '<span style="background:' + f.cor + '"></span>' : '') + escapeHtml(f.nome) + '</div>';
    its.forEach(function(c){ n++; h += '<button type="button" class="cat-pk-i' + (c.id === sel ? ' on' : '') + '" data-catpick="' + escapeHtml(c.id) + '">' + catIconeHtml(c, 15) + '<span>' + escapeHtml(c.label) + '</span></button>'; });
  });
  if (!n) h += '<div class="cat-pk-v">Nenhuma categoria com “' + escapeHtml(catPickS.q) + '”.' + (catPickS.todas ? '' : ' <button type="button" class="cat-pk-lk" data-catpick-todas="1">Procurar em todas</button>') + '</div>';
  h += '</div><div class="cat-pk-rod"><button type="button" class="cat-pk-lk" data-catpick-todas="1">' + (catPickS.todas ? 'Mostrar só as da ' + (catColunaAtual() === 'pf' ? 'pessoa física' : 'PJ') : 'Mostrar também as do outro lado') + '</button></div>';
  pop.innerHTML = h; pop.style.display = 'flex';
  var inp = qs('catPickQ'); if (inp && document.activeElement !== inp){ inp.focus(); try{ inp.setSelectionRange(catPickS.q.length, catPickS.q.length); }catch(e){} }
}
function catPickAbrir(){ catPickS.aberto = true; catPickS.q = ''; catPickDesenhar(); }
function catPickFechar(){ catPickS.aberto = false; var pop = qs('catPickPop'); if (pop) pop.style.display = 'none'; }
function catPickEscolher(id){
  var sc = qs('segDespesaCategoria'), b = sc && sc.querySelector('[data-value="' + id + '"]');
  if (b) b.click();
  catPickFechar(); catPickAtualizar();
}
/* chamado por montarControlesDinamicos: o seletor visível + os botões escondidos (guardam o estado e atendem o resto do app) */
function catPickMontar(){
  if (!CAT_PRONTO) return;
  var sc = qs('segDespesaCategoria'); if (!sc) return;
  sc.classList.add('cat-oculto');
  var campo = sc.parentNode, w = qs('catPick');
  if (!w){ w = document.createElement('div'); w.id = 'catPick'; w.className = 'cat-pick'; w.innerHTML = '<button type="button" id="catPickBtn" class="cat-pk-btn" aria-haspopup="listbox"></button><div id="catPickPop" class="cat-pk-pop" style="display:none"></div>'; campo.insertBefore(w, sc); }
  catPickAtualizar();
}

/* ---------- reclassificar "Outros" em lote ---------- */
var catRcS = null;
function catRcColeta(){
  var out = { desp: [], dd: [], sem: 0 };
  despesas.forEach(function(d){
    if (d.transferenciaId || catIdValida(d.categoria) !== 'outros') return;
    var s = catClassificar((d.nome || '') + ' ' + (d.observacoes || ''));
    if (s && s !== 'Outros') out.desp.push({ k: 'desp', id: d.id, t: d.nome || 'Sem nome', d: d.data || '', v: Number(d.valorPadrao || d.valor || 0), sug: s }); else out.sem++;
  });
  extratos.forEach(function(doc){
    if (doc.tipo !== 'diaadia' || !Array.isArray(doc.linhas)) return;
    doc.linhas.forEach(function(l){
      if (catNomeNovo(l.c) !== 'Outros') return;
      var s = catClassificar(l.t || '');
      if (s && s !== 'Outros') out.dd.push({ k: 'dd', id: l.id, doc: doc.id, t: l.t || 'Sem nome', d: l.d, v: Number(l.v) || 0, sug: s }); else out.sem++;
    });
  });
  return out;
}
function catRcContagem(){ var c = catRcColeta(); return { sug: c.desp.length + c.dd.length, sem: c.sem }; }
function catRcMontar(){
  if (qs('overlayCatRc')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayCatRc'; d.style.zIndex = '260';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Reclassificar “Outros”</h2><button class="icon-btn" type="button" data-catrc="x" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="overlayCatRcC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-catrc]') : null; if (!b) return; var a = b.getAttribute('data-catrc');
    if (a === 'x' || a === 'cancelar') d.classList.remove('show');
    else if (a === 'todas'){ catRcS.itens.forEach(function(x){ x.on = true; }); catRcDesenhar(); }
    else if (a === 'nenhuma'){ catRcS.itens.forEach(function(x){ x.on = false; }); catRcDesenhar(); }
    else if (a === 'aplicar') catRcAplicar();
  });
  d.addEventListener('change', function(e){
    var t = e.target; if (!t || !t.getAttribute) return;
    var i = t.getAttribute('data-catrc-on'); if (i !== null){ catRcS.itens[Number(i)].on = t.checked; catRcAtualizaBotao(); return; }
    i = t.getAttribute('data-catrc-cat'); if (i !== null) catRcS.itens[Number(i)].sug = t.value;
  });
}
function catRcAtualizaBotao(){ var b = document.querySelector('#overlayCatRc [data-catrc="aplicar"]'), n = catRcS.itens.filter(function(x){ return x.on; }).length; if (b){ b.disabled = !n || catRcS.ocupado; b.textContent = 'Aplicar a ' + n + (n === 1 ? ' lançamento' : ' lançamentos'); } }
function catRcDesenhar(){
  var el = qs('overlayCatRcC'), S = catRcS; if (!el || !S) return;
  var linha = function(x, i){
    return '<label class="cat-rc-it"><input type="checkbox" data-catrc-on="' + i + '"' + (x.on ? ' checked' : '') + '><span class="cat-rc-t"><b>' + escapeHtml(x.t) + '</b><small>' + (x.d ? escapeHtml(fmtData(String(x.d).slice(0, 10))) + ' · ' : '') + fmtMoeda(x.v) + '</small></span>' +
      '<span class="cat-rc-sel">' + catSelectHtml('data-catrc-cat="' + i + '" aria-label="Categoria sugerida"', x.sug) + '</span></label>';
  };
  var desp = S.itens.map(function(x, i){ return x.k === 'desp' ? linha(x, i) : ''; }).join(''), dd = S.itens.map(function(x, i){ return x.k === 'dd' ? linha(x, i) : ''; }).join('');
  var h = '<div class="pb-aviso">O app olhou o nome de cada lançamento em “Outros” e sugeriu a categoria. Nada muda até você tocar em <b>Aplicar</b>; dá para desmarcar ou trocar a sugestão de cada um.</div>';
  if (!S.itens.length) h += '<div class="saldo-data" style="padding:10px 4px">Nenhum lançamento em “Outros” com sugestão.' + (S.sem ? ' ' + S.sem + (S.sem === 1 ? ' continua sem sugestão (corrija na mão).' : ' continuam sem sugestão (corrija na mão).') : '') + '</div>';
  else {
    if (desp) h += '<div class="cat-rc-g">Despesas lançadas (' + S.itens.filter(function(x){ return x.k === 'desp'; }).length + ')</div>' + desp;
    if (dd) h += '<div class="cat-rc-g">Gastos do extrato (' + S.itens.filter(function(x){ return x.k === 'dd'; }).length + ')</div>' + dd;
    if (S.sem) h += '<div class="saldo-data" style="margin-top:8px">' + S.sem + (S.sem === 1 ? ' lançamento em “Outros” não tem sugestão e fica como está.' : ' lançamentos em “Outros” não têm sugestão e ficam como estão.') + '</div>';
    h += '<div class="cat-rc-ac"><button type="button" class="btn btn-ghost pb-b" data-catrc="todas">Marcar todas</button><button type="button" class="btn btn-ghost pb-b" data-catrc="nenhuma">Desmarcar todas</button></div>';
  }
  h += '<div class="form-error" id="catRcErro"></div><div class="f-rod-in"><button type="button" class="btn btn-ghost" data-catrc="cancelar">Fechar</button>' + (S.itens.length ? '<button type="button" class="btn btn-primary" data-catrc="aplicar"></button>' : '') + '</div>';
  el.innerHTML = h; catRcAtualizaBotao();
}
function catRcAbrir(){
  catRcMontar(); var c = catRcColeta();
  catRcS = { itens: c.desp.concat(c.dd).map(function(x){ x.on = true; return x; }), sem: c.sem, ocupado: false };
  catRcDesenhar(); qs('overlayCatRc').classList.add('show');
}
function catRcAplicar(){
  var S = catRcS, esc = qs('catRcErro'); if (!S || S.ocupado) return;
  var sel = S.itens.filter(function(x){ return x.on; }); if (!sel.length) return;
  S.ocupado = true; catRcAtualizaBotao();
  var cadeia = Promise.resolve(), porDoc = {};
  sel.forEach(function(x){
    if (x.k === 'desp'){
      var d = despesas.filter(function(z){ return z.id === x.id; })[0], c = CAT_POR_LABEL[x.sug]; if (!d || !c) return;
      cadeia = cadeia.then(function(){ return persistPatchDespesa(d, { categoria: c.id }); });
    } else (porDoc[x.doc] = porDoc[x.doc] || []).push(x);
  });
  Object.keys(porDoc).forEach(function(docId){
    cadeia = cadeia.then(function(){
      var doc = extDocPorId(docId); if (!doc) return;
      var cats = JSON.parse(JSON.stringify(doc.cats || {})), linhas = JSON.parse(JSON.stringify(doc.linhas || []));
      porDoc[docId].forEach(function(x){
        var ln = linhas.filter(function(l){ return l.id === x.id; })[0]; if (!ln) return;
        var o = cats[ln.c]; if (o){ o.v = r2(o.v - ln.v); o.n = Math.max(0, (o.n || 1) - 1); if (o.n <= 0 || o.v < 0.005) delete cats[ln.c]; }
        var nv = cats[x.sug] = cats[x.sug] || { v: 0, n: 0 }; nv.v = r2(nv.v + ln.v); nv.n++; ln.c = x.sug;
      });
      return extGravar(doc.id, { tipo: 'diaadia', mes: doc.mes, conta: doc.conta, coluna: doc.coluna, cats: cats, linhas: linhas, atualizadoEm: new Date().toISOString() });
    });
  });
  cadeia.then(function(){
    qs('overlayCatRc').classList.remove('show'); toast(sel.length + (sel.length === 1 ? ' lançamento reclassificado.' : ' lançamentos reclassificados.'));
    try{ ctAtualizarTelas(); }catch(e){} try{ renderEditorSeAberto(); }catch(e){}
  }).catch(function(e){ S.ocupado = false; catRcAtualizaBotao(); var er = qs('catRcErro'); if (er) er.textContent = 'Não consegui aplicar tudo: ' + (e && e.message ? e.message : 'tente de novo') + '. O que já foi aplicado fica.'; });
}
/* botão (no gerenciador de categorias e na Análise) */
function catRcBotaoHtml(classe){
  if (!CAT_PRONTO) return '';
  var c = catRcContagem(); if (!c.sug) return '';
  return '<button type="button" class="' + (classe || 'btn btn-ghost pb-b') + '" data-cat-reclass="1">Reclassificar “Outros” em lote · ' + c.sug + (c.sug === 1 ? ' sugestão' : ' sugestões') + '</button>';
}
function renderEditorSeAberto(){ var ov = qs('overlayEditor'); if (ov && ov.classList.contains('show') && typeof renderEditor === 'function') renderEditor(); }

function catCss(){
  if (document.getElementById('catCss')) return;
  var st = document.createElement('style'); st.id = 'catCss';
  st.textContent =
    '.cat-oculto{display:none!important}.cat-pick{position:relative}' +
    '.cat-ic{width:28px;height:28px;border-radius:9px;color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none}' +
    '.cat-pk-btn{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;border:1.5px solid var(--border);border-radius:12px;background:var(--surface);padding:6px 10px;font:inherit;color:var(--ink);cursor:pointer;text-align:left}.cat-pk-btn:hover,.cat-pk-btn:focus-visible{border-color:var(--accent)}' +
    '.cat-pk-t{flex:1;min-width:0}.cat-pk-t b{display:block;font-size:var(--t3,14px);line-height:1.2}.cat-pk-t small{display:block;color:var(--ink-soft);font-size:var(--t1)}.cat-pk-seta{color:var(--ink-soft)}' +
    '.cat-pk-pop{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:300;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.22);padding:8px;max-height:min(420px,60vh);display:none;flex-direction:column}' +
    '.cat-pk-q{width:100%;min-height:40px;border:1.5px solid var(--border);border-radius:10px;padding:6px 10px;font:inherit;background:var(--bg);color:var(--ink);margin-bottom:6px}.cat-pk-l{overflow-y:auto;flex:1;min-height:0}' +
    '.cat-pk-f{position:sticky;top:0;background:var(--surface);display:flex;align-items:center;gap:6px;font-size:var(--t1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);padding:8px 4px 4px}.cat-pk-f span{width:10px;height:10px;border-radius:3px}' +
    '.cat-pk-i{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;border:0;background:transparent;border-radius:10px;padding:4px 6px;font:inherit;font-size:var(--t3,14px);color:var(--ink);cursor:pointer;text-align:left}.cat-pk-i:hover{background:var(--surface-2)}.cat-pk-i.on{background:rgba(201,133,0,.14);font-weight:700}' +
    '.cat-pk-v{padding:12px 6px;color:var(--ink-soft);font-size:var(--t2)}.cat-pk-rod{border-top:1px solid var(--border);margin-top:6px;padding-top:4px}.cat-pk-lk{border:0;background:transparent;color:var(--accent);font:inherit;font-weight:700;font-size:var(--t2);cursor:pointer;min-height:36px;padding:0 4px}' +
    '@media(max-width:700px){.cat-pk-pop{position:fixed;left:8px;right:8px;top:auto;bottom:8px;max-height:72vh}}' +
    '.cat-ps{flex:1 1 180px;min-width:0;display:block}.cat-ps .cat-pk-btn{min-height:44px}' +
    '.cat-ps-bg{position:fixed;left:0;right:0;top:0;height:100%;z-index:950;background:var(--overlay);display:none;align-items:flex-end;justify-content:center;padding:8px}.cat-ps-bg.show{display:flex}' +
    '.cat-ps-pan{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.28);padding:10px;width:100%;max-width:480px;max-height:100%;display:flex;flex-direction:column}' +
    '@media(min-width:701px){.cat-ps-bg{align-items:center}.cat-ps-pan{max-height:min(560px,80%)}}' +
    '.cat-rc-g{font-size:var(--t1);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin:12px 2px 4px}.cat-rc-it{display:grid;grid-template-columns:22px minmax(0,1fr) minmax(130px,46%);gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer}.cat-rc-it input{width:18px;height:18px;accent-color:var(--accent)}' +
    '.cat-rc-t b{display:block;font-size:var(--t3,14px);overflow:hidden;text-overflow:ellipsis}.cat-rc-t small{color:var(--ink-soft);font-size:var(--t1)}.cat-rc-sel{width:100%;min-height:36px}.cat-rc-ac{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}' +
    '#overlayCatRcC>*{flex-shrink:0}@media(max-width:560px){.cat-rc-it{grid-template-columns:22px minmax(0,1fr)}.cat-rc-sel{grid-column:2}}' +
    '.tag-cat.cat-novo{display:inline-flex;align-items:center;gap:5px;color:#fff}';
  document.head.appendChild(st);
}
(function(){
  catCss();
  document.addEventListener('click', function(e){
    var t = e.target; if (!t || !t.closest) return;
    var btn = t.closest('#catPickBtn'); if (btn){ if (catPickS.aberto) catPickFechar(); else catPickAbrir(); return; }
    var pb = t.closest('[data-catps-btn]'); if (pb){ e.preventDefault(); catPsAbrir(pb); return; }
    var pi = t.closest('[data-catps-it]'); if (pi){ catPsEscolher(pi.getAttribute('data-catps-it')); return; }
    if (t.closest('[data-catps-todas]')){ catPsS.todas = !catPsS.todas; catPsLista(); return; }
    if (t.id === 'catPsBg'){ catPsFechar(); return; }
    var it = t.closest('[data-catpick]'); if (it){ catPickEscolher(it.getAttribute('data-catpick')); return; }
    if (t.closest('[data-catpick-todas]')){ catPickS.todas = !catPickS.todas; catPickDesenhar(); return; }
    var rc = t.closest('[data-cat-reclass]'); if (rc){ e.preventDefault(); catRcAbrir(); return; }
    if (catPickS.aberto && !t.closest('#catPickPop')) catPickFechar();
  });
  document.addEventListener('input', function(e){ if (e.target && e.target.id === 'catPsQ'){ catPsS.q = e.target.value; catPsLista(); } });
  document.addEventListener('input', function(e){ if (e.target && e.target.id === 'catPickQ'){ catPickS.q = e.target.value; catPickDesenhar(); } });
  document.addEventListener('keydown', function(e){ var bg = qs('catPsBg'); if (e.key === 'Escape' && bg && bg.classList.contains('show')){ e.stopPropagation(); catPsFechar(); } }, true);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && catPickS.aberto){ e.stopPropagation(); catPickFechar(); } }, true);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { catClassificar: catClassificar, catNomeNovo: catNomeNovo, catRotNovo: catRotNovo, catRcColeta: catRcColeta, CAT_CATALOGO: CAT_CATALOGO });
  CAT_PRONTO = true;   /* daqui em diante as funções acima funcionam (as declarações são içadas e o app pode chamá-las antes deste ponto) */
  try{ aplicarPersonalizacao(); montarControlesDinamicos(); }catch(e){ console.error('categorias', e); }
})();
