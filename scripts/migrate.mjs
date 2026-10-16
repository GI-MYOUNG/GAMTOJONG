import {config} from 'dotenv';
import {createClient} from '@libsql/client';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
const url=process.env.TURSO_DATABASE_URL||'file:.data/gamtojung.db';
if(process.env.VERCEL&&url.startsWith('file:'))throw new Error('Vercel에서는 원격 TURSO_DATABASE_URL이 필요합니다.');
if(url.startsWith('file:'))await mkdir('.data',{recursive:true});
const db=createClient({url,authToken:process.env.TURSO_AUTH_TOKEN});
try{await db.execute('CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL)');
for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
 const sql=await readFile('drizzle/'+name,'utf8');const hash=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');const applied=await db.execute({sql:'SELECT hash FROM _app_migrations WHERE name=?',args:[name]});
 if(applied.rows.length){if(applied.rows[0].hash!==hash)throw new Error('이미 적용한 마이그레이션이 변경되었습니다: '+name);continue;}
 const statements=sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
 await db.batch([...statements.map(sql=>({sql,args:[]})),{sql:'INSERT INTO _app_migrations (name,hash,applied_at) VALUES (?,?,?)',args:[name,hash,new Date().toISOString()]}],'write');console.log('Applied '+name);
}console.log('Database schema ready.');}finally{db.close();}
