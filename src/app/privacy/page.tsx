import type { Metadata } from "next";
import Link from "next/link";
import { BETA_MODE } from "@/lib/beta";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Auriga — Privacy",
  description:
    "What stays on your device, what leaves it only when you ask, and what the server keeps.",
  robots: BETA_MODE ? { index: false, follow: false } : { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="policy">
      <article className="policy-body">
        <p className="policy-label">Auriga · public beta</p>
        <h1 className="policy-title">Privacy, in plain words.</h1>
        <p className="policy-lede">
          Auriga reads a face to suggest colours. There is no account, no sign-up and no photo
          library. This page says exactly what happens to the pixels and the numbers.
        </p>

        <section className="policy-section">
          <h2>What stays on your device</h2>
          <ul>
            <li>
              The camera frames, the 478-point face mesh and the colour maths run in your browser.
              Video never leaves the tab.
            </li>
            <li>
              The colour search runs on your device against a catalogue file the browser downloads
              once.
            </li>
            <li>
              Your reading, your photo and your results are not stored by the app. Refreshing the
              page clears them.
            </li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>What leaves your device, and when</h2>
          <ul>
            <li>
              <strong>Only if you press “Check with server”.</strong> That request contains colour
              values (CIELAB samples and a few quality numbers). It never contains your photo,
              your video or the image data URL.
            </li>
            <li>
              <strong>If you send feedback or the page hits an unexpected error.</strong> Your
              message — and, if you type it, your email address — is posted to the feedback
              endpoint and written to the server log.
            </li>
            <li>
              <strong>Product links.</strong> Clicking through to a shop sends you to that shop,
              under their privacy policy, not ours.
            </li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>What the server keeps</h2>
          <ul>
            <li>
              Request logs held by our hosting provider (Vercel): method, path, status, latency,
              IP address, for a short period under their retention schedule. They are used to keep
              the app up and to spot abuse.
            </li>
            <li>
              Anonymous page-view counts through Vercel Web Analytics. No advertising cookies, no
              cross-site tracking, no profile of you.
            </li>
            <li>
              No account database, no customer list, no sale of anything to anyone.
            </li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Cookies</h2>
          <p>
            The app sets no cookies of its own. The beta notice remembers that you closed it in
            your browser’s local storage. Web Analytics is cookieless.
          </p>
        </section>

        <section className="policy-section">
          <h2>Photography and demo content</h2>
          <p>
            The colour catalogue is built from public product pages at third-party fabric and
            modest-fashion shops. The photography belongs to those shops: we do not mirror or
            republish it. When you look at the colour list, each thumbnail is requested straight
            from the shop&apos;s own image server, which means that shop sees the request — your
            IP address and browser, the same as clicking their product link. Use the{" "}
            <code>NEXT_PUBLIC_SHOW_PHOTOS=0</code> build if you would rather see colour fields
            only, with no third-party requests at all.
          </p>
          <p>
            The demo portraits in this build are Unsplash images used for testing. They are
            photographs of real people who did not consent to being used as shade-reading test
            subjects, and should be replaced before a public launch.
          </p>
        </section>

        <section className="policy-section" id="feedback">
          <h2>Feedback and contact</h2>
          <p>
            Beta feedback goes to the project issue tracker. Open an issue on{" "}
            <a href={SITE.issues} target="_blank" rel="noreferrer">
              GitHub
            </a>
            , or use the “Give feedback” button on the site.
          </p>
          {SITE.contactEmail ? (
            <p>
              Prefer email? Write to{" "}
              <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
            </p>
          ) : null}
          <p>
            <Link href="/read">Back to the shade reader</Link>
          </p>
        </section>
      </article>
    </main>
  );
}
