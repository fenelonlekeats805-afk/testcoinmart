import type { Metadata } from 'next';
import Link from 'next/link';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { absoluteUrl, BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE, SITE_URL } from '../lib/site';

const heading = Space_Grotesk({ subsets: ['latin'] });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'] });
const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    url: '/',
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    images: [
      {
        url: '/logos/logo.png',
        width: 1200,
        height: 1200,
        alt: `${BRAND_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    images: ['/logos/logo.png'],
  },
  icons: {
    icon: '/logos/logo.png',
    shortcut: '/logos/logo.png',
    apple: '/logos/logo.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  ...(GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
  keywords: [
    'buy testnet coins',
    'testnet faucet alternative',
    'sepolia eth',
    'base sepolia eth',
    'arbitrum sepolia eth',
    'solana testnet',
    'sui testnet',
    'ton testnet',
    'x layer testnet okb',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const brandSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': absoluteUrl('/#organization'),
        name: BRAND_NAME,
        url: SITE_URL,
        logo: absoluteUrl('/logos/logo.png'),
      },
      {
        '@type': 'WebSite',
        '@id': absoluteUrl('/#website'),
        name: BRAND_NAME,
        url: SITE_URL,
        description: BRAND_DESCRIPTION,
        publisher: {
          '@id': absoluteUrl('/#organization'),
        },
      },
    ],
  };

  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${heading.className} ${mono.className}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(brandSchema) }}
        />
        <header className="brand-shell">
          <div className="brand-shell__inner">
            <Link href="/" className="brand">
              <img
                className="brand__logo"
                src="/logos/logo.png"
                alt={`${BRAND_NAME} logo icon`}
                width={72}
                height={72}
              />
              <div>
                <h1 className="brand__title">{BRAND_NAME}</h1>
                <p className="brand__tagline">{BRAND_TAGLINE}</p>
              </div>
            </Link>
            <nav className="brand-shell__nav">
              <Link className="btn" href="/guides/faucet-first">Faucet Guide</Link>
              <Link className="btn" href="/skills">Skills Guide</Link>
              <Link className="btn" href="/status">Order Status</Link>
              <Link className="btn" href="/support">Support</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

