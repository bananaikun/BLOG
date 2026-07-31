import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import DownloadBoard from './DownloadBoard';
import { siteConfig } from "@/siteConfig";

export const metadata = {
  title: "应用下载 | " + siteConfig.title,
  description: "HaYenai 应用下载与版本更新",
};

export default function DownloadPage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <div className="mt-28">
          <DownloadBoard />
        </div>
      </PageTransition>
    </div>
  );
}
