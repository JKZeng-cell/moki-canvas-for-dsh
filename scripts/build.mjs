import {cpSync,readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname,join,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const mokiRepo=resolve(process.env.MOKI_REPO||join(root,'vendor/moki'))
const require=createRequire(join(mokiRepo,'package.json'))
const esbuild=require('esbuild')
await esbuild.build({entryPoints:[join(root,'src/client.js')],outfile:join(root,'client.js'),bundle:true,format:'iife',platform:'browser',target:'chrome132',legalComments:'eof'})
const appOut=resolve(root,'app')
if(!appOut.startsWith(root+sep)||appOut!==join(root,'app'))throw new Error('Invalid build destination')
if(!existsSync(join(mokiRepo,'dist/web/index.html')))throw new Error('Run npm run build in the MOKI repository first')
rmSync(appOut,{recursive:true,force:true})
cpSync(join(mokiRepo,'dist/web'),appOut,{recursive:true})
const bootstrap=`<script data-moki-embed-bootstrap>
window.mokiDshEmbed=new URLSearchParams(location.search).get('dshEmbed')==='1';
if(window.mokiDshEmbed){document.documentElement.dataset.dshEmbed='true';const mode=new URLSearchParams(location.search).get('theme');if(mode==='dark'||mode==='light')localStorage.setItem('moki-whiteboard-theme',mode);}
</script>`
const index=join(appOut,'index.html')
writeFileSync(index,readFileSync(index,'utf8').replace('</head>',bootstrap+'</head>'))
mkdirSync(join(root,'lib'),{recursive:true})
const sourceVersion=JSON.parse(readFileSync(join(mokiRepo,'package.json'),'utf8')).version
// UI iteration must not rewrite the running tool host while DSH has active turns.
if(!process.argv.includes('--web-only')) {
 const result = await esbuild.build({
  entryPoints:[join(root,'src/host.js')],outfile:join(root,'lib/host.mjs'),bundle:true,format:'esm',platform:'node',target:'node22',logLevel:'info',legalComments:'eof',metafile:true,
  nodePaths:[join(mokiRepo,'node_modules')],
  banner:{js:"import {createRequire as __mokiRequire} from 'node:module';const require=__mokiRequire(import.meta.url);"},
  external:['zod','sharp','unpdf','pdfjs-dist','@extend-ai/react-pptx','dsh-univer-office'],
  alias:{'@moki':join(mokiRepo,'dist')},
  plugins:[{name:'moki-version',setup(build){
    build.onResolve({filter:/[\\/]app-metadata\.js$/},args=>({path:args.path,namespace:'moki-version'}))
    build.onLoad({filter:/.*/,namespace:'moki-version'},()=>({contents:`export const APP_VERSION=${JSON.stringify(sourceVersion)}`,loader:'js'}))
  }}],
 })
 mkdirSync(join(root,'.dev'),{recursive:true})
 writeFileSync(join(root,'.dev/host-metafile.json'),JSON.stringify(result.metafile,null,2)+'\n')
}
writeFileSync(join(root,'lib/build-info.json'),JSON.stringify({mokiVersion:sourceVersion,builtAt:new Date().toISOString()},null,2)+'\n')
