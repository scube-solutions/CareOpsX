import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets  : ['latin'],
  variable : '--font-display',
  weight   : ['400','500','600','700','800']
});

const instrument = Instrument_Sans({
  subsets  : ['latin'],
  variable : '--font-body',
  weight   : ['400','500','600']
});

export const metadata = {
  title       : 'CareOpsX — Hospital Management',
  description : 'Smart hospital management for small clinics'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable}`}>
      <body style={{ fontFamily: 'var(--font-body)', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}