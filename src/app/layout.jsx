import './globals.css';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'Guardian Bot - ระบบบอทดูแลกลุ่ม LINE & BackOffice',
  description: 'LINE Group Protection System with Next.js, Tailwind CSS & Supabase',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className="light">
      <body className="bg-slate-50 text-slate-800 min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          <p>Guardian Bot &bull; High-Performance LINE Group Protection System (Next.js + Tailwind CSS)</p>
        </footer>
      </body>
    </html>
  );
}
