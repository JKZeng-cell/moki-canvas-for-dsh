import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const packages=new Map()
const add=dir=>{const pkg=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));packages.set(pkg.name+'@'+pkg.version,{dir,pkg})}
const meta=JSON.parse(readFileSync(join(root,'.dev/host-metafile.json'),'utf8'))
for(const file of Object.keys(meta.inputs).filter(file=>file.replaceAll('\\','/').includes('/node_modules/'))){
  let dir=dirname(resolve(root,file))
  while(dir!==dirname(dir)&&(!existsSync(join(dir,'package.json'))||!JSON.parse(readFileSync(join(dir,'package.json'),'utf8')).name))dir=dirname(dir)
  if(existsSync(join(dir,'package.json')))add(dir)
}
for(const name of ['react','react-dom','scheduler','lucide-react','pdfjs-dist','zod'])add(join(root,'vendor/moki/node_modules',name))
for(const name of Object.keys(JSON.parse(readFileSync(join(root,'package.json'),'utf8')).dependencies))add(join(root,'node_modules',name))
mkdirSync(join(root,'licenses'),{recursive:true})
const rows=[],missing=[]
for(const {dir,pkg} of [...packages.values()].sort((a,b)=>a.pkg.name.localeCompare(b.pkg.name))){
  const files=readdirSync(dir).filter(name=>/^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(name))
  const label=pkg.name+' '+pkg.version
  const license=typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license??'See package')
  if(files.length){
    const output=pkg.name.replaceAll('/','__').replaceAll('@','')+'-'+pkg.version+'.txt'
    writeFileSync(join(root,'licenses',output),label+'\n\n'+files.map(file=>`--- ${file} ---\n`+readFileSync(join(dir,file),'utf8')).join('\n\n'))
    rows.push(`| ${label} | ${license} | [License](licenses/${output}) |`)
  }else if(pkg.name==='abstract-logging'){
    rows.push(`| ${label} | ${license} | [License](licenses/abstract-logging-2.0.1.txt) |`)
  }else{missing.push({name:pkg.name,version:pkg.version,license});rows.push(`| ${label} | ${license} | [Package](https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}) |`)}
}
writeFileSync(join(root,'THIRD_PARTY_NOTICES.md'),'# Third-party notices\n\nMOKI Canvas for DSH and the embedded MOKI source use the [MIT license](LICENSE). This inventory covers packages included in the host bundle, major frontend packages, and directly declared external runtime dependencies. External dependencies may carry additional transitive notices in their installed packages. Bundled license comments are retained in the generated JavaScript.\n\n| Package | License | Notice |\n| --- | --- | --- |\n'+rows.join('\n')+'\n\n## Fonts\n\nInter and Noto Sans SC use the SIL Open Font License 1.1. Their original license files and source information are included in `app/fonts/` and `vendor/moki/public/fonts/`.\n\n## Demonstration assets\n\nThe built-in introduction, camping checklist, short synthetic video and audio example were created for this project. The cover illustrations were generated for the project; the interface images are real captures of the bundled demo.\n')
console.log(JSON.stringify({packages:packages.size,missingLicenseFiles:missing}))
