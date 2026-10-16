import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,rm} from 'node:fs/promises';
import {getClient,getDatabase} from '../lib/database';
const file='.data/verify-'+Date.now()+'.db';await mkdir('.data',{recursive:true});process.env.TURSO_DATABASE_URL='file:'+file;
let checks=0;
try{
 const migrated=spawnSync(process.execPath,['scripts/migrate.mjs'],{env:process.env,encoding:'utf8'});assert.equal(migrated.status,0,migrated.stderr);checks++;
 const db=getDatabase();const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{name:string}>();for(const name of ['products','questions','order_drafts','reviews','image_uploads','faqs','categories','store_meta']){assert.ok(tables.results.some(t=>t.name===name));checks++;}
 await db.batch([db.prepare('INSERT INTO categories (name,sort_order,created_at) VALUES (?,?,?)').bind('고추장',0,'now'),db.prepare('INSERT INTO store_meta (key,value) VALUES (?,?)').bind('sample','ready')]);assert.equal((await db.prepare('SELECT value FROM store_meta WHERE key=?').bind('sample').first<{value:string}>())?.value,'ready');checks++;
 assert.equal((await db.prepare('SELECT value FROM store_meta WHERE key=?').bind('missing').first()),null);checks++;
 const inserted=await db.prepare('INSERT INTO reviews (id,product_id,user_id,rating,body,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind('r1','p1','google:1',5,'좋아요','now','now').run();assert.equal(inserted.meta.changes,1);checks++;
 await db.prepare('INSERT INTO reviews (id,product_id,user_id,rating,body,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind('r2','p1','google:2',3,'괜찮아요','now','now').run();
 assert.equal((await db.prepare('SELECT avg(rating) AS n FROM reviews').first<{n:number}>())?.n,4);checks++;
 await assert.rejects(db.prepare('INSERT INTO reviews (id,product_id,user_id,rating,body,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind('r3','p1','google:1',1,'duplicate','now','now').run());checks++;
 await assert.rejects(db.batch([db.prepare('INSERT INTO store_meta (key,value) VALUES (?,?)').bind('rollback','x'),db.prepare('INSERT INTO no_such_table (id) VALUES (?)').bind(1)]));assert.equal(await db.prepare('SELECT * FROM store_meta WHERE key=?').bind('rollback').first(),null);checks++;
 const second=spawnSync(process.execPath,['scripts/migrate.mjs'],{env:process.env,encoding:'utf8'});assert.equal(second.status,0,second.stderr);checks++;
 console.log(`PASS ${checks} database checks: migrations, schema, prepared statements, result compatibility, batch atomicity, review uniqueness/averages, idempotent migration.`);
}finally{getClient().close();for(const path of [file,file+'-wal',file+'-shm'])await rm(path,{force:true}).catch(e=>{if(e.code!=='EBUSY')throw e;});}
