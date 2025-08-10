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
          facingMode: 'user'
        },
        audio: false
      });
      
      console.log('Camera stream obtained:', stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        onVideoStream(stream);
        console.log('Video stream set, isStreaming set to true');
        
        // Force video to play
        try {
          await videoRef.current.play();
          console.log('Video playing successfully');
        } catch (playError) {
          console.log('Auto-play blocked, but stream is set:', playError);
          // Video will still show even if autoplay is blocked
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
      setIsStreaming(false);
      onVideoStream(null);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
      onVideoStream(null);
    }
  };

  useEffect(() => {
    if (isActive && !isStreaming) {
      startCamera();
    } else if (!isActive && isStreaming) {
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
        {isStreaming && videoRef.current?.srcObject ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-coach-surface">
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
        
        {/* Overlay for pose landmarks will be added here */}
        <canvas 
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10 }}
        />
      </div>
      
      {/* Camera controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button
          variant={isStreaming ? "destructive" : "energy"}
          size="sm"
          onClick={isStreaming ? stopCamera : startCamera}
        >
          {isStreaming ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
        </Button>
      </div>
    </Card>
  );
};