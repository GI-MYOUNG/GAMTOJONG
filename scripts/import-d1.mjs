import {config} from 'dotenv';import {createClient} from '@libsql/client';import {readFile} from 'node:fs/promises';
config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
const file=process.argv.slice(2).find(a=>a!=='--');if(!file)throw new Error('사용법: pnpm db:import -- /절대경로/d1-export.sql (빈 대상 DB에만 실행)');
const db=createClient({url:process.env.TURSO_DATABASE_URL||'file:.data/gamtojung.db',authToken:process.env.TURSO_AUTH_TOKEN});
try{const tables=await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");if(tables.rows.length)throw new Error('빈 데이터베이스만 가져올 수 있습니다. 기존 데이터를 보존하기 위해 중단합니다.');const sql=await readFile(file,'utf8');await db.executeMultiple(sql);console.log('SQL 가져오기 완료. 다음은 README의 기존 데이터 전환 절차를 따르세요.');}finally{db.close();}
