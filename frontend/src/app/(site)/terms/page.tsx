import React from 'react';
import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';
import { A, List, Strong } from '@/components/legal/blocks';

const UPDATED = 'October 22, 2026';
const EMAIL = 'smuzziedesign@gmail.com';

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Acceptance of Terms',
    body: (
      <>
        <p>
          These terms apply to smuzzie.com (also available at smuzzie.design) and to everything you order from Smuzzie
          (&quot;Smuzzie&quot;, &quot;we&quot;, &quot;us&quot;). By using the site or placing an order, you accept
          and agree to be bound by these terms. If you do not agree to them, please do not use our services.
        </p>
        <p>
          How we handle personal data is explained in our <A href="/privacy">Privacy Policy</A>.
        </p>
      </>
    ),
  },
  {
    id: 'services',
    title: 'Services',
    body: (
      <>
        <p>We offer two kinds of services:</p>
        <List
          items={[
            <>
              <Strong>Custom design work</Strong>, including logo design, thread design, signature design, avatar
              design, 3D design, CSS/font design, ads design and other custom design work, agreed with you directly
              (sections 3 to 5).
            </>,
            <>
              <Strong>Customizable video banners</Strong>: ready-made video templates that you personalize yourself
              in the banner builder on this site and buy online (sections 6 to 11).
            </>,
          ]}
        />
        <p>All services are subject to availability and our discretion.</p>
      </>
    ),
  },
  {
    id: 'custom-payment',
    title: 'Custom Design: Payment & Pricing',
    body: (
      <p>
        All prices for custom work are quoted in advance and must be agreed upon before work begins. We accept
        cryptocurrency payments, including BTC, ETH, LTC, USDT and SOL. All payments are final once work has
        commenced, unless otherwise agreed.
      </p>
    ),
  },
  {
    id: 'custom-revisions-delivery',
    title: 'Custom Design: Revisions, Delivery & Refunds',
    body: (
      <>
        <p>
          Each project includes a reasonable number of revisions, as discussed during the initial consultation.
          Additional revisions beyond the agreed scope may incur additional charges.
        </p>
        <p>
          Estimated delivery times are provided at the start of each project. We strive to meet every deadline, but
          delays may occur due to complexity, revisions or unforeseen circumstances.
        </p>
        <p>
          Refunds may be issued at our discretion if work has not yet begun. Once design work has commenced, refunds are
          generally not available. Partial refunds may be considered on a case-by-case basis.
        </p>
      </>
    ),
  },
  {
    id: 'custom-ip',
    title: 'Custom Design: Intellectual Property',
    body: (
      <p>
        Upon full payment, the client receives full rights to use the completed custom design work. We retain the right
        to showcase completed work in our portfolio unless otherwise agreed upon in writing.
      </p>
    ),
  },
  {
    id: 'banner-orders',
    title: 'Video Banners: How Ordering Works',
    body: (
      <>
        <List
          items={[
            'You customize a template: texts, fonts, colors, logos and images, positions and your own layers, within the limits the template allows. The preview on the site is watermarked.',
            'Your draft is saved only in your browser until you check out.',
            'At checkout you give us your email address and we create your order with a private order page. We email you the link to it.',
            'You pay on the order page (see section 8). Once the payment is confirmed, your banner is rendered automatically.',
            'We deliver the finished file without the watermark (see section 9).',
          ]}
        />
        <p>
          We render exactly what you submitted. Please check spelling, texts and images before you pay. You can&apos;t
          change an order after checkout, but you can always create a new one.
        </p>
        <p>
          An order that isn&apos;t paid within 7 days is deleted together with its uploaded images. You have no
          obligation to pay for it.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Video Banners: Your Content',
    body: (
      <>
        <p>
          You are responsible for the texts, logos and images you add to a banner. By uploading or entering them, you
          confirm that you own them or have every right needed to use them this way, and that they don&apos;t infringe
          anyone&apos;s trademark, copyright, privacy or other rights.
        </p>
        <p>
          You allow us to store and process your content only as needed to render, deliver and support your order.
          Your content remains yours.
        </p>
        <p>
          We may refuse, stop or cancel an order whose content is unlawful or infringes someone else&apos;s rights,
          or that is used for fraud, scams, impersonation, hate or harassment. If we cancel a paid order before
          delivering it, we refund you as described in section 10.
        </p>
      </>
    ),
  },
  {
    id: 'banner-payment',
    title: 'Video Banners: Payment in Cryptocurrency',
    body: (
      <>
        <p>
          Prices are shown in US dollars. You pay in cryptocurrency through our payment provider, WestWallet
          (westwallet.io), directly on your order page with no redirect. You choose a coin and network, and we show a
          deposit address, the exact amount and, where the network needs one, a memo or destination tag. We never ask
          for card or bank details.
        </p>
        <List
          items={[
            <>
              <Strong>Price lock.</Strong> The quoted amount in a coin is guaranteed for 30 minutes. A transaction
              first seen within 15 minutes after that still counts as on time. After that, if nothing has been
              received yet, you get a new quote at the current rate.
            </>,
            <>
              <Strong>Late payments.</Strong> For USDT and USDC, the price doesn&apos;t change. For other coins, a
              payment that arrives late may be re-valued at the current rate. If it no longer covers the price, it
              will be reviewed manually and you may be asked to top up.
            </>,
            <>
              <Strong>Underpayment.</Strong> A shortfall of up to 0.5% is accepted. If the shortfall is larger, you
              need to send the rest to the same address before the order is processed.
            </>,
            <>
              <Strong>Overpayment.</Strong> Extra amounts are not refunded automatically. Contact us and we will handle
              it manually on request. For that, you&apos;ll need to give us a wallet address on the same network.
            </>,
            <>
              <Strong>Minimum deposits.</Strong> Some coins and networks have a minimum deposit amount. If your order
              total is below it, that option is unavailable and you need to choose another one.
            </>,
            <>
              <Strong>Correct network.</Strong> Send only the shown coin, on the shown network, with the memo or tag
              if one is shown. Funds sent to the wrong network or without a required memo may be lost, and we may not
              be able to recover them.
            </>,
            <>
              <Strong>Final and public.</Strong> Blockchain transactions are public and irreversible. We can&apos;t
              cancel or reverse a transaction you have sent. Network fees are paid by the sender.
            </>,
          ]}
        />
        <p>
          An order counts as paid once the payment is confirmed on the blockchain and verified with our payment
          provider. We may also mark an order as paid manually, for example after resolving a payment issue with you.
        </p>
      </>
    ),
  },
  {
    id: 'banner-delivery',
    title: 'Video Banners: Delivery & Availability',
    body: (
      <List
        items={[
          'You receive a rendered MP4 file (and a GIF, when the template offers one) without the watermark. You download it from your order page, and we also email you when it is ready.',
          'Download links are signed and valid for 7 days. If one expires, open your order page again to get a fresh link.',
          'Rendered files are kept for 30 days after rendering and are then deleted. Please download and keep your own copy.',
          'After that, your order and its settings are kept, and we can render the banner again on request.',
        ]}
      />
    ),
  },
  {
    id: 'banner-refunds',
    title: 'Video Banners: Refunds',
    body: (
      <>
        <p>
          Video banners are digital goods made to your specifications. By placing an order, you ask us to start
          rendering as soon as the payment is confirmed. Once your banner has been rendered and delivered, it can&apos;t
          be returned and no refund is given. Where the law gives you a right of withdrawal for digital content, you
          agree that it ends when delivery begins.
        </p>
        <p>The exceptions are:</p>
        <List
          items={[
            'the delivered file is defective, for example it is corrupted, won’t play, or doesn’t match the settings you submitted because of an error on our side;',
            'the render failed and the banner can’t be delivered;',
            'we cancel a paid order before delivering it.',
          ]}
        />
        <p>
          In these cases we first try to fix the problem and render the banner again. If we can&apos;t, we refund the
          payment in cryptocurrency to a wallet address you provide. Please report problems as soon as possible, while
          the files are still available. Mistakes in texts or images you submitted yourself are not defects.
        </p>
      </>
    ),
  },
  {
    id: 'banner-license',
    title: 'Video Banners: License',
    body: (
      <>
        <p>
          Once your order is paid in full, you receive a non-exclusive, worldwide, perpetual license to use the banner
          rendered for you for your own advertising, promotional and other commercial purposes. For example, you may
          use it on websites, social media, streams, forums and in ads.
        </p>
        <p>You may not:</p>
        <List
          items={[
            'resell, share or distribute the template itself, or the banner as a template, stock asset or editable file for others to customize;',
            'extract the background video or other template elements and offer them separately;',
            'remove watermarks from previews or use previews in place of a purchased banner;',
            'use the banner for unlawful content or in a way that breaks section 7.',
          ]}
        />
        <p>
          Templates are licensed, not sold. We keep all rights to them and may offer the same template to other buyers.
          Your own texts and logos remain yours.
        </p>
      </>
    ),
  },
  {
    id: 'site-use',
    title: 'Use of the Website',
    body: (
      <p>
        Please don&apos;t misuse the site. For example, don&apos;t try to break or overload it, get around rate limits
        or payment checks, access other people&apos;s orders, or copy the portfolio and templates in bulk. The portfolio
        work shown on the site belongs to us or to our clients and may not be reused without permission.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    body: (
      <>
        <p>
          The site and our products are provided &quot;as is&quot;. We do our best to keep them working, but we
          don&apos;t guarantee that the site will always be available or error-free.
        </p>
        <p>
          Smuzzie shall not be liable for any indirect, incidental, special, consequential or punitive damages, or for
          lost profits, data or business, resulting from the use of or inability to use our services. Our total
          liability for any order is limited to the amount you paid for that order. Nothing in these terms limits
          liability that cannot be limited by law.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to Terms',
    body: (
      <p>
        We may update these terms at any time. The date at the top shows the latest version. An order is governed by
        the terms in effect when it was placed. Continued use of our services after changes constitutes acceptance of
        the new terms.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        For questions about these Terms of Service or your order, please contact us at{' '}
        <A href={`mailto:${EMAIL}`}>{EMAIL}</A> or through our <A href="/contact">Contact page</A>. For a banner
        order, please include your order link.
      </p>
    ),
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of" accent="Service" updated={UPDATED} sections={sections} />;
}
