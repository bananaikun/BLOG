import { siteConfig } from "../../siteConfig";
import AnnouncementsClient from "./AnnouncementsClient";

export const metadata = {
  title: "公告 | " + siteConfig.title,
};

export default function AnnouncementsPage() {
  return <AnnouncementsClient />;
}
