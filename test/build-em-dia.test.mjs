// O Cloudflare publica o que está no repositório: NÃO roda o montar.py. Este teste garante que public/index.html (o que vai para o ar) está em dia com os módulos de cliente/*.js:
// roda o montar.py e vê se algo mudou (se mudou, o build estava velho: o teste falha e deixa os arquivos já atualizados, para você conferir o git diff e publicar).
// Também confere que o arquivo publicado está minificado e que os scripts dele e o shim têm sintaxe válida.  Use: node test/rodar.mjs build-em-dia
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
let falhas = 0; const check = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const hash = (f) => createHash('sha1').update(readFileSync(join(RAIZ, f))).digest('hex');
const antes = { fonte: hash('cliente/index.fonte.html'), pub: hash('public/index.html') };
let rodou = true; try { execFileSync('python3', ['cliente/montar.py'], { cwd: RAIZ, stdio: 'pipe' }); } catch (e) { rodou = false; console.log('  (montar.py não rodou: ' + String(e.message).split('\n')[0] + ')'); }
if (rodou) {
  const depois = { fonte: hash('cliente/index.fonte.html'), pub: hash('public/index.html') };
  check(antes.fonte === depois.fonte, 'cliente/index.fonte.html está em dia com os módulos de cliente/*.js' + (antes.fonte === depois.fonte ? '' : ' — estava velho: rodei o montar.py, confira o git diff'));
  check(antes.pub === depois.pub, 'public/index.html (o que vai para o ar) está em dia com o arquivo-fonte' + (antes.pub === depois.pub ? '' : ' — estava velho: já foi gerado de novo, publique os dois arquivos'));
}
const pub = readFileSync(join(RAIZ, 'public/index.html'), 'utf8'), fonte = readFileSync(join(RAIZ, 'cliente/index.fonte.html'), 'utf8');
check(pub.length < fonte.length * 0.9, 'o arquivo publicado está minificado (' + Math.round(pub.length / 1024) + ' KB de ' + Math.round(fonte.length / 1024) + ' KB)');
check(!/\/\*(PA|NT|OB7|CT|PB)-INICIO\*\//.test(pub), 'o arquivo publicado não tem os marcadores de montagem');
let ok = true, n = 0; for (const m of pub.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new Function(m[1]); } catch (e) { ok = false; console.log('    erro de sintaxe: ' + e.message); } }
check(ok && n >= 2, n + ' scripts do arquivo publicado têm sintaxe válida');
try { execFileSync('node', ['--check', join(RAIZ, 'public/shim.js')], { stdio: 'pipe' }); check(true, 'public/shim.js tem sintaxe válida'); } catch (e) { check(false, 'public/shim.js com erro de sintaxe'); }
console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\ntudo certo'); process.exit(falhas ? 1 : 0);
