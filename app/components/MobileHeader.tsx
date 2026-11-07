import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import AtlasLogo from "./brand/AtlasLogo";

export default function MobileHeader() {
  return (
    <header className="mobile-header">
      <Link href="/" className="mobile-brand" aria-label="Thailand Humanoid Atlas — Overview">
        <AtlasLogo width={92} className="mobile-logo-img" decorative />
        <span className="mobile-title">Thailand Humanoid <b>Atlas</b></span>
      </Link>
      <Link href="/profile" className="mobile-profile" aria-label="Profile">
        <CircleUserRound size={20} className="profile-icon" />
      </Link>
    </header>
  );
}
