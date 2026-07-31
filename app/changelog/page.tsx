import { siteConfig } from "../../siteConfig";
import ChangelogClient from "./ChangelogClient";

export const metadata = {
  title: "更新日志 | " + siteConfig.title,
};

export default function ChangelogPage() {
  return <ChangelogClient />;
}
