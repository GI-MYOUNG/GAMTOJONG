import Storefront from '../../components/storefront';
import {catalog, faqList, identity, categoryList} from '../../lib/store';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}){const {path=[]}=await params;const [products,faqs,auth,categories]=await Promise.all([catalog(),faqList(),identity(),categoryList()]);return <Storefront path={path} initialProducts={products} initialFaqs={faqs} initialCategories={categories} account={auth.user?{email:auth.user.email,name:auth.user.displayName,isAdmin:auth.isAdmin}:null}/>;}
