import { redirect } from "next/navigation";

/** Legacy route — withdraw was renamed to transfer */
export default function WithdrawRedirectPage() {
  redirect("/dashboard/transfer");
}
