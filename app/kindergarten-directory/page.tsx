import { redirect } from "next/navigation";

export const metadata = {
  title: "רשימת גני ילדים | גן בטוח",
  description: "רשימת גני ילדים ציבורית עם מידע בטוח להצגה, קבוצות גיל, עיר, סטטוס אמון ובקשת הצטרפות."
};

export default function KindergartenDirectoryPage() {
  redirect("/gardens");
}
