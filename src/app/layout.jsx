import './globals.css';
import AuthWrapper from '../components/AuthWrapper';
import { ToastProvider } from '../components/ToastProvider';

export const metadata = {
  title: 'Guardian Bot - ระบบบอทดูแลกลุ่ม LINE & BackOffice',
  description: 'LINE Group Protection System with Next.js, Tailwind CSS & Supabase',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className="light">
      <body className="bg-slate-50 text-slate-800 min-h-screen flex flex-col antialiased">
        <ToastProvider>
          <AuthWrapper>
            {children}
          </AuthWrapper>
        </ToastProvider>
      </body>
    </html>
  );
}
