import TopBar from '@/components/TopBar';
import { DisclaimerPage as DisclaimerContent } from '@/components/DisclaimerBanner';

export default function DisclaimerPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopBar />
      <div className="flex-1 overflow-y-auto">
        <DisclaimerContent />
      </div>
    </div>
  );
}
