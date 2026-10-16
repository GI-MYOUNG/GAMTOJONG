import { getDatabase,isDatabaseConfigured } from './database';
import { getStoreUser } from '../app/store-auth';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'gudwls1284@gmail.com';
export type Product = {id:string;name:string;category:string;price:number;weight:string;description:string;details:string;details_images?:string;image:string;stock:number;active:number;updated_at:string};
export type FAQ = {id:string;category:string;question:string;answer:string;updated_at:string};
const now='2026-10-14T00:00:00.000Z';
export const initialProducts:Product[] = [
{id:'peach-gochujang-300',name:'저염 개복숭아 고추장',category:'고추장',price:19000,weight:'300g',description:'국산 태양초의 매콤함에 개복숭아의 풍미를 더한 재래식 수제 고추장.',details:'감토정 저염 개복숭아 고추장 300g\n원산지: 국산(경상북도 영주시)\n비빔밥과 각종 양념에 어울리는 장입니다.\n원재료명·함량, 알레르기, 보관방법, 소비기한 등 상품정보고시는 운영자가 확인 후 등록할 예정입니다.',image:'/assets/gochujang.jpg',stock:0,active:1,updated_at:now},
{id:'buseok-doenjang-1kg',name:'부석태 전통 된장',category:'된장',price:22500,weight:'1kg',description:'국산 부석태 메주로 담아 구수함이 오래 남는 재래식 수제 된장.',details:'감토정 부석태 100% 국산 메주 된장 1kg\n원산지: 국산(경상북도 영주시)\n된장찌개와 나물 무침에 어울리는 장입니다.\n원재료명·함량, 알레르기, 보관방법, 소비기한 등 상품정보고시는 운영자가 확인 후 등록할 예정입니다.',image:'/assets/doenjang.jpg',stock:0,active:1,updated_at:now},
{id:'angelica-gochujang-500',name:'당귀 저염 고추장',category:'고추장',price:25500,weight:'500g',description:'국산 태양초로 빚은 매콤함에 은은한 당귀의 향을 담았습니다.',details:'감토정 당귀 저염 고추장 500g\n원산지: 국산(경상북도 영주시)\n비빔밥과 각종 양념에 어울리는 재래식 수제 고추장입니다.\n원재료명·함량, 알레르기, 보관방법, 소비기한 등 상품정보고시는 운영자가 확인 후 등록할 예정입니다.',image:'/assets/angelica.jpg',stock:0,active:1,updated_at:now}
];
export const initialFaqs:FAQ[]=[
{id:'faq-payment',category:'주문·결제',question:'지금 카드나 간편결제로 구매할 수 있나요?',answer:'새 공식몰은 현재 결제 서비스 연결을 준비하고 있습니다. 장바구니와 주문서 저장은 가능하며, 결제·주문 확정·출고는 진행되지 않습니다. 결제 개시 전까지 구매는 기존 감토정 공식몰을 이용해주세요.',updated_at:now},
{id:'faq-store',category:'상품',question:'고추장과 된장의 보관 방법이 궁금해요.',answer:'상품별 포장에 표시된 보관방법과 소비기한을 우선 확인해주세요. 제품에 대한 구체적인 안내가 필요하면 1:1 문의에 상품명을 남겨주시면 관리자가 확인 후 답변합니다.',updated_at:now},
{id:'faq-delivery',category:'배송·교환',question:'배송비와 교환·반품 기준은 어떻게 되나요?',answer:'새 공식몰의 배송비와 교환·반품 정책은 운영자가 확정하여 안내할 예정입니다. 기존 공식몰에서 구매한 주문은 해당 주문의 배송·교환·반품 안내를 따라주세요.',updated_at:now},
{id:'faq-private',category:'이용안내',question:'1:1 문의 답변은 어디에서 확인하나요?',answer:'로그인 후 고객센터의 내 문의에서 확인하실 수 있습니다. 문의 내용과 답변은 작성자와 관리자만 열람할 수 있습니다. 답변은 관리자가 직접 등록하며 자동 답변이나 이메일 알림은 제공하지 않습니다.',updated_at:now}
];
export function database(){return getDatabase();}
export async function catalog(all=false):Promise<Product[]>{if(!isDatabaseConfigured())return initialProducts;const db=database();const state=await db.prepare('SELECT value FROM store_meta WHERE key=?').bind('initialized').first();if(!state)return initialProducts;const rows=await db.prepare('SELECT * FROM products'+(all?'':' WHERE active=1')+' ORDER BY updated_at DESC,id').all<Product>();return rows.results;}
export async function faqList():Promise<FAQ[]>{if(!isDatabaseConfigured())return initialFaqs;const db=database();const state=await db.prepare('SELECT value FROM store_meta WHERE key=?').bind('initialized').first();if(!state)return initialFaqs;return (await db.prepare('SELECT * FROM faqs ORDER BY updated_at DESC,id').all<FAQ>()).results;}
export async function initialize(){const db=database();const statements=[...initialProducts.map(p=>db.prepare('INSERT OR IGNORE INTO products (id,name,category,price,weight,description,details,image,stock,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(p.id,p.name,p.category,p.price,p.weight,p.description,p.details,p.image,p.stock,p.active,p.updated_at)),...initialFaqs.map(f=>db.prepare('INSERT OR IGNORE INTO faqs (id,category,question,answer,updated_at) VALUES (?,?,?,?,?)').bind(f.id,f.category,f.question,f.answer,f.updated_at)),db.prepare('INSERT OR IGNORE INTO store_meta (key,value) VALUES (?,?)').bind('initialized','1')];const state=await db.prepare('SELECT value FROM store_meta WHERE key=?').bind('initialized').first();if(!state)await db.batch(statements);}
export async function identity(){const user=await getStoreUser();return {user,isAdmin:!!user&&user.email.toLowerCase()===ADMIN_EMAIL};}

export const defaultCategories=['고추장','된장','발효액','선물세트'];
export async function categoryList():Promise<string[]>{if(!isDatabaseConfigured())return defaultCategories;const db=database();const state=await db.prepare('SELECT value FROM store_meta WHERE key=?').bind('categories_initialized').first();if(!state){const old=(await catalog(true)).map(p=>p.category);return [...new Set([...defaultCategories,...old])];}return (await db.prepare('SELECT name FROM categories ORDER BY sort_order,created_at,name').all<{name:string}>()).results.map(c=>c.name);}
export async function initializeCategories(){const db=database();const state=await db.prepare('SELECT value FROM store_meta WHERE key=?').bind('categories_initialized').first();if(state)return;const names=await categoryList();await db.batch([...names.map((name,i)=>db.prepare('INSERT OR IGNORE INTO categories (name,sort_order,created_at) VALUES (?,?,?)').bind(name,i,new Date().toISOString())),db.prepare('INSERT OR IGNORE INTO store_meta (key,value) VALUES (?,?)').bind('categories_initialized','1')]);}
