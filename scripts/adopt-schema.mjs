import {config} from 'dotenv';import {createClient} from '@libsql/client';import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
const expected=createClient({url:'file::memory:'});const target=createClient({url:process.env.TURSO_DATABASE_URL||'file:.data/gamtojung.db',authToken:process.env.TURSO_AUTH_TOKEN});
const files=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();const migrations=[];
try{
 for(const name of files){const sql=await readFile('drizzle/'+name,'utf8');await expected.batch(sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean),'write');migrations.push({name,hash:createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex')});}
 const tables=(await expected.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows;
 for(const table of tables){const name=String(table.name);if(!/^[a-z_]+$/.test(name))throw new Error('잘못된 테이블명');const a=(await expected.execute(`PRAGMA table_info('${name}')`)).rows;const b=(await target.execute(`PRAGMA table_info('${name}')`)).rows;if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('가져온 스키마가 현재 버전과 다릅니다: '+name);}
 const indexes=(await expected.execute("SELECT name,sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")).rows;
 for(const i of indexes){const found=(await target.execute({sql:'SELECT sql FROM sqlite_master WHERE type=? AND name=?',args:['index',i.name]})).rows;if(!found.length||String(found[0].sql).replace(/\s+/g,' ')!==String(i.sql).replace(/\s+/g,' '))throw new Error('필요한 인덱스가 다릅니다: '+i.name);}
 await target.execute('CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL)');
 for(const m of migrations){const old=(await target.execute({sql:'SELECT hash FROM _app_migrations WHERE name=?',args:[m.name]})).rows;if(old.length&&old[0].hash!==m.hash)throw new Error('기존 기준 정보와 충돌합니다: '+m.name);}
 await target.batch(migrations.map(m=>({sql:'INSERT OR IGNORE INTO _app_migrations (name,hash,applied_at) VALUES (?,?,?)',args:[m.name,m.hash,new Date().toISOString()]})),'write');console.log('가져온 스키마 검증 완료. 현재 마이그레이션 기준만 등록했습니다. 상품/문의 데이터는 변경하지 않았습니다.');
}finally{expected.close();target.close();}
