import { useState, useEffect } from 'react';
import { Clock, MapPin } from 'lucide-react';

export const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Türkiye saati için UTC+3 timezone
  const turkeyTime = new Date(time.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('tr-TR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="flex items-center gap-2 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 px-3 py-2 rounded-xl border border-blue-500/20 backdrop-blur-sm shadow-lg group hover:shadow-xl transition-all duration-300">
      {/* Animated Clock Icon */}
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md animate-pulse" />
        <Clock className="relative w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors duration-300 group-hover:scale-110 transform" />
      </div>
      
      {/* Time Display */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-wider font-mono bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {formatTime(turkeyTime)}
          </span>
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping" />
            <div className="w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
            <div className="w-1 h-1 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5 text-blue-400/70" />
          <span className="text-[10px] text-muted-foreground font-medium">
            Antalya, TR
          </span>
          <span className="text-[9px] text-blue-400/60 font-mono">
            {formatDate(turkeyTime)}
          </span>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full opacity-60 animate-pulse" />
      <div className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full opacity-40 animate-pulse" style={{ animationDelay: '0.5s' }} />
    </div>
  );
};