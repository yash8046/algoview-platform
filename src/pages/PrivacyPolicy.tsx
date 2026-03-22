import TopBar from '@/components/TopBar';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopBar />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 pb-12">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Privacy Policy</h1>
          </div>
          <p className="text-xs text-muted-foreground">Last updated: March 20, 2026</p>

          <div className="bg-card rounded-lg border border-border p-5 sm:p-6 space-y-5 text-sm text-muted-foreground leading-relaxed">
            <Section title="1. Information We Collect">
              <p>We collect the following information when you use AlgoInsight:</p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
                <li><strong className="text-foreground">Account data:</strong> Email address used to create your account.</li>
                <li><strong className="text-foreground">Usage data:</strong> Simulated trades, watchlist selections, and analysis preferences stored to provide the service.</li>
                <li><strong className="text-foreground">Device data:</strong> Browser type, screen size, and general device information for improving the experience.</li>
              </ul>
            </Section>

            <Section title="2. How We Use Your Information">
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>To provide and maintain the market analysis service</li>
                <li>To save your simulation portfolio and watchlist preferences</li>
                <li>To generate AI-powered market insights tailored to your selected assets</li>
                <li>To improve app performance and user experience</li>
              </ul>
            </Section>

            <Section title="3. Data Storage & Security">
              <p>Your data is stored securely using industry-standard encryption and cloud infrastructure. We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
            </Section>

            <Section title="4. Third-Party Services">
              <p>AlgoInsight uses the following third-party services to operate:</p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
                <li>Cloud authentication and database services for account management</li>
                <li>AI language models for generating market insights</li>
                <li>Market data APIs for real-time pricing information</li>
              </ul>
              <p className="mt-2">These services process data according to their own privacy policies.</p>
            </Section>

            <Section title="5. No Financial Data Collection">
              <p>AlgoInsight does not collect, store, or process any real financial account information, bank details, brokerage credentials, or payment information. All trading within the app is simulated using virtual currency.</p>
            </Section>

            <Section title="6. Data Retention">
              <p>Your account data and simulation history are retained as long as your account is active. You may request deletion of your account and associated data at any time by contacting us.</p>
            </Section>

            <Section title="7. Children's Privacy">
              <p>AlgoInsight is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.</p>
            </Section>

            <Section title="8. Your Rights">
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and data</li>
                <li>Withdraw consent for data processing</li>
              </ul>
            </Section>

            <Section title="9. Changes to This Policy">
              <p>We may update this Privacy Policy from time to time. Changes will be posted within the app with an updated effective date.</p>
            </Section>

            <Section title="10. Contact Us">
              <p>If you have questions about this Privacy Policy, please reach out through the app's support channels.</p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-foreground font-semibold mb-2">{title}</h3>
      {children}
    </section>
  );
}
