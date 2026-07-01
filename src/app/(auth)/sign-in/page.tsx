import { redirect } from "next/navigation";
import { getOwnerId } from "@/lib/mercury/owner";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function SignInPage() {
  if (await getOwnerId()) redirect("/mercury");
  return <AuthForm mode="sign-in" />;
}
