import {createClient,type Client,type InValue,type ResultSet} from '@libsql/client';
let client:Client|undefined;
export function isDatabaseConfigured(){return !!process.env.TURSO_DATABASE_URL||!process.env.VERCEL;}
export function getClient(){
 if(!isDatabaseConfigured())throw new Error('TURSO_DATABASE_URL을 설정해주세요.');
 const url=process.env.TURSO_DATABASE_URL||'file:.data/gamtojung.db';
 if(process.env.VERCEL&&url.startsWith('file:'))throw new Error('Vercel 운영 환경에는 원격 Turso/libSQL 데이터베이스가 필요합니다.');
 return client??=createClient({url,authToken:process.env.TURSO_AUTH_TOKEN||undefined});
}
function result<T>(r:ResultSet){return {results:r.rows.map(row=>Object.fromEntries(r.columns.map((c,i)=>[c,row[i]])) as T),meta:{changes:r.rowsAffected},success:true};}
export class Statement {
 constructor(public sql:string,public args:InValue[]=[]){ }
 bind(...args:unknown[]){return new Statement(this.sql,args.map(v=>v===undefined?null:v as InValue));}
 async all<T=Record<string,unknown>>(){return result<T>(await getClient().execute({sql:this.sql,args:this.args}));}
 async first<T=Record<string,unknown>>():Promise<T|null>{return (await this.all<T>()).results[0]??null;}
 async run(){return result(await getClient().execute({sql:this.sql,args:this.args}));}
}
const database={prepare:(sql:string)=>new Statement(sql),async batch(statements:Statement[]){const rows=await getClient().batch(statements.map(s=>({sql:s.sql,args:s.args})),'write');return rows.map(r=>result(r));}};
export function getDatabase(){getClient();return database;}
