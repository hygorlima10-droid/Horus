// Gera public/index.html (o arquivo que vai para o ar) a partir de cliente/index.fonte.html (o arquivo legível, onde se edita).
// Tira só comentários e espaços e simplifica a sintaxe: NÃO troca nomes de funções nem de variáveis (testado: trocar os nomes só economizaria mais ~4% e aumenta o risco; NOMES_CURTOS=1 liga, se um dia valer a pena).
// Uso: node cliente/minificar.mjs   (o montar.py chama sozinho no fim).  Sem o esbuild instalado, copia o arquivo sem minificar e avisa (nunca trava).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..'), FONTE = join(RAIZ, 'cliente/index.fonte.html'), SAIDA = join(RAIZ, 'public/index.html');
function acharEsbuild() {
  const tentativas = [() => createRequire(join(RAIZ, 'package.json'))('esbuild')];
  const npx = join(homedir(), '.npm/_npx');
  if (existsSync(npx)) for (const d of readdirSync(npx)) tentativas.push(() => createRequire(join(npx, d, 'package.json'))('esbuild'));
  if (process.env.ESBUILD_DIR) tentativas.push(() => createRequire(join(process.env.ESBUILD_DIR, 'package.json'))('esbuild'));
  for (const t of tentativas) { try { return t(); } catch (e) { /* tenta o próximo */ } }
  return null;
}
const html = readFileSync(FONTE, 'utf8'), esb = acharEsbuild();
if (!esb) { writeFileSync(SAIDA, html); console.log('AVISO: esbuild não encontrado; public/index.html foi copiado SEM minificar (rode "npm install" e tente de novo).'); process.exit(0); }
let nScripts = 0, nEstilos = 0;
const opcoes = (loader) => ({ loader, minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: !!process.env.NOMES_CURTOS, charset: 'utf8', legalComments: 'none', target: 'es2019' });
const saida = html
  .replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, corpo) => {
    if (/type\s*=\s*["']?(?!text\/javascript|application\/javascript)[^"'\s>]+/i.test(attrs) && !/type\s*=\s*["']?(text|application)\/javascript/i.test(attrs)) return m;   // JSON e outros tipos ficam como estão
    if (!corpo.trim()) return m;
    nScripts++; return '<script' + attrs + '>' + esb.transformSync(corpo, opcoes('js')).code.trimEnd() + '</script>';
  })
  .replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, corpo) => { if (!corpo.trim()) return m; nEstilos++; return '<style' + attrs + '>' + esb.transformSync(corpo, opcoes('css')).code.trimEnd() + '</style>'; });
writeFileSync(SAIDA, saida);
console.log('minificado: ' + nScripts + ' scripts, ' + nEstilos + ' estilos; ' + Math.round(html.length / 1024) + ' KB -> ' + Math.round(saida.length / 1024) + ' KB');
