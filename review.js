'use strict';

// Pure review aggregation: dates use local calendar boundaries, never UTC slicing.
(function (root) {
  function key(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function summarize(sessions, endDate) {
    const parts = endDate.split('-').map(Number),
      end = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = Array.from({
      length: 7
    }, (_, i) => {
      const date = new Date(end);
      date.setDate(date.getDate() - 6 + i);
      return {
        date: key(date),
        total: 0,
        productive: 0,
        distracting: 0
      };
    });
    const byDate = new Map(days.map(d => [d.date, d]));
    for (const session of sessions) {
      const day = byDate.get(session.date);
      if (!day || !Number.isFinite(session.duration) || session.duration < 0) continue;
      day.total += session.duration;
      if (session.isDistraction) day.distracting += session.duration;else if (session.isProductive) day.productive += session.duration;
    }
    return {
      days,
      total: days.reduce((sum, d) => sum + d.total, 0),
      recordedDays: days.filter(d => d.total > 0).length
    };
  }
  root.AttentionReview = {
    summarize
  };
  if (typeof module !== 'undefined') module.exports = {
    summarize
  };
})(globalThis);
