import {signOut} from '../../auth';
import {safeReturnTo} from '../store-auth';
export default async function Logout({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;const target=safeReturnTo(params.return_to);return <main className="section empty"><h1 className="page-title">로그아웃하시겠어요?</h1><form action={async()=>{'use server';await signOut({redirectTo:target});}}><button className="button red">로그아웃</button></form><p><a href="/mypage" className="text-link">마이페이지로 돌아가기</a></p></main>;}
