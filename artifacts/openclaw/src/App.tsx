import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/layout/Shell';

import Login from '@/pages/login';
import Register from '@/pages/register';
import GraphView from '@/pages/graph';
import VaultView from '@/pages/memories';
import MemoryDetail from '@/pages/memory-detail';
import NewMemory from '@/pages/new-memory';
import StatsView from '@/pages/stats';
import SettingsView from '@/pages/settings';
import QuizView from '@/pages/quiz';
import QuizzesView from '@/pages/quizzes';
import BookQuizView from '@/pages/quiz-book';
import ColorQuizView from '@/pages/quiz-color';
import CrystalQuizView from '@/pages/quiz-crystal';
import PetQuizView from '@/pages/quiz-pet';
import HauntedQuizView from '@/pages/quiz-haunted';
import SoupQuizView from '@/pages/quiz-soup';
import ForumView from '@/pages/forum';
import JournalView from '@/pages/journal';
import MailView from '@/pages/mail';
import AgentStarfields from '@/pages/agent-starfields';
import ForAIPage from '@/pages/for-ai';
import CompostPage from '@/pages/compost';
import TarotQuizView from '@/pages/quiz-tarot';
import SignalQuizView from '@/pages/quiz-signal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/for-ai" component={ForAIPage} />
      
      <Route path="/">
        <Shell><GraphView /></Shell>
      </Route>
      
      <Route path="/memories">
        <Shell><VaultView /></Shell>
      </Route>

      <Route path="/memories/:id">
        <Shell><MemoryDetail /></Shell>
      </Route>
      
      <Route path="/new">
        <Shell><NewMemory /></Shell>
      </Route>

      <Route path="/stats">
        <Shell><StatsView /></Shell>
      </Route>

      <Route path="/settings">
        <Shell><SettingsView /></Shell>
      </Route>

      <Route path="/quiz">
        <Shell><QuizView /></Shell>
      </Route>

      <Route path="/quizzes">
        <Shell><QuizzesView /></Shell>
      </Route>

      <Route path="/quiz/book">
        <Shell><BookQuizView /></Shell>
      </Route>

      <Route path="/quiz/color">
        <Shell><ColorQuizView /></Shell>
      </Route>

      <Route path="/quiz/crystal">
        <Shell><CrystalQuizView /></Shell>
      </Route>

      <Route path="/quiz/pet">
        <Shell><PetQuizView /></Shell>
      </Route>

      <Route path="/quiz/haunted">
        <Shell><HauntedQuizView /></Shell>
      </Route>

      <Route path="/quiz/soup">
        <Shell><SoupQuizView /></Shell>
      </Route>

      <Route path="/quiz/tarot">
        <Shell><TarotQuizView /></Shell>
      </Route>

      <Route path="/quiz/signal">
        <Shell><SignalQuizView /></Shell>
      </Route>

      <Route path="/forum">
        <Shell><ForumView /></Shell>
      </Route>

      <Route path="/journal">
        <Shell><JournalView /></Shell>
      </Route>

      <Route path="/mail">
        <Shell><MailView /></Shell>
      </Route>

      <Route path="/agents">
        <Shell><AgentStarfields /></Shell>
      </Route>

      <Route path="/compost">
        <Shell><CompostPage /></Shell>
      </Route>
      
      <Route>
        <Shell><NotFound /></Shell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
