import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkoutSessionProps {
  isActive: boolean;
  onSessionStart: () => void;
  onSessionEnd: () => void;
  currentExercise: string;
  onExerciseChange: (exercise: string) => void;
}

interface SessionStats {
  duration: number;
  squatsCompleted: number;
  goodFormReps: number;
  currentStreak: number;
  bestStreak: number;
}

const EXERCISES = [
  { id: 'squats', name: 'Squats', target: 'legs', description: 'Perfect your squat form' },
  { id: 'lunges', name: 'Lunges', target: 'legs', description: 'Coming soon' },
  { id: 'pushups', name: 'Push-ups', target: 'chest', description: 'Coming soon' },
  { id: 'planks', name: 'Planks', target: 'core', description: 'Coming soon' },
];

export const WorkoutSession: React.FC<WorkoutSessionProps> = ({
  isActive,
  onSessionStart,
  onSessionEnd,
  currentExercise,
  onExerciseChange
}) => {
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    duration: 0,
    squatsCompleted: 0,
    goodFormReps: 0,
    currentStreak: 0,
    bestStreak: 0
  });
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Timer effect
  useEffect(() => {
    console.log('Timer effect - isActive:', isActive, 'sessionStartTime:', sessionStartTime);
    let interval: NodeJS.Timeout;
    
    if (isActive && sessionStartTime) {
      console.log('Starting timer interval');
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
        console.log('Timer tick - elapsed seconds:', elapsed);
        setSessionStats(prev => ({
          ...prev,
          duration: elapsed
        }));
      }, 1000);
    }

    return () => {
      if (interval) {
        console.log('Clearing timer interval');
        clearInterval(interval);
      }
    };
  }, [isActive, sessionStartTime]);

  const handleSessionToggle = () => {
    console.log('Session toggle called, isActive:', isActive);
    if (isActive) {
      onSessionEnd();
      setSessionStartTime(null);
    } else {
      const now = Date.now();
      console.log('Starting session at:', now);
      setSessionStartTime(now);
      setSessionStats({
        duration: 0,
        squatsCompleted: 0,
        goodFormReps: 0,
        currentStreak: 0,
        bestStreak: 0
      });
      onSessionStart();
    }
  };

  const resetSession = () => {
    setSessionStats({
      duration: 0,
      squatsCompleted: 0,
      goodFormReps: 0,
      currentStreak: 0,
      bestStreak: 0
    });
    if (isActive) {
      setSessionStartTime(Date.now());
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedExercise = EXERCISES.find(ex => ex.id === currentExercise);

  return (
    <div className="space-y-6">
      {/* Exercise Selection */}
      <Card className="p-6 bg-coach-surface-elevated border-primary/20">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Choose Your Exercise
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXERCISES.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => onExerciseChange(exercise.id)}
              disabled={exercise.id !== 'squats'} // Only squats are available for now
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                "hover:bg-coach-surface focus:outline-none focus:ring-2 focus:ring-primary",
                currentExercise === exercise.id
                  ? "border-primary bg-coach-accent-soft"
                  : "border-border bg-coach-surface",
                exercise.id !== 'squats' && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-foreground">{exercise.name}</h4>
                <Badge variant={exercise.id === 'squats' ? 'default' : 'secondary'} className="text-xs">
                  {exercise.target}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{exercise.description}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Session Controls */}
      <Card className="p-6 bg-coach-surface-elevated border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-foreground">Workout Session</h3>
            <p className="text-sm text-muted-foreground">
              {selectedExercise?.name || 'Select an exercise to begin'}
            </p>
          </div>
          
          <Badge 
            variant={isActive ? 'default' : 'secondary'}
            className={cn(
              "px-3 py-1",
              isActive && "bg-exercise-active text-white animate-pulse"
            )}
          >
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Session Timer and Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{formatTime(sessionStats.duration)}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Duration</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{sessionStats.squatsCompleted}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Reps</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-form-correct">{sessionStats.goodFormReps}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Good Form</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{sessionStats.currentStreak}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Streak</div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-3">
          <Button
            variant={isActive ? "destructive" : "energy"}
            onClick={handleSessionToggle}
            disabled={!selectedExercise}
            className="flex-1"
          >
            {isActive ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                End Session
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Session
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={resetSession}
            disabled={!isActive && sessionStats.duration === 0}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress Indicator */}
        {isActive && sessionStats.squatsCompleted > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Form Accuracy</span>
              <span className="text-foreground font-medium">
                {Math.round((sessionStats.goodFormReps / sessionStats.squatsCompleted) * 100)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-form-correct h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(sessionStats.goodFormReps / sessionStats.squatsCompleted) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};