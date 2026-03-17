import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <Navbar />
      <main className="min-h-screen flex-1 flex-col max-w-screen bg-secondary-50">{children}</main>
      <Footer />
    </>
  );
};
