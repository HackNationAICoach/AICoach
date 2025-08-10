import React, { useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
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
  const HARD_CODED_AGENT_ID = 'agent_1401k28a2a06fee9xm5kv0j8mbmg';
  const [agentId, setAgentId] = useState(HARD_CODED_AGENT_ID);
  const [usePrivate, setUsePrivate] = useState(() => localStorage.getItem('eleven_private') === 'true');
  const [volume, setVolume] = useState(0.8);
  const [lastFeedbackTime, setLastFeedbackTime] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectAttemptAt, setConnectAttemptAt] = useState<number>(0);
  const [fallbackTried, setFallbackTried] = useState(false);
  const [debugMode, setDebugMode] = useState(() => localStorage.getItem('coach_debug') === 'true');
  const [logs, setLogs] = useState<string[]>([]);
  const [safeMode, setSafeMode] = useState(() => {
    const stored = localStorage.getItem('coach_safe_mode');
    return stored === null ? false : stored === 'true';
  });
  const [lastToolCallAt, setLastToolCallAt] = useState<number>(0);
  const [ttsFallbackEnabled, setTtsFallbackEnabled] = useState(false);

  const log = (...args: any[]) => {
    console.log('[VoiceCoach]', ...args);
    if (!debugMode) return;
    const msg = args
      .map((a: any) => (typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()))
      .join(' ');
    setLogs((prev) => [...prev.slice(-99), `${new Date().toISOString()} ${msg}`]);
  };

  const redactUrl = (u?: string) => {
    if (!u) return u;
    try {
      const url = new URL(u);
      if (url.searchParams.has('conversation_signature')) {
        url.searchParams.set('conversation_signature', '***');
      }
      return url.toString();
    } catch {
      return u;
    }
  };

  const conversation = useConversation({
    clientTools: {
      getPostureSnapshot: () => {
        setLastToolCallAt(Date.now());
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
        log('Tool:getPostureSnapshot', snapshot, summary);
        return summary; // tools must return string/number/void
      },
      getCurrentMove: () => {
        setLastToolCallAt(Date.now());
        log('Tool:getCurrentMove ->', currentExercise);
        return currentExercise;
      },
    },
    onConnect: () => {
      log('AI Coach connected');
      onCoachingStart();
    },
    onDisconnect: () => {
      log('AI Coach disconnected');
      onCoachingStop();
      const justAttempted = !!connectAttemptAt && Date.now() - connectAttemptAt < 5000;

      // Auto-fallback: if public agent drops instantly, try private signed URL once
      if (!usePrivate && justAttempted && !fallbackTried) {
        log('Attempting private signed-URL fallback after quick disconnect');
        setFallbackTried(true);
        (async () => {
          try {
            const { data, error } = await supabase.functions.invoke('eleven-signed-url', {
              body: { agentId: agentId.trim() },
            });
            if (error) throw new Error(error.message || 'Failed to get signed URL');
            const signedUrl = (data as any)?.signed_url;
            if (!signedUrl) throw new Error('Invalid signed URL response');
            await conversation.startSession({ url: signedUrl } as any);
            alert('Switched to private connection automatically.');
          } catch (e) {
            console.error('Fallback connection failed:', e);
            const msg = (e as any)?.message || JSON.stringify(e) || 'Unknown error';
            alert(`Coach disconnected and fallback failed: ${msg}`);
          }
        })();
        return;
      }

      if (lastError) {
        alert(`Coach disconnected: ${lastError}`);
      } else if (justAttempted) {
        alert('Coach disconnected right after connecting. If your agent is private, enable "Use private agent" to use the signed URL. If it\'s public, ensure the agent is set to Public/Live in ElevenLabs.');
      }
    },
    onMessage: (message) => {
      log('Coach message:', message);
    },
    onError: (error) => {
      console.error('Coach error:', error);
      const msg = (error as any)?.message || (error as any)?.reason || JSON.stringify(error);
      setLastError(typeof msg === 'string' ? msg : 'Unknown error');
    },
    overrides: safeMode ? undefined : {
      agent: {
        prompt: {
          prompt: `You are an experienced fitness coach specializing in movement analysis and form correction.
          Your role is to provide real-time feedback on exercise form, particularly squats.
          Be encouraging, specific, and constructive in your feedback. Keep instructions clear and concise. Focus on safety and proper form.

          You can call client tools to get the latest posture or selected move: getPostureSnapshot(), getCurrentMove().
          While connected and the user is training, every 3 seconds call getPostureSnapshot() and provide ONE short piece of feedback.
          If posture is not detected or the user is not squatting, wait silently.

          When the user is performing squats, focus on:
          - Squat depth and whether they reach proper depth
          - Knee alignment and tracking
          - Back posture and chest position
          - Overall movement quality

          Keep replies to a single sentence like "Great rep!" or one specific correction.`
        },
        firstMessage: "Hey there! I'm your AI fitness coach. When you're ready, say 'start coaching'. I'll watch your movement and give concise feedback.",
        language: "en"
      },
      tts: {
        voiceId: "9BWtsMINqrJLrRacOk9x"
      }
    },
  });
  const { status, isSpeaking } = conversation;

  useEffect(() => {
    localStorage.setItem('eleven_agent_id', agentId);
  }, [agentId]);
  useEffect(() => {
    localStorage.setItem('eleven_private', String(usePrivate));
  }, [usePrivate]);
  useEffect(() => {
    localStorage.setItem('coach_debug', String(debugMode));
  }, [debugMode]);
  useEffect(() => {
    localStorage.setItem('coach_safe_mode', String(safeMode));
  }, [safeMode]);
  const startCoaching = async () => {
    if (!agentId) {
      alert('Please configure your ElevenLabs Agent ID first');
      return;
    }

    // Ensure microphone permission before starting the session
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Microphone permission error:', err);
      alert('Microphone access is required. Please allow microphone permissions and try again.');
      return;
    }

    try {
      setConnectAttemptAt(Date.now());
      setLastError(null);
      log('Starting coaching session...', { usePrivate, agentId: agentId.trim() });
      if (usePrivate) {
        // Validate agent with the same XI_API_KEY workspace first
        const vres = await supabase.functions.invoke('eleven-signed-url', {
          body: { agentId: agentId.trim(), validate: true },
        });
        const vdata: any = vres.data;
        if (vdata && vdata.valid === false) {
          log('Agent validation failed', vdata);
          alert(`Agent validation failed: ${vdata.status} ${vdata.message || ''}`);
          return;
        }

        const { data, error } = await supabase.functions.invoke('eleven-signed-url', {
          body: { agentId: agentId.trim() },
        });
        if (error) throw new Error(error.message || 'Failed to get signed URL');
        const signedUrl = (data as any)?.signed_url;
        log('Edge function returned signed URL', redactUrl(signedUrl));
        if (!signedUrl) throw new Error('Invalid signed URL response');
        const convId = await conversation.startSession({ url: signedUrl } as any);
        log('Coach session started (private)', { convId });
      } else {
        const convId = await conversation.startSession({ agentId: agentId.trim() });
        log('Coach session started (public)', { convId });
      }
    } catch (error) {
      console.error('Failed to start coaching session:', error);
      const raw: any = error;
      const message = (raw && (raw.message || raw.reason || raw.code)) || JSON.stringify(raw) || 'Unknown error';
      alert(`Could not start coaching: ${message}`);
    }
  };

  const tryPrivateFallback = async () => {
    try {
      setFallbackTried(true);
      log('Fallback: requesting signed URL');
      // Ensure any previous session is fully closed and mic is available
      try { await conversation.endSession(); } catch {}
      try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}

      const { data, error } = await supabase.functions.invoke('eleven-signed-url', {
        body: { agentId: agentId.trim() },
      });
      if (error) throw new Error(error.message || 'Failed to get signed URL');
      const signedUrl = (data as any)?.signed_url;
      log('Fallback signed URL', redactUrl(signedUrl));
      if (!signedUrl) throw new Error('Invalid signed URL response');

      // Add a timeout so we surface errors if the connect hangs
      const connectPromise = (async () => {
        const convId = await conversation.startSession({ url: signedUrl } as any);
        log('Fallback connected', { convId });
        alert('Switched to private connection automatically.');
      })();
      const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('Fallback connect timeout (5s)')), 5000));
      await Promise.race([connectPromise, timeoutPromise]);
    } catch (e) {
      console.error('Fallback connection failed:', e);
      const msg = (e as any)?.message || JSON.stringify(e) || 'Unknown error';
      setLastError(typeof msg === 'string' ? msg : 'Unknown error');
      alert(`Coach disconnected and fallback failed: ${msg}`);
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

  const validateAgent = async () => {
    try {
      log('Validating agent via edge function');
      const { data, error } = await supabase.functions.invoke('eleven-signed-url', {
        body: { agentId: agentId.trim(), validate: true },
      });
      if (error) throw new Error(error.message || 'Validation request failed');
      const res: any = data;
      log('Validation response', res);
      if (res?.valid === false) {
        alert(`Validation: NOT FOUND in this workspace (${res.status}). Details: ${res.message || 'n/a'}`);
      } else if (res?.valid === true) {
        alert(`Validation: OK — ${res.agent?.name || 'agent'} (${res.agent?.id})`);
      } else {
        alert('Validation returned unexpected response');
      }
    } catch (e) {
      const msg = (e as any)?.message || JSON.stringify(e) || 'Unknown error';
      alert(`Validation failed: ${msg}`);
    }
  };
  useEffect(() => {
    const justAttempted = !!connectAttemptAt && Date.now() - connectAttemptAt < 5000;
    if (status === 'disconnected' && !usePrivate && !fallbackTried && justAttempted) {
      log('Status watcher triggering private fallback');
      tryPrivateFallback();
    }
  }, [status, connectAttemptAt, usePrivate, fallbackTried]);

  // Status change logging
  useEffect(() => {
    log('Status:', status);
  }, [status]);

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
            <label className="text-sm text-foreground font-medium">ElevenLabs Agent ID (hardcoded)</label>
            <div
              className="w-full px-3 py-2 rounded-md border border-primary/20 bg-coach-surface text-foreground font-mono text-xs select-all"
              aria-label="Hardcoded Agent ID"
            >
              {agentId}
            </div>
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
          <label className="flex items-center justify-between text-sm text-foreground">
            <span>Enable debug logs</span>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-sm text-foreground">
            <span>Safe mode (disable overrides)</span>
            <input
              type="checkbox"
              checked={safeMode}
              onChange={(e) => setSafeMode(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-sm text-foreground">
            <span>Local TTS fallback when coach is silent</span>
            <input
              type="checkbox"
              checked={ttsFallbackEnabled}
              onChange={(e) => setTtsFallbackEnabled(e.target.checked)}
            />
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={validateAgent}>Validate Agent</Button>
          </div>
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

        {debugMode && (
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">Debug Logs</h4>
            <div className="p-3 bg-muted rounded-md max-h-40 overflow-auto">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No logs yet</p>
              ) : (
                logs.slice(-80).map((l, i) => (
                  <div key={i} className="text-[10px] font-mono text-muted-foreground">{l}</div>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(logs.join('\n'))}>Copy</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};