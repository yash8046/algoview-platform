import { AlertTriangle, Shield, FileText, Info } from 'lucide-react';
import TopBar from '@/components/TopBar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function MorePage() {
  return (
    <div className="flex h-[calc(100dvh-1.75rem)] max-h-[calc(100dvh-1.75rem)] min-h-0 flex-col overflow-hidden overscroll-none">
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:p-4">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">More</h1>
        </div>

        <Accordion type="multiple" className="space-y-2">
          {/* Disclaimer */}
          <AccordionItem value="disclaimer" className="border rounded-lg border-warning/20 bg-warning/5 px-3">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-card border border-border">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-foreground">Disclaimer</h3>
                  <p className="text-[10px] text-muted-foreground">Important info about AI insights & risk</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed pb-2">
                <Section title="Market Analysis Tool">
                  <p>This application is an AI-powered market research and analysis dashboard. It provides probabilistic insights based on technical indicators, sentiment analysis, and machine learning models.</p>
                </Section>
                <Section title="Not Financial Advice">
                  <p>Nothing in this application constitutes financial advice, investment recommendation, or solicitation to buy or sell any financial instrument. All outputs are for informational and educational purposes only.</p>
                </Section>
                <Section title="Simulation Mode">
                  <p>All trading features operate in simulation mode using virtual currency. No real money is involved. Paper trading results do not reflect real market conditions including slippage, liquidity, and execution delays.</p>
                </Section>
                <Section title="AI Model Limitations">
                  <p>AI-generated insights are experimental model outputs. They are probabilistic in nature and may be inaccurate. The models may not account for all market factors, breaking news, or black swan events.</p>
                </Section>
                <Section title="Risk Warning">
                  <p>Financial markets carry inherent risk. Past performance does not guarantee future results. Always conduct your own research and consult a qualified financial advisor before making investment decisions.</p>
                </Section>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Privacy Policy */}
          <AccordionItem value="privacy" className="border rounded-lg border-primary/20 bg-primary/5 px-3">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-card border border-border">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-foreground">Privacy Policy</h3>
                  <p className="text-[10px] text-muted-foreground">How we collect, use & protect your data</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed pb-2">
                <p className="text-[10px] text-muted-foreground/60">Last updated: March 20, 2026</p>
                <Section title="1. Information We Collect">
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><strong className="text-foreground">Account data:</strong> Email address used to create your account.</li>
                    <li><strong className="text-foreground">Usage data:</strong> Simulated trades, watchlist selections, and analysis preferences.</li>
                    <li><strong className="text-foreground">Device data:</strong> Browser type, screen size, and general device information.</li>
                  </ul>
                </Section>
                <Section title="2. How We Use Your Information">
                  <ul className="list-disc list-inside space-y-1">
                    <li>To provide and maintain the market analysis service</li>
                    <li>To save your simulation portfolio and watchlist preferences</li>
                    <li>To generate AI-powered market insights</li>
                    <li>To improve app performance and user experience</li>
                  </ul>
                </Section>
                <Section title="3. Data Storage & Security">
                  <p>Your data is stored securely using industry-standard encryption and cloud infrastructure. We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
                </Section>
                <Section title="4. Third-Party Services">
                  <p>AlgoInsight uses cloud authentication, AI language models, and market data APIs. These services process data according to their own privacy policies.</p>
                </Section>
                <Section title="5. No Financial Data Collection">
                  <p>AlgoInsight does not collect, store, or process any real financial account information. All trading is simulated using virtual currency.</p>
                </Section>
                <Section title="6. Your Rights">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Access the personal data we hold about you</li>
                    <li>Request correction of inaccurate data</li>
                    <li>Request deletion of your account and data</li>
                    <li>Withdraw consent for data processing</li>
                  </ul>
                </Section>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Terms of Service */}
          <AccordionItem value="terms" className="border rounded-lg border-gain/20 bg-gain/5 px-3">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-card border border-border">
                  <FileText className="w-4 h-4 text-gain" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-foreground">Terms of Service</h3>
                  <p className="text-[10px] text-muted-foreground">Rules & conditions for using AlgoInsight</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed pb-2">
                <p className="text-[10px] text-muted-foreground/60">Last updated: March 20, 2026</p>
                <Section title="1. Acceptance of Terms">
                  <p>By accessing or using AlgoInsight, you agree to be bound by these Terms of Service.</p>
                </Section>
                <Section title="2. Description of Service">
                  <p>AlgoInsight is an AI-powered market research tool providing AI insights, technical indicators, paper trading simulation, and watchlist tracking.</p>
                </Section>
                <Section title="3. Not Financial Advice">
                  <p className="font-semibold text-warning">AlgoInsight does NOT provide financial advice or investment recommendations. All outputs are for informational and educational purposes only.</p>
                </Section>
                <Section title="4. Simulation Mode">
                  <ul className="list-disc list-inside space-y-1">
                    <li>No real money is involved in any transaction</li>
                    <li>Virtual balances have no monetary value</li>
                    <li>Simulated results do not reflect actual market conditions</li>
                  </ul>
                </Section>
                <Section title="5. User Responsibilities">
                  <ul className="list-disc list-inside space-y-1">
                    <li>You are solely responsible for any financial decisions</li>
                    <li>You must not use this app as a substitute for professional financial advice</li>
                    <li>You must be at least 18 years old to use this service</li>
                  </ul>
                </Section>
                <Section title="6. Limitation of Liability">
                  <p>To the maximum extent permitted by law, AlgoInsight shall not be liable for any damages arising from use of or reliance on AI-generated insights.</p>
                </Section>
                <Section title="7. Disclaimer of Warranties">
                  <p>The service is provided "as is" and "as available" without warranties of any kind.</p>
                </Section>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="text-center mt-6 pb-4">
          <p className="text-[10px] text-muted-foreground/50 font-mono">AlgoInsight v1.0 • AI Market Analysis Tool</p>
          <p className="text-[10px] text-muted-foreground/40 mt-1">For educational & research purposes only</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-foreground font-semibold text-xs mb-1">{title}</h4>
      {children}
    </div>
  );
}
