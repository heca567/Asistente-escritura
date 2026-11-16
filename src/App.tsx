import { appContainer } from './app/container';
import { WritingStudioPage } from './ui/components/WritingStudioPage';

export default function App() {
  return <WritingStudioPage useCases={appContainer} />;
}
