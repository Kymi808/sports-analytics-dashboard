import React, { useRef, useCallback } from 'react';

function tagTypeClass(type) {
  const map = {
    Shot: 'shot', Pass: 'pass', Rebound: 'rebound', Block: 'block',
    Turnover: 'turnover', 'Fast Break': 'fast-break',
    Serve: 'serve', Spike: 'spike', Dig: 'dig', Set: 'set',
  };
  return map[type] || 'default';
}

export default function VideoPlayer({ src, tags = [], duration, onTimelineClick }) {
  const videoRef = useRef(null);

  const handleTimelineClick = useCallback(
    (e) => {
      if (!duration || !onTimelineClick) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      const timestamp = Math.round(pct * duration * 100) / 100;
      onTimelineClick(timestamp);
    },
    [duration, onTimelineClick]
  );

  const seekTo = useCallback((timestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play();
    }
  }, []);

  return (
    <div>
      <div className="video-container">
        <video ref={videoRef} src={src} controls preload="metadata" />
      </div>
      {duration > 0 && (
        <div className="video-timeline" onClick={handleTimelineClick}>
          <div className="video-timeline-bar">
            {tags.map((tag) => {
              const left = `${(tag.timestamp / duration) * 100}%`;
              return (
                <div
                  key={tag.id}
                  className={`timeline-marker ${tagTypeClass(tag.tag_type)}`}
                  style={{ left }}
                  title={`${tag.tag_type} @ ${tag.timestamp.toFixed(1)}s — ${tag.description || ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(tag.timestamp);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
