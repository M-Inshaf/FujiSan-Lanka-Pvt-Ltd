// Services Index - Load all services
// This file should be loaded first in the HTML

// Service initialization order matters
// 1. Logger (dependency for others)
// 2. Storage (used by audit and offline)
// 3. Audit (depends on storage)
// 4. Validation
// 5. Offline (depends on storage)

Logger.info('Services initialized');