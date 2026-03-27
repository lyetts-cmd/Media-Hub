import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Track } from "@workspace/api-client-react";
import { getStreamTrackUrl } from "@workspace/api-client-react";

interface PlayerContextType {
  queue: Track[];
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  togglePlayPause: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => next();
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.pause();
      audio.src = '';
    };
  }, []); // Run once

  const currentTrack = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  useEffect(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.src = getStreamTrackUrl(currentTrack.id);
      audioRef.current.play().catch(console.error);
    }
  }, [currentIndex, currentTrack]);

  const playTrack = (track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue);
      const index = newQueue.findIndex(t => t.id === track.id);
      setCurrentIndex(index >= 0 ? index : 0);
    } else {
      if (queue.length === 0) {
        setQueue([track]);
        setCurrentIndex(0);
      } else {
        const existingIdx = queue.findIndex(t => t.id === track.id);
        if (existingIdx >= 0) {
          setCurrentIndex(existingIdx);
        } else {
          setQueue(prev => [...prev, track]);
          setCurrentIndex(queue.length);
        }
      }
    }
  };

  const pause = () => audioRef.current?.pause();
  const resume = () => audioRef.current?.play().catch(console.error);
  const togglePlayPause = () => {
    if (isPlaying) pause();
    else resume();
  };

  const next = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Loop or stop. Let's stop.
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const prev = () => {
    if (currentTime > 3) {
      seek(0);
    } else if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolume = (vol: number) => {
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setVolumeState(vol);
    }
  };

  return (
    <PlayerContext.Provider value={{
      queue, currentTrack, currentIndex, isPlaying, currentTime, duration, volume,
      playTrack, pause, resume, next, prev, seek, setVolume, togglePlayPause
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
