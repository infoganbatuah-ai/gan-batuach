import { redirect } from "next/navigation";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = publicMetadata("/gardens", "רשימת גני ילדים", "רשימת גני ילדים ציבורית עם מידע בטוח להצגה, קבוצות גיל, עיר, סטטוס אמון ובקשת הצטרפות.");

export default function KindergartenDirectoryPage() {
  redirect("/gardens");
}
