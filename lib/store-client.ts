export async function requestStore<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/api/store/'+path,{method,headers:body instanceof FormData?{}:body?{'Content-Type':'application/json'}:{},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'요청을 처리하지 못했어요. 다시 시도해주세요.');return data as T;
}
export function imageList(value?:string):string[]{try{const data=JSON.parse(value||'[]');return Array.isArray(data)?data.filter((s:unknown)=>typeof s==='string'&&/^\/api\/store\/images\/[a-zA-Z0-9_.-]+$/.test(s)).slice(0,12):[]}catch{return []}}
