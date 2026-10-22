import React from 'react';
import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';
import { A, Code, List, Strong, Table } from '@/components/legal/blocks';

const UPDATED = 'October 22, 2026';
const EMAIL = 'smuzziedesign@gmail.com';

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who We Are',
    body: (
      <>
        <p>
          This website (smuzzie.com, also available at smuzzie.design) is run by Smuzzie (&quot;Smuzzie&quot;,
          &quot;we&quot;, &quot;us&quot;). We offer custom design services and customizable video banners. For the
          personal data described in this policy, we are the data controller.
        </p>
        <p>
          You can reach us about anything in this policy at <A href={`mailto:${EMAIL}`}>{EMAIL}</A>.
        </p>
      </>
    ),
  },
  {
    id: 'summary',
    title: 'The Short Version',
    body: (
      <List
        items={[
          'We collect only what we need to deliver your order or answer your message.',
          'There is no analytics, no advertising tracker and no third-party cookie on this site.',
          'Your banner draft stays in your own browser until you check out.',
          'We never see or store card or bank details. Payments are made in cryptocurrency.',
          'We do not sell your data or share it for marketing.',
        ]}
      />
    ),
  },
  {
    id: 'data-we-collect',
    title: 'What Data We Collect and Why',
    body: (
      <>
        <p>
          <Strong>Visiting the site.</Strong> Like any web server, ours records technical data about each request:
          IP address, browser type, the page requested and the time. We use it to keep the site secure, to limit abuse
          (for example, rate limits on forms) and to fix errors. We do not build profiles from it. Legal basis: our
          legitimate interest in running a secure website.
        </p>
        <p>
          <Strong>Designing a banner.</Strong> When you customize a template at <Code>/banners</Code>, your texts,
          fonts, colors, positions, layers and uploaded images are saved only in your browser&apos;s local storage
          (images as data URLs), so you can come back to your draft. Nothing is sent to us until you check out.
        </p>
        <p>
          <Strong>Placing a banner order.</Strong> At checkout we receive and store:
        </p>
        <List
          items={[
            'your email address;',
            'your IP address;',
            'the settings you chose (texts, fonts, colors, positions and your own layers);',
            'the images you uploaded (PNG, JPG or WebP). We decode and re-encode each one on our server, which removes embedded metadata such as EXIF and location data;',
            'a snapshot of the template at the time of the order, plus order status, times and the rendered files.',
          ]}
        />
        <p>
          We use this to render and deliver your banner and to send you emails about the order. Legal basis:
          performance of our contract with you. We keep the IP address to prevent fraud and abuse (legitimate
          interest).
        </p>
        <p>
          <Strong>Paying for an order.</Strong> Payment is made in cryptocurrency through WestWallet, right on our
          order page. We store the coin and network you chose, the deposit address issued for your order, the quoted
          and received amounts, the exchange rate, transaction IDs and hashes, confirmation counts and the related
          payment notifications. We never receive card or bank details. Legal basis: performance of the contract and
          our legal obligations (for example, keeping records of sales). Please note that cryptocurrency transactions
          are recorded on a public blockchain. Anyone can see them there, and neither we nor anyone else can change or
          delete them.
        </p>
        <p>
          <Strong>Contacting us.</Strong> If you use a contact form on the site, we store your name, email address,
          subject and message in our database, where our administrators can read them. If you email us or message us on
          Discord or Telegram, we receive whatever you send through those services. We use it to reply to you and
          to discuss your project. Legal basis: our legitimate interest in answering enquiries, or steps you ask
          us to take before entering into a contract. Discord and Telegram are run by their own companies under their
          own privacy policies.
        </p>
        <p>
          <Strong>Emails we send.</Strong> We send only service emails: order received (with your payment link),
          payment confirmed, banner ready, and replies to your messages. We don&apos;t send newsletters or marketing
          emails.
        </p>
        <p>
          We don&apos;t make decisions about you based solely on automated processing, and we don&apos;t use your data
          for profiling.
        </p>
      </>
    ),
  },
  {
    id: 'processors',
    title: 'Service Providers We Use',
    body: (
      <>
        <p>We share data only with the providers we need to run the service, and only what they need:</p>
        <Table
          head={['Provider', 'What for', 'Data they receive']}
          rows={[
            [
              <A key="w" href="https://westwallet.io">WestWallet</A>,
              'Cryptocurrency payment processing: deposit addresses and incoming transactions',
              'The order reference, the coin, network and amount, and the transactions sent to your deposit address. Not your email or uploads.',
            ],
            [
              <A key="r" href="https://resend.com">Resend</A>,
              'Delivering our emails',
              'Your email address and the content of the emails we send you',
            ],
            [
              'Hosting provider',
              'The virtual private server (VPS) that runs this site, its database and file storage',
              'All data described in this policy is stored on this server. We manage the server ourselves.',
            ],
          ]}
        />
        <p>
          Each of these providers may process data in a country other than yours. Blockchain networks are not our
          providers: a transaction you send is published to that network by your wallet.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How Long We Keep Data',
    body: (
      <>
        <Table
          head={['Data', 'How long']}
          rows={[
            ['Banner draft in your browser', 'Until you clear it or your browser storage. We never receive it.'],
            [
              'Unpaid orders, with their uploaded images',
              'Deleted automatically after 7 days. If a payment was received but did not cover the order (for example, an underpayment), the order is kept until we resolve it with you.',
            ],
            [
              'Paid orders: email, settings, uploads, template snapshot, IP address and payment records',
              'Kept, so that we can re-render your banner, handle support requests and keep a record of the sale. Ask us if you want them deleted (see “Your Rights”).',
            ],
            ['Rendered banner files (MP4, GIF)', 'Deleted 30 days after rendering. The order itself is kept and can be rendered again on request.'],
            ['Download links', 'Expire 7 days after they are issued. Opening your order page gives you a fresh link while the files exist.'],
            ['Temporary render files', 'Deleted within 24 hours.'],
            ['Payment notification logs', 'Up to 180 days.'],
            ['Contact messages', 'As long as we need them to handle your request and any follow-up, or until you ask us to delete them.'],
            ['Cookie choice', 'The cookie expires after 1 year. The local storage copy stays until you clear it.'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and Local Storage',
    body: (
      <>
        <p>
          We don&apos;t use analytics, advertising or third-party cookies. We only use the storage the site needs to
          work. You can change your choice at any time with{' '}
          <Strong>Cookie settings</Strong> at the bottom of every page.
        </p>
        <Table
          head={['Name', 'Type', 'Purpose', 'Duration']}
          rows={[
            [<Code key="1">smz_consent</Code>, 'Cookie and local storage', 'Remembers your cookie choice and when you made it', '1 year (cookie)'],
            [<Code key="2">banner-draft:&lt;template&gt;:v1</Code>, 'Local storage', 'Your banner draft, including uploaded images', 'Until cleared'],
            [<Code key="3">banner-checkout-email</Code>, 'Local storage', 'Pre-fills your email at the next checkout', 'Until cleared'],
            [<Code key="4">admin_token, admin_user</Code>, 'Local storage', 'Login session for site administrators only', 'Until logout'],
          ]}
        />
        <p>
          Local storage stays on your device and is not sent to our server automatically. Clearing your browser&apos;s
          site data removes all of it.
        </p>
        <p>
          <Strong>Fonts.</Strong> The site&apos;s fonts are bundled with the site and served from our own server.
          Banner fonts are served from our server too. Your browser doesn&apos;t contact Google Fonts or any other
          font service.
        </p>
        <p>
          <Strong>Optional analytics.</Strong> We don&apos;t run any analytics today. If we add privacy-friendly
          analytics in the future, they will only run after you choose &quot;Accept all&quot;. We will update this
          policy before that happens. &quot;Essential only&quot; keeps everything as it is now.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <>
        <p>
          The site is served over HTTPS. Uploaded images and rendered files are kept in private storage that is not
          publicly accessible. They can only be downloaded through signed links that expire. The template previews
          shown on the site are watermarked. Only our administrators can access the admin panel.
        </p>
        <p>
          Your order page is protected by a long, random link. Anyone who has that link can see the order, so please
          don&apos;t share it publicly.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    body: (
      <>
        <p>Depending on where you live (for example, in the EU, EEA or UK), you have the right to:</p>
        <List
          items={[
            'access the personal data we hold about you and get a copy of it;',
            'have inaccurate data corrected;',
            'have your data deleted, unless we have to keep it (for example, records of a sale);',
            'restrict or object to processing based on our legitimate interests;',
            'receive your data in a portable format;',
            'withdraw consent at any time, where we rely on it (for example, through Cookie settings);',
            'complain to your local data protection authority.',
          ]}
        />
        <p>
          To use any of these rights, email <A href={`mailto:${EMAIL}`}>{EMAIL}</A>. For an order, write from the
          email address you used and include your order link, so that we can confirm it&apos;s yours. We reply within
          one month. Data recorded on a public blockchain can&apos;t be deleted by us or anyone else.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: "Children's Privacy",
    body: (
      <p>
        Our services are not directed to individuals under 13 years of age. We do not knowingly collect personal
        information from children. If you believe a child has sent us personal data, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    body: (
      <p>
        We may update this policy when the site or the law changes. The date at the top shows the latest version. If a
        change is significant, we will make it clear on the site.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact Us',
    body: (
      <p>
        Questions about this policy or your personal data: <A href={`mailto:${EMAIL}`}>{EMAIL}</A>. You can also find
        other ways to reach us on our <A href="/contact">Contact page</A>.
        See also our <A href="/terms">Terms of Service</A>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy" accent="Policy" updated={UPDATED} sections={sections} />;
}
