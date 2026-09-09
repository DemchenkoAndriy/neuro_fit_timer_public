import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { PlanScreen } from './screens/PlanScreen';
import { NutritionScreen } from './screens/NutritionScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { ChallengeScreen } from './screens/ChallengeScreen';
import { RunnerScreen } from './screens/RunnerScreen';

/** Tab shell: scrollable screen plus the persistent bottom navigation. */
function TabLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

export function App() {
  return (
    <div className="app-frame">
      <Routes>
        <Route element={<TabLayout />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/nutrition" element={<NutritionScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/workout/:workoutId" element={<WorkoutScreen />} />
        </Route>
        {/* The runner takes over the whole frame — no tab bar while training. */}
        <Route path="/run/:workoutId" element={<RunnerScreen />} />
        <Route path="/challenge" element={<ChallengeScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
