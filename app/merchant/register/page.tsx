import { redirect } from "next/navigation";

export default function MerchantRegisterRedirect() {
  redirect("/merchant/login");
}
