import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff } from 'lucide-react';

interface CameraFeedProps {
  onVideoStream: (stream: MediaStream | null) => void;
  isActive: boolean;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ onVideoStream, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      console.log('Requesting camera access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      console.log('Camera stream obtained:', stream);

      streamRef.current = stream;

      if (videoRef.current) {
        console.log('Setting video source...');
        videoRef.current.srcObject = stream;

        // Mark streaming immediately so UI and overlay can attach
        setIsStreaming(true);
        onVideoStream(stream);

        // Attempt to play immediately
        const playPromise = videoRef.current.play();
        if (playPromise && typeof (playPromise as any).catch === 'function') {
          (playPromise as Promise<void>).catch((err) => console.log('Autoplay prevented:', err));
        }

        // Also ensure play after metadata just in case
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          videoRef.current?.play().catch((err) => console.log('Autoplay prevented:', err));
        };
      } else {
        console.log('Video element not yet mounted; will set on mount');
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
      setIsStreaming(false);
      onVideoStream(null);
    }
  };

  const stopCamera = () => {
    const stream = (videoRef.current?.srcObject as MediaStream | null) || streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    streamRef.current = null;
    setIsStreaming(false);
    onVideoStream(null);
  };

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card className="relative overflow-hidden bg-coach-surface border-primary/20">
      <div className="aspect-video relative">
        {/* Always render the video so the ref exists when starting the camera */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Overlay when not streaming or on error */}
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-coach-surface">
            <div className="text-center space-y-4">
              {error ? (
                <>
                  <CameraOff className="w-16 h-16 mx-auto text-destructive" />
                  <p className="text-destructive text-sm">{error}</p>
                  <Button variant="energy" onClick={startCamera}>
                    Try Again
                  </Button>
                </>
              ) : (
                <>
                  <Camera className="w-16 h-16 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Camera not active</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Overlay for pose landmarks */}
        <canvas
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10 }}
        />
      </div>

      {/* Camera controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button
          variant={isStreaming ? 'destructive' : 'energy'}
          size="sm"
          onClick={isStreaming ? stopCamera : startCamera}
        >
          {isStreaming ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
        </Button>
      </div>
    </Card>
  );
};
