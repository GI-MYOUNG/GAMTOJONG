import {bucket,storageConfigured} from '../../../../lib/storage';
import {isDatabaseConfigured} from '../../../../lib/database';
import {z} from 'zod';
import {catalog,database,faqList,identity,initialize,categoryList,initializeCategories} from '../../../../lib/store';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const text=(n:number)=>z.string().trim().min(1).max(n);
const productSchema=z.object({name:text(120),category:text(30),price:z.number().int().min(1).max(10000000),weight:text(80),description:text(500),details:text(12000),details_images:z.array(z.string().regex(/^\/api\/store\/images\/[a-zA-Z0-9_.-]+$/)).max(12).default([]),image:z.string().max(300).regex(/^\/(?:assets\/[a-zA-Z0-9_.-]+|api\/store\/images\/[a-zA-Z0-9_.-]+)$/),stock:z.number().int().min(0).max(1000000),active:z.number().int().min(0).max(1)});
const faqSchema=z.object({category:z.enum(['주문·결제','상품','배송·교환','이용안내']),question:text(200),answer:text(5000)});
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function handle(request:Request){try{
const url=new URL(request.url);const path=url.pathname.replace(/^\/api\/store\/?/,'').split('/').filter(Boolean);const [resource,id,action]=path;const method=request.method;const {user,isAdmin}=await identity();
if(method!=='GET'){const origin=request.headers.get('origin');if(!origin||origin!==url.origin){await discardBody(request);return reply({error:'허용되지 않은 요청입니다.'},403);}}
if(method==='GET'&&resource==='catalog')return reply(await catalog());
if(method==='GET'&&resource==='categories')return reply(await categoryList());
if(method==='GET'&&resource==='faqs')return reply(await faqList());
if(method==='GET'&&resource==='images'&&id){if(!/^[a-zA-Z0-9_.-]{1,120}$/.test(id))return reply({error:'이미지를 찾을 수 없습니다.'},404);const obj=await bucket.get('products/'+id);if(!obj)return reply({error:'이미지를 찾을 수 없습니다.'},404);return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=86400'}});}
if(!isDatabaseConfigured())return reply({error:'데이터베이스를 연결해주세요. 환경변수 안내를 확인해주세요.'},503);
const db=database();
if(method==='GET'&&resource==='reviews'){
 const productId=url.searchParams.get('product');if(!productId||productId.length>100)return reply({error:'상품을 선택해주세요.'},400);
 const product=(await catalog()).find(p=>p.id===productId);if(!product)return reply({error:'상품을 찾을 수 없습니다.'},404);
 const rows=await db.prepare('SELECT id,rating,body,images,created_at,updated_at,CASE WHEN user_id=? THEN 1 ELSE 0 END AS is_mine FROM reviews WHERE product_id=? ORDER BY created_at DESC,id LIMIT 200').bind(user?.userId||'',productId).all();
 const summary=await db.prepare('SELECT count(*) AS count,coalesce(avg(rating),0) AS average FROM reviews WHERE product_id=?').bind(productId).first();
 const mine=user?await db.prepare('SELECT id,rating,body,images,created_at,updated_at,1 AS is_mine FROM reviews WHERE product_id=? AND user_id=?').bind(productId,user.userId).first():null;
 return reply({reviews:rows.results,summary,mine});
}
if(!user){if(method!=='GET')await discardBody(request);return reply({error:'로그인 후 이용해주세요.'},401);}
if(resource==='admin'&&!isAdmin){if(method!=='GET')await discardBody(request);return reply({error:'관리자 권한이 필요합니다.'},403);}
if(resource==='review-upload'&&method==='POST'){
 const n=await db.prepare('SELECT count(*) AS n FROM image_uploads WHERE user_id=? AND purpose=? AND created_at>?').bind(user.userId,'review',new Date(Date.now()-3600000).toISOString()).first<{n:number}>();if((n?.n||0)>=25)return reply({error:'후기 사진은 한 시간에 최대 25장까지 업로드할 수 있습니다.'},429);
 return await uploadImage(request,user.userId,'review');
}
if(resource==='reviews'){
 if(method==='POST'||method==='PUT'){
  const data=z.object({productId:text(100),rating:z.number().int().min(1).max(5),body:text(3000),images:z.array(z.string().regex(/^\/api\/store\/images\/review-[a-zA-Z0-9_.-]+$/)).max(5).default([])}).parse(await request.json());
  if(new Set(data.images).size!==data.images.length)return reply({error:'같은 사진을 중복해서 첨부할 수 없습니다.'},400);
  for(const image of data.images){const owned=await db.prepare('SELECT path FROM image_uploads WHERE path=? AND user_id=? AND purpose=?').bind(image,user.userId,'review').first();if(!owned)return reply({error:'본인이 업로드한 후기 사진만 사용할 수 있습니다.'},403);}
  await initialize();const product=await db.prepare('SELECT id FROM products WHERE id=? AND active=1').bind(data.productId).first();if(!product)return reply({error:'상품을 찾을 수 없습니다.'},404);
  const existing=await db.prepare('SELECT id FROM reviews WHERE product_id=? AND user_id=?').bind(data.productId,user.userId).first<{id:string}>();
  if(method==='POST'&&existing)return reply({error:'이미 작성한 후기가 있습니다. 기존 후기를 수정해주세요.'},409);
  if(method==='PUT'&&(!id||existing?.id!==id))return reply({error:'본인의 후기만 수정할 수 있습니다.'},403);
  const rid=method==='PUT'?id:crypto.randomUUID();const now=new Date().toISOString();
  if(method==='POST'){const result=await db.prepare('INSERT OR IGNORE INTO reviews (id,product_id,user_id,rating,body,images,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(rid,data.productId,user.userId,data.rating,data.body,JSON.stringify(data.images),now,now).run();if(!result.meta.changes)return reply({error:'이미 작성한 후기가 있습니다.'},409);}
  else await db.prepare('UPDATE reviews SET rating=?,body=?,images=?,updated_at=? WHERE id=? AND user_id=?').bind(data.rating,data.body,JSON.stringify(data.images),now,id,user.userId).run();
  return reply({id:rid},method==='POST'?201:200);
 }
 if(method==='DELETE'&&id){const result=await db.prepare('DELETE FROM reviews WHERE id=?'+(isAdmin?'':' AND user_id=?')).bind(...(isAdmin?[id]:[id,user.userId])).run();if(!result.meta.changes)return reply({error:'후기를 찾을 수 없거나 삭제 권한이 없습니다.'},404);return reply({ok:true});}
}
if(resource==='questions'){
 if(method==='GET'){const rows=await db.prepare('SELECT id,category,title,body,answer,created_at,answered_at FROM questions WHERE user_id=? ORDER BY created_at DESC LIMIT 200').bind(user.userId).all();return reply(rows.results);}
 if(method==='POST'){const data=z.object({category:z.enum(['상품','주문·결제','배송·교환','기타']),title:text(120),body:text(5000)}).parse(await request.json());const recent=await db.prepare("SELECT count(*) AS n FROM questions WHERE user_id=? AND created_at>?").bind(user.userId,new Date(Date.now()-3600000).toISOString()).first<{n:number}>();if((recent?.n||0)>=10)return reply({error:'문의는 한 시간에 최대 10개까지 등록할 수 있습니다.'},429);const qid=crypto.randomUUID();await db.prepare('INSERT INTO questions (id,user_id,email,category,title,body,created_at) VALUES (?,?,?,?,?,?,?)').bind(qid,user.userId,user.email,data.category,data.title,data.body,new Date().toISOString()).run();return reply({id:qid},201);}
}
if(resource==='drafts'){
 if(method==='GET')return reply((await db.prepare('SELECT * FROM order_drafts WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.userId).all()).results);
 if(method==='POST'){const data=z.object({items:z.array(z.object({id:text(100),quantity:z.number().int().min(1).max(99)})).min(1).max(30)}).parse(await request.json());if(new Set(data.items.map(i=>i.id)).size!==data.items.length)return reply({error:'상품이 중복되었습니다.'},400);const products=await catalog();const items=data.items.map(i=>{const p=products.find(p=>p.id===i.id&&p.active===1);if(!p)throw new Error('판매 중인 상품을 다시 확인해주세요.');return {id:p.id,name:p.name,weight:p.weight,quantity:i.quantity,price:p.price};});const total=items.reduce((n,i)=>n+i.price*i.quantity,0);const did=crypto.randomUUID();await db.prepare('INSERT INTO order_drafts (id,user_id,email,items,total,status,created_at) VALUES (?,?,?,?,?,?,?)').bind(did,user.userId,user.email,JSON.stringify(items),total,'결제 연결 대기',new Date().toISOString()).run();return reply({id:did,total,status:'결제 연결 대기',message:'주문서가 저장되었습니다. 결제·주문 확정·출고는 진행되지 않았습니다.'},201);}
 if(method==='DELETE'&&id){await db.prepare('DELETE FROM order_drafts WHERE id=? AND user_id=?').bind(id,user.userId).run();return reply({ok:true});}
}
if(resource==='admin'){
 if(id==='categories'){
  if(method==='POST'||method==='DELETE'){
   const {name}=z.object({name:text(30).refine(v=>!['전체','모든 장'].includes(v),'다른 카테고리명을 입력해주세요.')}).parse(await request.json());await initialize();await initializeCategories();
   if(method==='POST'){const n=await db.prepare('SELECT count(*) AS n FROM categories').first<{n:number}>();if((n?.n||0)>=30)return reply({error:'카테고리는 최대 30개까지 등록할 수 있습니다.'},400);const result=await db.prepare('INSERT OR IGNORE INTO categories (name,sort_order,created_at) SELECT ?,coalesce(max(sort_order),-1)+1,? FROM categories').bind(name,new Date().toISOString()).run();if(!result.meta.changes)return reply({error:'이미 존재하는 카테고리입니다.'},409);return reply({ok:true},201);}
   const result=await db.prepare('DELETE FROM categories WHERE name=? AND NOT EXISTS (SELECT 1 FROM products WHERE category=?)').bind(name,name).run();if(!result.meta.changes){const used=await db.prepare('SELECT count(*) AS n FROM products WHERE category=?').bind(name).first<{n:number}>();if(used?.n)return reply({error:'이 카테고리에 상품이 있습니다. 숨긴 상품을 포함해 다른 카테고리로 이동한 후 삭제해주세요.'},409);return reply({error:'카테고리를 찾을 수 없습니다.'},404);}return reply({ok:true});
  }
 }

 if(id==='products'){
  if(method==='GET')return reply(await catalog(true));
  if(method==='POST'||method==='PUT'){const p=productSchema.parse(await request.json());await initialize();await initializeCategories();if(!(await categoryList()).includes(p.category))return reply({error:'등록된 카테고리를 선택해주세요.'},400);const pid=action||crypto.randomUUID();if(method==='PUT'&&!action)return reply({error:'상품을 지정해주세요.'},400);if(method==='PUT'){const found=await db.prepare('SELECT id FROM products WHERE id=?').bind(pid).first();if(!found)return reply({error:'상품을 찾을 수 없습니다.'},404);}const saved=await db.prepare('INSERT INTO products (id,name,category,price,weight,description,details,image,stock,active,updated_at,details_images) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM categories WHERE name=?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,price=excluded.price,weight=excluded.weight,description=excluded.description,details=excluded.details,details_images=excluded.details_images,image=excluded.image,stock=excluded.stock,active=excluded.active,updated_at=excluded.updated_at').bind(pid,p.name,p.category,p.price,p.weight,p.description,p.details,p.image,p.stock,p.active,new Date().toISOString(),JSON.stringify(p.details_images),p.category).run();if(!saved.meta.changes)return reply({error:'카테고리가 변경되었습니다. 다시 선택해주세요.'},409);return reply({id:pid});}
  if(method==='DELETE'&&action){await initialize();await db.prepare('UPDATE products SET active=0,updated_at=? WHERE id=?').bind(new Date().toISOString(),action).run();return reply({ok:true});}
 }
 if(id==='faqs'){
  if(method==='POST'||method==='PUT'){const f=faqSchema.parse(await request.json());await initialize();const fid=action||crypto.randomUUID();await db.prepare('INSERT INTO faqs (id,category,question,answer,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category,question=excluded.question,answer=excluded.answer,updated_at=excluded.updated_at').bind(fid,f.category,f.question,f.answer,new Date().toISOString()).run();return reply({id:fid});}
  if(method==='DELETE'&&action){await initialize();await db.prepare('DELETE FROM faqs WHERE id=?').bind(action).run();return reply({ok:true});}
 }
 if(id==='questions'){
  if(method==='GET')return reply((await db.prepare('SELECT * FROM questions ORDER BY created_at DESC LIMIT 300').all()).results);
  if(method==='PUT'&&action){const {answer}=z.object({answer:text(5000)}).parse(await request.json());const r=await db.prepare('UPDATE questions SET answer=?,answered_at=? WHERE id=?').bind(answer,new Date().toISOString(),action).run();if(!r.meta.changes)return reply({error:'문의를 찾을 수 없습니다.'},404);return reply({ok:true});}
 }
 if(id==='drafts'&&method==='GET')return reply((await db.prepare('SELECT * FROM order_drafts ORDER BY created_at DESC LIMIT 200').all()).results);
 if(id==='upload'&&method==='POST')return await uploadImage(request,user.userId,'product');
}
return reply({error:'요청을 찾을 수 없습니다.'},404);
}catch(error){if(error instanceof z.ZodError)return reply({error:'입력값을 확인해주세요. '+error.issues[0]?.message},400);console.error('Store request failed',error instanceof Error?error.message:'unknown');return reply({error:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'},500);}}
export const GET=handle;export const POST=handle;export const PUT=handle;export const DELETE=handle;

async function uploadImage(request:Request,userId:string,purpose:'product'|'review'){
 if(!storageConfigured())return reply({error:'이미지 저장소 연결을 확인해주세요.'},503);
 if(Number(request.headers.get('content-length')||0)>4300000)return reply({error:'4MB 이하 이미지를 사용해주세요.'},400);
 const form=await request.formData();const file=form.get('file');if(!(file instanceof File)||file.size===0||file.size>4*1024*1024)return reply({error:'4MB 이하 이미지를 선택해주세요.'},400);
 const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};const ext=extensions[file.type];const bytes=new Uint8Array(await file.arrayBuffer());const valid=ext==='jpg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:ext==='png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':ext==='webp'?String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP':false;
 if(!valid)return reply({error:'JPG, PNG, WEBP 이미지 파일만 등록할 수 있습니다.'},400);
 const key=(purpose==='review'?'review-':'')+crypto.randomUUID()+'.'+ext;await bucket.put('products/'+key,bytes,{httpMetadata:{contentType:file.type}});const path='/api/store/images/'+key;
 await database().prepare('INSERT INTO image_uploads (path,user_id,purpose,created_at) VALUES (?,?,?,?)').bind(path,userId,purpose,new Date().toISOString()).run();return reply({url:path},201);
}

async function discardBody(request:Request){const reader=request.body?.getReader();if(!reader)return;let size=0;try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>4300000){await reader.cancel();break;}}}finally{reader.releaseLock();}}
