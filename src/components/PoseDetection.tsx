import React, { useRef, useEffect, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface PoseDetectionProps {
  videoStream: MediaStream | null;
  onPoseResults: (results: any) => void;
  isActive: boolean;
}

interface SquatAnalysis {
  isSquatting: boolean;
  depth: number; // 0-100, where 100 is proper squat depth
  kneeAlignment: 'good' | 'knees-in' | 'knees-out';
  backAlignment: 'good' | 'forward-lean' | 'backward-lean';
  feedback: string[];
}

export const PoseDetection: React.FC<PoseDetectionProps> = ({ 
  videoStream, 
  onPoseResults, 
  isActive 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [squatAnalysis, setSquatAnalysis] = useState<SquatAnalysis | null>(null);
  const [poseReady, setPoseReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const lastTimeRef = useRef<number>(0);

  // Analyze squat form from pose landmarks
  const analyzeSquat = (landmarks: any[]): SquatAnalysis => {
    if (!landmarks || landmarks.length === 0) {
      return {
        isSquatting: false,
        depth: 0,
        kneeAlignment: 'good',
        backAlignment: 'good',
        feedback: []
      };
    }

    const feedback: string[] = [];
    
    // Get key landmarks (using indices)
    const leftHip = landmarks[23];      // LEFT_HIP
    const rightHip = landmarks[24];     // RIGHT_HIP
    const leftKnee = landmarks[25];     // LEFT_KNEE
    const rightKnee = landmarks[26];    // RIGHT_KNEE
    const leftAnkle = landmarks[27];    // LEFT_ANKLE
    const rightAnkle = landmarks[28];   // RIGHT_ANKLE
    const leftShoulder = landmarks[11]; // LEFT_SHOULDER
    const rightShoulder = landmarks[12]; // RIGHT_SHOULDER

    // Calculate hip height (average of both hips)
    const hipHeight = (leftHip.y + rightHip.y) / 2;
    const kneeHeight = (leftKnee.y + rightKnee.y) / 2;
    const ankleHeight = (leftAnkle.y + rightAnkle.y) / 2;

    // Calculate squat depth (normalized)
    const standingHipHeight = 0.4; // Approximate normalized standing hip height
    const squatDepth = Math.max(0, Math.min(100, 
      ((standingHipHeight - hipHeight) / (standingHipHeight - kneeHeight)) * 100
    ));

    const isSquatting = squatDepth > 20;

    // Analyze knee alignment
    const hipWidth = Math.abs(leftHip.x - rightHip.x);
    const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
    let kneeAlignment: 'good' | 'knees-in' | 'knees-out' = 'good';
    
    if (kneeWidth < hipWidth * 0.8) {
      kneeAlignment = 'knees-in';
      feedback.push('Keep your knees tracking over your toes');
    } else if (kneeWidth > hipWidth * 1.3) {
      kneeAlignment = 'knees-out';
      feedback.push('Bring your knees slightly closer together');
    }

    // Analyze back alignment
    const shoulderCenter = (leftShoulder.x + rightShoulder.x) / 2;
    const hipCenter = (leftHip.x + rightHip.x) / 2;
    const backLean = Math.abs(shoulderCenter - hipCenter);
    
    let backAlignment: 'good' | 'forward-lean' | 'backward-lean' = 'good';
    if (shoulderCenter < hipCenter - 0.05) {
      backAlignment = 'forward-lean';
      feedback.push('Keep your chest up and back straight');
    } else if (shoulderCenter > hipCenter + 0.05) {
      backAlignment = 'backward-lean';
      feedback.push('Lean slightly forward to maintain balance');
    }

    // Depth feedback
    if (isSquatting) {
      if (squatDepth < 60) {
        feedback.push('Go deeper - aim to get your hips below your knees');
      } else if (squatDepth > 90) {
        feedback.push('Great depth! Focus on control');
      } else {
        feedback.push('Perfect squat depth!');
      }
    }

    return {
      isSquatting,
      depth: squatDepth,
      kneeAlignment,
      backAlignment,
      feedback
    };
  };

  const onResults = (results: any) => {
    if (!canvasRef.current) return;

    // FPS tracking
    const now = performance.now();
    if (lastTimeRef.current) {
      const delta = (now - lastTimeRef.current) / 1000;
      if (delta > 0) setFps(Math.round(1 / delta));
    }
    lastTimeRef.current = now;
    setPoseReady(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      setLandmarkCount(results.poseLandmarks.length || 0);
      // Analyze squat form
      const analysis = analyzeSquat(results.poseLandmarks);
      setSquatAnalysis(analysis);

      // Draw pose landmarks with simplified connections
      const connections = [
        [11, 12], [11, 13], [12, 14], [13, 15], [14, 16], // Arms
        [11, 23], [12, 24], [23, 24], // Torso
        [23, 25], [24, 26], [25, 27], [26, 28] // Legs
      ];
      
      // Draw connections
      ctx.strokeStyle = analysis.isSquatting ? '#00ff88' : '#00d4ff';
      ctx.lineWidth = 2;
      connections.forEach(([start, end]) => {
        if (results.poseLandmarks[start] && results.poseLandmarks[end]) {
          const startPoint = results.poseLandmarks[start];
          const endPoint = results.poseLandmarks[end];
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }
      });
      
      // Draw landmarks manually
      ctx.fillStyle = analysis.isSquatting ? '#ff6b35' : '#00d4ff';
      results.poseLandmarks.forEach((landmark: any) => {
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width,
          landmark.y * canvas.height,
          3,
          0,
          2 * Math.PI
        );
        ctx.fill();
      });

      // Draw form feedback
      if (analysis.isSquatting) {
        ctx.fillStyle = analysis.kneeAlignment === 'good' ? '#00ff88' : '#ff4757';
        ctx.font = '16px sans-serif';
        ctx.fillText(`Depth: ${Math.round(analysis.depth)}%`, 10, 30);
        
        analysis.feedback.forEach((text, index) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, 10, 60 + (index * 25));
        });
      }
    }

    onPoseResults({ ...results, squatAnalysis });
  };

  useEffect(() => {
    if (!isActive) return;

    const initializePose = async () => {
      if (poseRef.current) return;

      poseRef.current = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      poseRef.current.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      poseRef.current.onResults(onResults);
    };

    initializePose();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (!videoStream || !poseRef.current || !isActive) return;

    const video = videoRef.current;
    if (!video) return;

    video.srcObject = videoStream;
    
    const startCamera = () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }

      cameraRef.current = new Camera(video, {
        onFrame: async () => {
          if (poseRef.current) {
            await poseRef.current.send({ image: video });
          }
        },
        width: 1280,
        height: 720
      });

      cameraRef.current.start();
    };

    video.addEventListener('loadedmetadata', startCamera);

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      video.removeEventListener('loadedmetadata', startCamera);
    };
  }, [videoStream, isActive]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        width={1280}
        height={720}
        style={{ zIndex: 10 }}
      />

      {/* Debug HUD */}
      <div className="absolute top-2 left-2 bg-coach-surface-elevated/80 text-foreground rounded px-2 py-1 border border-primary/30 shadow-sm">
        <div className="text-xs font-medium">
          <span className="mr-2">MediaPipe:</span>
          <span className={poseReady ? 'text-form-correct' : 'text-muted-foreground'}>
            {poseReady ? 'Running' : 'Initializing...'}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">FPS: {fps} | Landmarks: {landmarkCount}</div>
      </div>
    </div>
  );
};

export type { SquatAnalysis };