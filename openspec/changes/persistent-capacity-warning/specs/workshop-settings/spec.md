# Persistent capacity warning

The system MUST allow capacity changes and preserve existing appointments.
- Given future active appointments above capacity, when opening either internal section or reloading, then a persistent warning displays the affected intervals.
- Given appointments outside the selected week, when they exceed capacity, then the warning still appears.
- Given resolved conflicts, terminal appointments or elapsed intervals, when reloading, then those intervals MUST NOT cause a warning.
- Given one appointment ending as another starts, when checking capacity, then they MUST NOT count as simultaneous.
