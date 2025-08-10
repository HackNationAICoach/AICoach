import React, { useState, useEffect } from 'react';
import { CameraFeed } from '@/components/CameraFeed';
import { PoseDetection, type SquatAnalysis } from '@/components/PoseDetection';
import { VoiceCoach } from '@/components/VoiceCoach';
import { WorkoutSession } from '@/components/WorkoutSession';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, Bot, Camera, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const Index = () => {
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isCoachingActive, setIsCoachingActive] = useState(false);
  const [currentExercise, setCurrentExercise] = useState('squats');
  const [squatAnalysis, setSquatAnalysis] = useState<SquatAnalysis | null>(null);
  const [showGetStarted, setShowGetStarted] = useState(true);

  const handleVideoStream = (stream: MediaStream | null) => {
    setVideoStream(stream);
  };

  const handlePoseResults = (results: any) => {
    if (results.squatAnalysis) {
      setSquatAnalysis(results.squatAnalysis);
    }
  };

  const handleSessionStart = () => {
    console.log('Session starting...');
    setIsSessionActive(true);
    setShowGetStarted(false);
  };

  const handleSessionEnd = () => {
    setIsSessionActive(false);
  };

  const handleCoachingStart = () => {
    setIsCoachingActive(true);
  };

  const handleCoachingStop = () => {
    setIsCoachingActive(false);
  };

  const handleQuickStart = () => {
    setShowGetStarted(false);
    handleSessionStart(); // Use the session start handler to properly set up timing
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-coach-surface">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-energy-gradient flex items-center justify-center">
                <Dumbbell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">AI Fitness Coach</h1>
                <p className="text-sm text-muted-foreground">Real-time form analysis & voice coaching</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={isSessionActive ? 'default' : 'secondary'} className="gap-1">
                <Camera className="w-3 h-3" />
                {videoStream ? 'Camera Active' : 'Camera Off'}
              </Badge>
              <Badge variant={isCoachingActive ? 'default' : 'secondary'} className="gap-1">
                <Bot className="w-3 h-3" />
                {isCoachingActive ? 'AI Coach On' : 'AI Coach Off'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Get Started Section */}
        {showGetStarted && (
          <Card className="mb-6 p-8 bg-motivation-gradient text-white border-0 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2">Welcome to AI Fitness Coach</h2>
                  <p className="text-lg text-white/90">
                    Get real-time form analysis and voice coaching for perfect workouts
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-white/80" />
                  <span className="text-white/90">Live camera analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-white/80" />
                  <span className="text-white/90">AI voice coaching</span>
                </div>
                <div className="flex items-center gap-3">
                  <Dumbbell className="w-5 h-5 text-white/80" />
                  <span className="text-white/90">Perfect form tracking</span>
                </div>
              </div>
              
              <Button 
                variant="coach" 
                size="lg" 
                onClick={handleQuickStart}
                className="bg-white text-primary hover:bg-white/90 font-semibold"
              >
                Start Your First Workout
              </Button>
            </div>
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20" />
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Camera & Analysis */}
          <div className="lg:col-span-2 space-y-6">
            {/* Camera Feed */}
            <div className="relative">
              <CameraFeed
                onVideoStream={handleVideoStream}
                isActive={isSessionActive}
              />
              
              {/* Pose Detection Overlay */}
              {videoStream && isSessionActive && (
                <div className="absolute inset-0 pointer-events-none z-30">
                  <PoseDetection
                    videoStream={videoStream}
                    onPoseResults={handlePoseResults}
                    isActive={isSessionActive}
                  />
                </div>
              )}
              
              {/* Live Status Overlay */}
              {isSessionActive && (
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge variant="default" className="bg-exercise-active text-white">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />
                    Live Analysis
                  </Badge>
                  {squatAnalysis?.isSquatting && (
                    <Badge variant="default" className="bg-accent text-accent-foreground">
                      Squatting Detected
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Form Feedback Card */}
            {squatAnalysis && isSessionActive && squatAnalysis.isSquatting && (
              <Card className="p-4 bg-coach-surface-elevated border-primary/20">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  Real-time Form Analysis
                </h3>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className={cn(
                      "text-2xl font-bold",
                      squatAnalysis.depth > 60 ? "text-form-correct" : "text-accent"
                    )}>
                      {Math.round(squatAnalysis.depth)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Depth</div>
                  </div>
                  
                  <div className="text-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm font-bold",
                      squatAnalysis.kneeAlignment === 'good' 
                        ? "bg-form-correct text-white" 
                        : "bg-form-incorrect text-white"
                    )}>
                      {squatAnalysis.kneeAlignment === 'good' ? '✓' : '!'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Knees</div>
                  </div>
                  
                  <div className="text-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm font-bold",
                      squatAnalysis.backAlignment === 'good' 
                        ? "bg-form-correct text-white" 
                        : "bg-form-incorrect text-white"
                    )}>
                      {squatAnalysis.backAlignment === 'good' ? '✓' : '!'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Back</div>
                  </div>
                </div>

                {/* Live Feedback */}
                {squatAnalysis.feedback.length > 0 && (
                  <div className="space-y-2">
                    {squatAnalysis.feedback.map((feedback, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-accent rounded-full" />
                        <span className="text-foreground">{feedback}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Right Column - Controls */}
          <div className="space-y-6">
            {/* Workout Session */}
            <WorkoutSession
              isActive={isSessionActive}
              onSessionStart={handleSessionStart}
              onSessionEnd={handleSessionEnd}
              currentExercise={currentExercise}
              onExerciseChange={setCurrentExercise}
            />

            {/* Voice Coach */}
            <VoiceCoach
              squatAnalysis={squatAnalysis}
              onCoachingStart={handleCoachingStart}
              onCoachingStop={handleCoachingStop}
              isActive={isCoachingActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;