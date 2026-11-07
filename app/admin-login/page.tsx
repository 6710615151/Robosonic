import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslation } from "@/lib/translations";
import AdminLoginForm from "./AdminLoginForm";
import AtlasLogo from "../components/brand/AtlasLogo";
import { ShieldCheck } from "lucide-react";

type SearchParams = Promise<{ error?: string; from?: string }>;

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false }
};export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = params.error;
  const from = params.from || "/";

  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  getTranslation(lang);

  const localT = {
    en: {
      title: "Administrator Authentication",
      desc: "Enter your credentials to access secure system configuration and data ingestion tools.",
      email: "Email Address",
      password: "Security Password",
      btn: "Authorize Session",
      errorMsg: "Invalid credentials. Please verify your admin email and password."
    },
    th: {
      title: "การยืนยันตัวตนผู้ดูแลระบบ",
      desc: "กรุณาระบุข้อมูลเพื่อเข้าสู่การจัดการระบบหลักและเครื่องมือดึงข้อมูลผ่าน API",
      email: "อีเมลผู้ดูแลระบบ",
      password: "รหัสผ่านความปลอดภัย",
      btn: "ยืนยันสิทธิ์การเข้าใช้งาน",
      errorMsg: "ข้อมูลการเข้าสู่ระบบไม่ถูกต้อง กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง"
    }
  }[lang];

  return (
    <div className="login-wrapper admin-login-page">
      <style dangerouslySetInnerHTML={{ __html: `
        .login-wrapper {
          min-height: 100dvh;
          width: 100%;
          background:
            radial-gradient(60% 60% at 50% 40%, rgba(22, 168, 120, 0.22), transparent 70%),
            var(--lai-dark) 0 0 / 56px 56px,
            var(--th-forest);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px 20px;
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
          font-family: var(--font-sans);
        }

        .login-stack {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-height: calc(100dvh - 56px);
          width: min(100%, 430px);
        }

        .login-logo {
          width: clamp(92px, 8vw, 128px);
          height: clamp(92px, 8vw, 128px);
          object-fit: contain;
          border-radius: 18px;
          filter: drop-shadow(0 18px 24px rgba(5, 13, 10, 0.22));
          position: relative;
          z-index: 3;
        }

        .login-card {
          background: linear-gradient(160deg, rgba(7, 59, 47, 0.92), rgba(6, 21, 15, 0.96));
          border: 1px solid rgba(198, 164, 91, 0.35);
          border-radius: 18px;
          backdrop-filter: blur(6px);
          padding: 28px 34px 32px;
          width: 100%;
          box-shadow: 0 20px 50px rgba(5, 13, 10, 0.45);
          position: relative;
          overflow: hidden;
        }

        .login-card::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(185, 244, 90, 0.07) 0%, transparent 60%);
          pointer-events: none;
        }

        .login-brand {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          color: #ffffff;
          font-family: var(--font-grotesk), var(--font-display);
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .login-brand b { color: var(--th-lime); }
        .login-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 0 0 10px;
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--th-gold);
          position: relative;
          z-index: 2;
        }
        .login-title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 6px 0;
          letter-spacing: -0.5px;
          position: relative;
          z-index: 2;
        }

        .login-desc {
          font-size: 13px;
          color: #a9c4b8;
          line-height: 1.4;
          margin: 0 0 20px 0;
          position: relative;
          z-index: 2;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
          z-index: 2;
        }

        .login-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #a3c2b5;
          font-weight: 600;
        }

        .login-input {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(185, 244, 90, 0.22);
          border-radius: 8px;
          color: #ffffff;
          padding: 10px 14px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }

        .login-input:focus {
          border-color: var(--th-lime);
          background: rgba(0, 0, 0, 0.32);
          box-shadow: 0 0 0 3px rgba(185, 244, 90, 0.16);
        }

        .password-input-wrap {
          display: grid;
          position: relative;
        }

        .password-input {
          padding-right: 48px;
          width: 100%;
        }

        .password-toggle {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 6px;
          color: #a3c2b5;
          cursor: pointer;
          display: inline-flex;
          height: 34px;
          justify-content: center;
          min-height: 34px;
          overflow: visible;
          padding: 0;
          position: absolute;
          right: 7px;
          top: 50%;
          transform: translateY(-50%);
          width: 34px;
        }

        .password-toggle::after {
          display: none;
        }

        .password-toggle:hover {
          background: rgba(185, 244, 90, 0.12);
          box-shadow: none;
          color: #ffffff;
          transform: translateY(-50%);
        }

        .password-toggle:active {
          transform: translateY(-50%) scale(0.96);
        }

        .password-toggle:focus-visible {
          outline: 2px solid var(--th-lime);
          outline-offset: 2px;
        }

        .login-btn {
          background: var(--th-lime);
          color: var(--th-forest);
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 10px;
        }

        .login-btn:hover {
          background: #c9fb72;
          transform: translateY(-1px);
        }

        .login-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 10px 14px;
          color: #fca5a5;
          font-size: 12.5px;
          line-height: 1.4;
          margin-bottom: 16px;
          position: relative;
          z-index: 2;
        }

        @media (min-width: 960px) and (max-height: 760px) {
          .login-wrapper {
            align-items: flex-start;
            padding-top: 22px;
          }

          .login-stack {
            gap: 10px;
          }

          .login-logo {
            width: 88px;
            height: 88px;
          }

          .login-card {
            padding: 24px 32px 28px;
          }
        }

        @media (max-width: 520px) {
          .login-wrapper {
            padding: 20px 14px;
          }

          .login-stack {
            gap: 12px;
          }

          .login-card {
            padding: 24px 22px 28px;
          }
        }
      `}} />

      <div className="login-stack">
        <div className="login-brand">
          <AtlasLogo width={240} />
        </div>
        <div className="login-card">
          <p className="login-kicker"><ShieldCheck size={13} aria-hidden="true" /> {lang === "th" ? "พื้นที่ผู้ดูแลระบบ" : "Administrator access"}</p>
          <h2 className="login-title">{localT.title}</h2>
          <p className="login-desc">{localT.desc}</p>

          {error && (
            <div className="login-error">
              {localT.errorMsg}
            </div>
          )}

          <AdminLoginForm from={from} emailLabel={localT.email} passwordLabel={localT.password} buttonLabel={localT.btn} />
        </div>
      </div>
    </div>
  );
}
