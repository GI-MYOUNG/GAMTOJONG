import 'server-only';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
let s3:S3Client|undefined;
export function storageConfigured(){return !!(process.env.S3_BUCKET&&process.env.S3_ACCESS_KEY_ID&&process.env.S3_SECRET_ACCESS_KEY);}
function client(){if(!storageConfigured())throw new Error('S3 이미지 저장소 환경변수를 설정해주세요.');return s3??=new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT||undefined,forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}});}
export const bucket={
 async get(key:string){if(!storageConfigured())return null;try{const object=await client().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET!,Key:key}));if(!object.Body)return null;return {body:object.Body.transformToWebStream(),httpMetadata:{contentType:object.ContentType||'application/octet-stream'}};}catch(e){if((e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===404)return null;throw e;}},
 async put(key:string,bytes:Uint8Array,options:{httpMetadata:{contentType:string}}){await client().send(new PutObjectCommand({Bucket:process.env.S3_BUCKET!,Key:key,Body:bytes,ContentLength:bytes.byteLength,ContentType:options.httpMetadata.contentType}));}
};
