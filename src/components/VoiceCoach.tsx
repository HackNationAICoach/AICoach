import React, { useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SquatAnalysis } from './PoseDetection';

interface VoiceCoachProps {
  squatAnalysis: SquatAnalysis | null;
  onCoachingStart: () => void;
  onCoachingStop: () => void;
  isActive: boolean;
  currentExercise: string;
}

export const VoiceCoach: React.FC<VoiceCoachProps> = ({
  squatAnalysis,
  onCoachingStart,
  onCoachingStop,
  isActive,
  currentExercise,
}) => {
  const [agentId, setAgentId] = useState(() => localStorage.getItem('eleven_agent_id') || '');
  const [usePrivate, setUsePrivate] = useState(() => localStorage.getItem('eleven_private') === 'true');
  const [volume, setVolume] = useState(0.8);
  const [lastFeedbackTime, setLastFeedbackTime] = useState(0);

  const conversation = useConversation({
    clientTools: {
      getPostureSnapshot: () => {
        const snapshot = squatAnalysis
          ? {
              isSquatting: squatAnalysis.isSquatting,
              depth: Math.round(squatAnalysis.depth),
              knees: squatAnalysis.kneeAlignment,
              back: squatAnalysis.backAlignment,
            }
          : null;
        const summary = snapshot
          ? `Move: ${currentExercise}. ${snapshot.isSquatting ? 'Squatting' : 'Standing'}. Depth ${snapshot.depth}%. Knees ${snapshot.knees}. Back ${snapshot.back}.`
          : `Move: ${currentExercise}. No posture detected yet.`;
        return summary; // tools must return string/number/void
      },
      getCurrentMove: () => currentExercise,
    },
    onConnect: () => {
      console.log('AI Coach connected');
      onCoachingStart();
    },
    onDisconnect: () => {
      console.log('AI Coach disconnected');
      onCoachingStop();
    },
    onMessage: (message) => {
      console.log('Coach message:', message);
    },
    onError: (error) => {
      console.error('Coach error:', error);
    },
    overrides: {
      agent: {
        prompt: {
          prompt: `You are an experienced fitness coach specializing in movement analysis and form correction. 
          Your role is to provide real-time feedback on exercise form, particularly squats. 
          Be encouraging, specific, and constructive in your feedback. 
          Keep instructions clear and concise. Focus on safety and proper form.
          
          You can call client tools to get the latest posture or selected move: getPostureSnapshot(), getCurrentMove().
          When replying, be short and specific: either "Great rep!" or a single correction.
          
          When the user is performing squats, provide feedback on:
          - Squat depth and whether they're reaching proper depth
          - Knee alignment and tracking
          - Back posture and chest position
          - Overall movement quality
          
          Be motivational and positive while being specific about corrections needed.`
        },
        firstMessage: "Hey there! I'm your AI fitness coach. When you're ready, say 'start coaching'. I'll watch your movement and give concise feedback.",
        language: "en"
      }
    }
  });

  const { status, isSpeaking } = conversation;

  useEffect(() => {
    localStorage.setItem('eleven_agent_id', agentId);
  }, [agentId]);
  useEffect(() => {
    localStorage.setItem('eleven_private', String(usePrivate));
  }, [usePrivate]);

  const startCoaching = async () => {
    if (!agentId) {
      alert('Please configure your ElevenLabs Agent ID first');
      return;
    }

    try {
      if (usePrivate) {
        const res = await fetch('/functions/v1/eleven-signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId })
        });
        if (!res.ok) throw new Error('Failed to get signed URL');
        const data = await res.json();
        if (!data?.signed_url) throw new Error('Invalid signed URL response');
        await conversation.startSession({ authorization: data.signed_url } as any);
      } else {
        await conversation.startSession({ agentId });
      }
    } catch (error) {
      console.error('Failed to start coaching session:', error);
      alert('Could not start coaching. Check your agent settings.');
    }
  };

  const stopCoaching = async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to stop coaching session:', error);
    }
  };

  const adjustVolume = async (newVolume: number) => {
    setVolume(newVolume);
    try {
      await conversation.setVolume({ volume: newVolume });
    } catch (error) {
      console.error('Failed to adjust volume:', error);
    }
  };

  // Provide contextual feedback based on squat analysis
  useEffect(() => {
    if (!squatAnalysis || !isActive || status !== 'connected') return;

    const now = Date.now();
    const timeSinceLastFeedback = now - lastFeedbackTime;

    // Only provide feedback every 3 seconds to avoid overwhelming
    if (timeSinceLastFeedback < 3000) return;

    if (squatAnalysis.isSquatting && squatAnalysis.feedback.length > 0) {
      // The AI coach will naturally respond to the conversation context
      // We could implement a system to send context to the AI here
      setLastFeedbackTime(now);
    }
  }, [squatAnalysis, isActive, status, lastFeedbackTime]);

  return (
    <Card className="p-6 bg-coach-surface-elevated border-primary/20">
      <div className="space-y-6">
        {/* Coach Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-3 h-3 rounded-full transition-colors",
                status === 'connected' ? "bg-form-correct animate-pulse" : "bg-muted"
              )}
            />
            <div>
              <h3 className="font-semibold text-foreground">AI Fitness Coach</h3>
              <p className="text-sm text-muted-foreground">
                {status === 'connected' ? 'Connected and ready' : 'Disconnected'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSpeaking && (
              <div className="flex items-center gap-1 text-accent">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm">Speaking...</span>
              </div>
            )}
          </div>
        </div>

        {/* Agent Configuration */}
        <div className="p-4 bg-coach-accent-soft rounded-lg border border-primary/20 space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm text-foreground font-medium">ElevenLabs Agent ID</label>
            <input
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="Paste your Agent ID"
              className="w-full px-3 py-2 rounded-md border border-primary/20 bg-coach-surface text-foreground"
            />
          </div>
          <label className="flex items-center justify-between text-sm text-foreground">
            <span>Use private agent (requires XI_API_KEY secret)</span>
            <input
              type="checkbox"
              checked={usePrivate}
              onChange={(e) => setUsePrivate(e.target.checked)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Private mode mints a signed URL from a Supabase Edge Function using your ElevenLabs API key stored as a Supabase secret.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Button
            variant={status === 'connected' ? "destructive" : "energy"}
            onClick={status === 'connected' ? stopCoaching : startCoaching}
            disabled={!agentId}
            className="flex-1"
          >
            {status === 'connected' ? (
              <>
                <MicOff className="w-4 h-4 mr-2" />
                Stop Coaching
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Start Coaching
              </>
            )}
          </Button>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => adjustVolume(volume > 0 ? 0 : 0.8)}
            >
              {volume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => adjustVolume(parseFloat(e.target.value))}
              className="w-20 accent-primary"
            />
          </div>
        </div>

        {/* Live Feedback Display */}
        {squatAnalysis && isActive && (
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Live Analysis</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={cn(
                    "font-medium",
                    squatAnalysis.isSquatting ? "text-exercise-active" : "text-muted-foreground"
                  )}>
                    {squatAnalysis.isSquatting ? 'Squatting' : 'Standing'}
                  </span>
                </div>
                
                {squatAnalysis.isSquatting && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Depth:</span>
                    <span className={cn(
                      "font-medium",
                      squatAnalysis.depth > 60 ? "text-form-correct" : "text-accent"
                    )}>
                      {Math.round(squatAnalysis.depth)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Knees:</span>
                  <span className={cn(
                    "font-medium",
                    squatAnalysis.kneeAlignment === 'good' ? "text-form-correct" : "text-form-incorrect"
                  )}>
                    {squatAnalysis.kneeAlignment === 'good' ? 'Good' : 'Adjust'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Back:</span>
                  <span className={cn(
                    "font-medium",
                    squatAnalysis.backAlignment === 'good' ? "text-form-correct" : "text-form-incorrect"
                  )}>
                    {squatAnalysis.backAlignment === 'good' ? 'Good' : 'Adjust'}
                  </span>
                </div>
              </div>
            </div>

            {squatAnalysis.feedback.length > 0 && (
              <div className="space-y-1">
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Current Feedback:
                </h5>
                {squatAnalysis.feedback.map((feedback, index) => (
                  <p key={index} className="text-sm text-accent-foreground">
                    • {feedback}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};