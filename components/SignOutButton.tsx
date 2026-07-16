"use client";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
export default function SignOutButton(){
 const router=useRouter();
 return <button className="text-button" onClick={async()=>{await createSupabaseBrowser().auth.signOut();router.replace('/login');router.refresh();}}>Sign out</button>;
}
