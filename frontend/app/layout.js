import './globals.css';

export const metadata = {
  title       : 'CareOpsX — Hospital Management',
  description : 'Smart hospital management for small clinics'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
            --font-body: 'Instrument Sans', system-ui, sans-serif;
          }
        `}</style>
      </head>
      <body style={{ fontFamily: 'var(--font-body)', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
