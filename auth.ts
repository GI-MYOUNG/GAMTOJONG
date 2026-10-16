import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
export const authConfigured=!!(process.env.AUTH_SECRET&&process.env.AUTH_GOOGLE_ID&&process.env.AUTH_GOOGLE_SECRET);
export const {handlers,auth,signIn,signOut}=NextAuth({
 providers:authConfigured?[Google({clientId:process.env.AUTH_GOOGLE_ID!,clientSecret:process.env.AUTH_GOOGLE_SECRET!})]:[],
 secret:process.env.AUTH_SECRET,
 session:{strategy:'jwt'},
 pages:{signIn:'/login',error:'/login'},
 callbacks:{
  async signIn({account,profile}){return account?.provider==='google'&&(profile as {email_verified?:boolean}|undefined)?.email_verified===true;},
  async session({session,token}){if(session.user&&token.sub)session.user.id='google:'+token.sub;return session;}
 }
});
